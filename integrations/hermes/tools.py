"""Process-backed Hermes tools for QuorumRouter.

The bridge accepts JSON over stdin so prompts do not appear in process listings.
Provider credentials remain inside each provider CLI's existing OAuth/session.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time
from datetime import datetime, timezone
from typing import Any

PLUGIN_DIR = Path(__file__).resolve().parent
CONFIG_PATH = PLUGIN_DIR / "config.json"
TRIAL_LOG_PATH = PLUGIN_DIR / "trial-telemetry.jsonl"

ROUTE_SCHEMA = {
    "name": "quorum_router_route",
    "description": (
        "Route a self-contained text task through QuorumRouter. Use selectively for "
        "high-value second opinions, answer comparison, launch/review copy, or explicit "
        "QuorumRouter testing. Do not use for trivial questions, secret-bearing prompts, "
        "or tasks that require Hermes tools/files/browser access. route_once is the "
        "low-cost default; best_route may call several local provider CLIs."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "Self-contained task text. Do not include credentials or raw secrets.",
            },
            "mode": {
                "type": "string",
                "enum": ["route_once", "best_route"],
                "default": "route_once",
                "description": "route_once calls one selected provider; best_route compares available providers.",
            },
            "provider": {
                "type": "string",
                "description": "Optional exact provider alias such as codex or grok.",
            },
            "model": {
                "type": "string",
                "description": "Optional exact listed model such as grok-4.5.",
            },
        },
        "required": ["prompt"],
    },
}

AGENT_CHAT_SCHEMA = {
    "name": "quorum_router_agent_chat",
    "description": (
        "Run a bounded live multi-model dialogue through QuorumRouter. Use for "
        "architecture decisions, difficult reviews, and explicit cross-model debate. "
        "Requires at least two distinct working provider/model identities. Returns "
        "round-by-round reply lineage. Do not include secrets or tasks requiring Hermes tools."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "Self-contained discussion task without credentials or raw secrets.",
            },
            "max_turns": {
                "type": "integer",
                "minimum": 2,
                "maximum": 12,
                "default": 6,
                "description": "Total bounded dialogue turns across two distinct participants.",
            },
        },
        "required": ["prompt"],
    },
}

HEALTH_SCHEMA = {
    "name": "quorum_router_health",
    "description": (
        "Inspect QuorumRouter's local provider inventory and readiness without sending "
        "a generation request. Use before the first routed call or when routing fails."
    ),
    "parameters": {"type": "object", "properties": {}},
}


def _load_config() -> dict[str, Any]:
    try:
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _repo_root() -> Path:
    configured = str(_load_config().get("repo_path", "")).strip()
    if configured:
        return Path(configured).expanduser().resolve()
    candidate = PLUGIN_DIR.parents[1]
    if (candidate / "deno.json").is_file():
        return candidate
    return Path.home() / "work" / "quorum-router-runtime"


def _bridge_path() -> Path:
    return _repo_root() / "examples/local-model-dogfood/src/hermes_bridge.ts"


def _provider_commands() -> list[str]:
    resolved: list[str] = []
    for name in ("codex", "claude", "gemini", "grok", "devin", "qwen"):
        path = shutil.which(name)
        if path:
            absolute = str(Path(path).absolute())
            if absolute not in resolved:
                resolved.append(absolute)
    return resolved


def is_available() -> bool:
    """Expose health whenever the bridge exists; route reports provider gaps."""
    return shutil.which("deno") is not None and _bridge_path().is_file()


def _error(message: str, **extra: Any) -> str:
    return json.dumps({"ok": False, "error": message, **extra}, ensure_ascii=False)


def _record_trial(result: dict[str, Any], latency_ms: int) -> None:
    config = _load_config()
    if config.get("telemetry_enabled", True) is False:
        return
    event = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "operation": result.get("operation", "unknown"),
        "ok": bool(result.get("ok")),
        "provider": result.get("provider"),
        "model": result.get("model"),
        "candidates_called": result.get("candidates_called", 0),
        "schema_valid": result.get("schema_valid"),
        "truncated": bool(result.get("truncated", False)),
        "latency_ms": latency_ms,
        "exit_code": result.get("exit_code"),
    }
    try:
        if TRIAL_LOG_PATH.exists() and TRIAL_LOG_PATH.stat().st_size > 1_000_000:
            TRIAL_LOG_PATH.replace(TRIAL_LOG_PATH.with_suffix(".jsonl.1"))
        with TRIAL_LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(event, ensure_ascii=False) + "\n")
        TRIAL_LOG_PATH.chmod(0o600)
    except OSError:
        pass


def _trial_summary() -> dict[str, Any]:
    try:
        lines = TRIAL_LOG_PATH.read_text(encoding="utf-8").splitlines()[-500:]
    except OSError:
        return {"runs": 0, "successful_runs": 0}
    events: list[dict[str, Any]] = []
    for line in lines:
        try:
            event = json.loads(line)
            if isinstance(event, dict):
                events.append(event)
        except json.JSONDecodeError:
            continue
    route_events = [event for event in events if event.get("operation") != "health"]
    return {
        "runs": len(route_events),
        "successful_runs": sum(bool(event.get("ok")) for event in route_events),
        "last_run_at": route_events[-1].get("timestamp") if route_events else None,
        "log_path": str(TRIAL_LOG_PATH),
    }


def _run_bridge_process(
    command: list[str],
    *,
    cwd: Path,
    env: dict[str, str],
    input_text: str,
    timeout: int,
) -> tuple[int, str, str, bool]:
    """Run the bridge and terminate its process tree on timeout."""
    process = subprocess.Popen(
        command,
        cwd=cwd,
        env=env,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=os.name == "posix",
    )
    try:
        stdout, stderr = process.communicate(input=input_text, timeout=timeout)
        return process.returncode, stdout, stderr, False
    except subprocess.TimeoutExpired:
        if os.name == "posix":
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                pass
            # Always escalate against the group: the Deno parent may exit while
            # a provider descendant ignores SIGTERM and keeps pipes open.
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        elif os.name == "nt":
            try:
                subprocess.run(
                    ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                    check=False,
                )
            except (OSError, subprocess.TimeoutExpired):
                process.kill()
        else:
            process.kill()
        try:
            stdout, stderr = process.communicate(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            try:
                stdout, stderr = process.communicate(timeout=2)
            except subprocess.TimeoutExpired:
                stdout, stderr = "", ""
        return process.returncode if process.returncode is not None else -9, stdout, stderr, True


def _invoke(
    payload: dict[str, Any],
    provider: str | None = None,
    model: str | None = None,
) -> str:
    if not is_available():
        return _error(
            "QuorumRouter bridge is unavailable",
            expected_bridge=str(_bridge_path()),
        )

    repo = _repo_root()
    dogfood = repo / "examples/local-model-dogfood"
    out_dir = repo / "out/dogfood/local-model-dogfood"
    deno_path = shutil.which("deno")
    provider_commands = _provider_commands()
    operation = payload.get("operation")
    if not deno_path:
        return _error("QuorumRouter Deno runtime is unavailable")
    deno_path = str(Path(deno_path).absolute())
    if operation != "health" and not provider_commands:
        return _error("QuorumRouter has no local provider commands")
    safe_path_dirs = list(dict.fromkeys(
        [str(Path(deno_path).parent)]
        + [str(Path(path).parent) for path in provider_commands]
        + ["/usr/bin", "/bin"]
    ))
    env = {
        name: os.environ[name]
        for name in (
            "PATH",
            "HOME",
            "TMPDIR",
            "TMP",
            "TEMP",
            "XDG_CONFIG_HOME",
            "XDG_CACHE_HOME",
            "DENO_DIR",
            "LANG",
            "LC_ALL",
            "TERM",
        )
        if os.environ.get(name)
    }
    env["PATH"] = os.pathsep.join(safe_path_dirs)
    env["RUN_EXTERNAL_MODEL_DOGFOOD"] = "1"
    env["QUORUM_ROUTER_AUTH_MODE"] = "wrapper"
    if operation == "agent_chat":
        env["RUN_EXPERIMENTAL_AGENT_CHAT"] = "1"
        env["QUORUM_ROUTER_AGENT_CHAT_MAX_TURNS"] = str(payload["max_turns"])
    if provider:
        env["QUORUM_ROUTER_PROVIDER_LABEL"] = provider
    else:
        env.pop("QUORUM_ROUTER_PROVIDER_LABEL", None)
    if model:
        env["QUORUM_ROUTER_PROVIDER_MODEL"] = model
    else:
        env.pop("QUORUM_ROUTER_PROVIDER_MODEL", None)

    command = [
        deno_path,
        "run",
        "--allow-env",
        "--allow-read",
    ]
    if provider_commands:
        command.append(f"--allow-run={','.join(provider_commands)}")
    command.extend([
        f"--allow-write={out_dir}",
        str(_bridge_path()),
    ])
    timeout = 600 if payload.get("operation") in {"best_route", "agent_chat"} else 180
    started = time.monotonic()
    try:
        returncode, bridge_stdout, bridge_stderr, timed_out = _run_bridge_process(
            command,
            cwd=dogfood,
            env=env,
            input_text=json.dumps(payload, ensure_ascii=False),
            timeout=timeout,
        )
    except OSError as exc:
        result = {
            "ok": False,
            "operation": payload.get("operation"),
            "error": f"QuorumRouter could not start: {exc}",
        }
        _record_trial(result, round((time.monotonic() - started) * 1000))
        return json.dumps(result, ensure_ascii=False)
    if timed_out:
        result = {
            "ok": False,
            "operation": payload.get("operation"),
            "error": "QuorumRouter timed out and its process group was terminated",
            "timeout_seconds": timeout,
        }
        _record_trial(result, round((time.monotonic() - started) * 1000))
        return json.dumps(result, ensure_ascii=False)

    stdout = bridge_stdout.strip()
    try:
        result = json.loads(stdout)
    except json.JSONDecodeError:
        result = {
            "ok": False,
            "operation": payload.get("operation"),
            "error": "QuorumRouter returned invalid bridge JSON",
            "exit_code": returncode,
            "stderr_present": bool(bridge_stderr.strip()),
        }
    if not isinstance(result, dict):
        result = {
            "ok": False,
            "operation": payload.get("operation"),
            "error": "QuorumRouter returned a non-object bridge response",
        }
    result["exit_code"] = returncode
    if bridge_stderr.strip() and not result.get("ok"):
        result["stderr_present"] = True
    if payload.get("operation") == "health":
        result["trial"] = _trial_summary()
    _record_trial(result, round((time.monotonic() - started) * 1000))
    return json.dumps(result, ensure_ascii=False)


def route(args: dict[str, Any], **_: Any) -> str:
    prompt = str(args.get("prompt", "")).strip()
    if not prompt:
        return _error("prompt is required")
    if len(prompt.encode("utf-8")) > 100_000:
        return _error("prompt exceeds 100000 bytes")
    mode = str(args.get("mode", "route_once"))
    if mode not in {"route_once", "best_route"}:
        return _error("mode must be route_once or best_route")
    provider = str(args.get("provider", "")).strip() or None
    model = str(args.get("model", "")).strip() or None
    return _invoke(
        {"operation": mode, "prompt": prompt},
        provider=provider,
        model=model,
    )


def agent_chat(args: dict[str, Any], **_: Any) -> str:
    prompt = str(args.get("prompt", "")).strip()
    if not prompt:
        return _error("prompt is required")
    if len(prompt.encode("utf-8")) > 100_000:
        return _error("prompt exceeds 100000 bytes")
    raw_max_turns = args.get("max_turns", 6)
    if isinstance(raw_max_turns, bool) or not isinstance(raw_max_turns, int):
        return _error("max_turns must be an integer from 2 to 12")
    if raw_max_turns < 2 or raw_max_turns > 12:
        return _error("max_turns must be an integer from 2 to 12")
    return _invoke({
        "operation": "agent_chat",
        "prompt": prompt,
        "max_turns": raw_max_turns,
    })


def health(args: dict[str, Any] | None = None, **_: Any) -> str:
    del args
    return _invoke({"operation": "health"})
