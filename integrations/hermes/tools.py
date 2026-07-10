"""Process-backed Hermes tools for Fusion Router.

The bridge accepts JSON over stdin so prompts do not appear in process listings.
Provider credentials remain inside each provider CLI's existing OAuth/session.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess
import time
from datetime import datetime, timezone
from typing import Any

PLUGIN_DIR = Path(__file__).resolve().parent
CONFIG_PATH = PLUGIN_DIR / "config.json"
TRIAL_LOG_PATH = PLUGIN_DIR / "trial-telemetry.jsonl"

ROUTE_SCHEMA = {
    "name": "fusion_router_route",
    "description": (
        "Route a self-contained text task through Fusion Router. Use selectively for "
        "high-value second opinions, answer comparison, launch/review copy, or explicit "
        "Fusion Router testing. Do not use for trivial questions, secret-bearing prompts, "
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

HEALTH_SCHEMA = {
    "name": "fusion_router_health",
    "description": (
        "Inspect Fusion Router's local provider inventory and readiness without sending "
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
    return Path.home() / "work" / "fusion-router-runtime"


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
    return (
        shutil.which("deno") is not None
        and _bridge_path().is_file()
        and bool(_provider_commands())
    )


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


def _invoke(
    payload: dict[str, Any],
    provider: str | None = None,
    model: str | None = None,
) -> str:
    if not is_available():
        return _error(
            "Fusion Router bridge is unavailable",
            expected_bridge=str(_bridge_path()),
        )

    repo = _repo_root()
    dogfood = repo / "examples/local-model-dogfood"
    out_dir = repo / "out/dogfood/local-model-dogfood"
    deno_path = shutil.which("deno")
    provider_commands = _provider_commands()
    if not deno_path or not provider_commands:
        return _error("Fusion Router runtime commands are unavailable")
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
    env["FUSION_ROUTER_AUTH_MODE"] = "wrapper"
    if provider:
        env["FUSION_ROUTER_PROVIDER_LABEL"] = provider
    else:
        env.pop("FUSION_ROUTER_PROVIDER_LABEL", None)
    if model:
        env["FUSION_ROUTER_PROVIDER_MODEL"] = model
    else:
        env.pop("FUSION_ROUTER_PROVIDER_MODEL", None)

    command = [
        deno_path,
        "run",
        "--allow-env",
        "--allow-read",
        f"--allow-run={','.join(provider_commands)}",
        f"--allow-write={out_dir}",
        str(_bridge_path()),
    ]
    timeout = 600 if payload.get("operation") == "best_route" else 180
    started = time.monotonic()
    try:
        completed = subprocess.run(
            command,
            cwd=dogfood,
            env=env,
            input=json.dumps(payload, ensure_ascii=False),
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired:
        result = {
            "ok": False,
            "operation": payload.get("operation"),
            "error": "Fusion Router timed out",
            "timeout_seconds": timeout,
        }
        _record_trial(result, round((time.monotonic() - started) * 1000))
        return json.dumps(result, ensure_ascii=False)
    except OSError as exc:
        result = {
            "ok": False,
            "operation": payload.get("operation"),
            "error": f"Fusion Router could not start: {exc}",
        }
        _record_trial(result, round((time.monotonic() - started) * 1000))
        return json.dumps(result, ensure_ascii=False)

    stdout = completed.stdout.strip()
    try:
        result = json.loads(stdout)
    except json.JSONDecodeError:
        result = {
            "ok": False,
            "operation": payload.get("operation"),
            "error": "Fusion Router returned invalid bridge JSON",
            "exit_code": completed.returncode,
            "stderr_present": bool(completed.stderr.strip()),
        }
    if not isinstance(result, dict):
        result = {
            "ok": False,
            "operation": payload.get("operation"),
            "error": "Fusion Router returned a non-object bridge response",
        }
    result["exit_code"] = completed.returncode
    if completed.stderr.strip() and not result.get("ok"):
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


def health(args: dict[str, Any] | None = None, **_: Any) -> str:
    del args
    return _invoke({"operation": "health"})
