import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock


TOOLS_PATH = Path(__file__).resolve().parents[1] / "tools.py"
SPEC = importlib.util.spec_from_file_location("fusion_router_tools", TOOLS_PATH)
assert SPEC and SPEC.loader
TOOLS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(TOOLS)


class FusionRouterToolsTest(unittest.TestCase):
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
                 mock.patch.object(TOOLS.subprocess, "run") as run:
                run.return_value = mock.Mock(
                    stdout='{"ok":true,"content":"READY"}',
                    stderr="",
                    returncode=0,
                )
                result = json.loads(TOOLS.route({"prompt": "TOP SECRET TEST", "provider": "codex"}))
                self.assertTrue(result["ok"])
                args, kwargs = run.call_args
                self.assertNotIn("TOP SECRET TEST", args[0])
                self.assertIn("TOP SECRET TEST", kwargs["input"])
                self.assertEqual(kwargs["env"]["FUSION_ROUTER_PROVIDER_LABEL"], "codex")
                self.assertEqual(kwargs["env"]["FUSION_ROUTER_AUTH_MODE"], "wrapper")
                self.assertNotIn("FUSION_ROUTER_PROVIDER_MODEL", kwargs["env"])
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
