import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock


TOOLS_PATH = Path(__file__).resolve().parents[1] / "tools.py"
SPEC = importlib.util.spec_from_file_location("quorum_router_tools", TOOLS_PATH)
assert SPEC and SPEC.loader
TOOLS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(TOOLS)


class QuorumRouterToolsTest(unittest.TestCase):
    def test_route_rejects_empty_prompt(self):
        result = json.loads(TOOLS.route({"prompt": "  "}))
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"], "prompt is required")

    def test_route_rejects_invalid_mode(self):
        result = json.loads(TOOLS.route({"prompt": "test", "mode": "agent_chat"}))
        self.assertFalse(result["ok"])
        self.assertIn("route_once", result["error"])

    def test_health_never_sets_generation_operation(self):
        with mock.patch.object(TOOLS, "_invoke", return_value='{"ok":true}') as invoke:
            self.assertEqual(json.loads(TOOLS.health({})), {"ok": True})
            invoke.assert_called_once_with({"operation": "health"})

    def test_health_runs_without_provider_commands(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            bridge = root / "examples/local-model-dogfood/src/hermes_bridge.ts"
            bridge.parent.mkdir(parents=True)
            bridge.write_text("// test", encoding="utf-8")
            (root / "out/dogfood/local-model-dogfood").mkdir(parents=True)
            with mock.patch.object(TOOLS, "_repo_root", return_value=root), \
                 mock.patch.object(TOOLS.shutil, "which", return_value="deno"), \
                 mock.patch.object(TOOLS, "_provider_commands", return_value=[]), \
                 mock.patch.object(TOOLS, "_record_trial"), \
                 mock.patch.object(TOOLS, "_run_bridge_process") as run:
                run.return_value = (
                    0,
                    '{"ok":true,"operation":"health","invokable_count":0}',
                    "",
                    False,
                )
                result = json.loads(TOOLS.health({}))
                self.assertTrue(result["ok"])
                command = run.call_args.args[0]
                self.assertFalse(any(arg.startswith("--allow-run=") for arg in command))

    def test_timeout_terminates_posix_process_group(self):
        process = mock.Mock(pid=1234, returncode=-15)
        process.communicate.side_effect = [
            TOOLS.subprocess.TimeoutExpired(cmd="deno", timeout=1),
            ("", ""),
        ]
        process.wait.return_value = -15
        with mock.patch.object(TOOLS.subprocess, "Popen", return_value=process) as popen, \
             mock.patch.object(TOOLS.os, "name", "posix"), \
             mock.patch.object(TOOLS.os, "killpg") as killpg:
            result = TOOLS._run_bridge_process(
                ["/usr/bin/deno"],
                cwd=Path("/tmp"),
                env={},
                input_text="{}",
                timeout=1,
            )
        self.assertTrue(result[3])
        self.assertTrue(popen.call_args.kwargs["start_new_session"])
        killpg.assert_has_calls([
            mock.call(1234, TOOLS.signal.SIGTERM),
            mock.call(1234, TOOLS.signal.SIGKILL),
        ])

    def test_timeout_terminates_windows_process_tree(self):
        process = mock.Mock(pid=4321, returncode=1)
        cwd = Path("/tmp")
        process.communicate.side_effect = [
            TOOLS.subprocess.TimeoutExpired(cmd="deno", timeout=1),
            ("", ""),
        ]
        with mock.patch.object(TOOLS.subprocess, "Popen", return_value=process), \
             mock.patch.object(TOOLS.os, "name", "nt"), \
             mock.patch.object(TOOLS.subprocess, "run") as taskkill:
            result = TOOLS._run_bridge_process(
                ["deno.exe"],
                cwd=cwd,
                env={},
                input_text="{}",
                timeout=1,
            )
        self.assertTrue(result[3])
        self.assertEqual(
            taskkill.call_args.args[0],
            ["taskkill", "/PID", "4321", "/T", "/F"],
        )

    def test_prompt_is_sent_over_stdin_not_argv(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            bridge = root / "examples/local-model-dogfood/src/hermes_bridge.ts"
            bridge.parent.mkdir(parents=True)
            bridge.write_text("// test", encoding="utf-8")
            (root / "out/dogfood/local-model-dogfood").mkdir(parents=True)
            with mock.patch.object(TOOLS, "_repo_root", return_value=root), \
                 mock.patch.object(TOOLS.shutil, "which", return_value="/usr/bin/deno"), \
                 mock.patch.object(TOOLS, "_record_trial"), \
                 mock.patch.object(TOOLS, "_run_bridge_process") as run:
                run.return_value = (
                    0,
                    '{"ok":true,"content":"READY"}',
                    "",
                    False,
                )
                result = json.loads(TOOLS.route({"prompt": "TOP SECRET TEST", "provider": "codex"}))
                self.assertTrue(result["ok"])
                args, kwargs = run.call_args
                self.assertNotIn("TOP SECRET TEST", args[0])
                self.assertIn("TOP SECRET TEST", kwargs["input_text"])
                self.assertEqual(kwargs["env"]["QUORUM_ROUTER_PROVIDER_LABEL"], "codex")
                self.assertEqual(kwargs["env"]["QUORUM_ROUTER_AUTH_MODE"], "wrapper")
                self.assertNotIn("QUORUM_ROUTER_PROVIDER_MODEL", kwargs["env"])
                self.assertNotIn("TELEGRAM_BOT_TOKEN", kwargs["env"])

    def test_trial_telemetry_never_stores_prompt_or_answer(self):
        with tempfile.TemporaryDirectory() as temp:
            log_path = Path(temp) / "trial.jsonl"
            with mock.patch.object(TOOLS, "TRIAL_LOG_PATH", log_path), \
                 mock.patch.object(TOOLS, "_load_config", return_value={}):
                TOOLS._record_trial({
                    "ok": True,
                    "operation": "route_once",
                    "provider": "OpenAI",
                    "model": "codex-cli",
                    "prompt": "DO NOT STORE",
                    "content": "DO NOT STORE ANSWER",
                    "candidates_called": 1,
                }, 42)
            raw = log_path.read_text(encoding="utf-8")
            self.assertNotIn("DO NOT STORE", raw)
            event = json.loads(raw)
            self.assertEqual(event["latency_ms"], 42)
            self.assertEqual(event["provider"], "OpenAI")


if __name__ == "__main__":
    unittest.main()
