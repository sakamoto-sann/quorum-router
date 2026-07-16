from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("extract-github-sbom.py")
SPEC = importlib.util.spec_from_file_location("extract_github_sbom", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ExtractGithubSbomTests(unittest.TestCase):
    def valid_response(self) -> dict[str, object]:
        return {
            "sbom": {
                "SPDXID": "SPDXRef-DOCUMENT",
                "spdxVersion": "SPDX-2.3",
                "dataLicense": "CC0-1.0",
                "name": "com.github.sakamoto-sann/quorum-router",
                "documentNamespace": "https://spdx.org/spdxdocs/protobom/fixture-id",
                "creationInfo": {"created": "2026-07-17T00:00:00Z"},
                "packages": [
                    {
                        "SPDXID": "SPDXRef-github-repository-dynamic",
                        "name": "com.github.sakamoto-sann/quorum-router",
                        "externalRefs": [
                            {
                                "referenceCategory": "PACKAGE-MANAGER",
                                "referenceType": "purl",
                                "referenceLocator": "pkg:github/sakamoto-sann/quorum-router@main",
                            }
                        ],
                    }
                ],
                "relationships": [
                    {
                        "relationshipType": "DESCRIBES",
                        "spdxElementId": "SPDXRef-DOCUMENT",
                        "relatedSpdxElement": "SPDXRef-github-repository-dynamic",
                    }
                ],
            }
        }

    def write_response(self, directory: Path, value: object) -> Path:
        path = directory / "response.json"
        path.write_text(json.dumps(value))
        return path

    def test_extracts_only_validated_spdx_document(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            response = self.write_response(directory, self.valid_response())
            output = directory / "output.json"
            MODULE.extract(response, output, "sakamoto-sann/quorum-router")
            document = json.loads(output.read_text())
        self.assertEqual(document["SPDXID"], "SPDXRef-DOCUMENT")
        self.assertNotIn("sbom", document)

    def test_rejects_extra_wrapper_fields_and_wrong_repository(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            value = self.valid_response()
            value["unexpected"] = "not allowed"
            response = self.write_response(directory, value)
            with self.assertRaises(ValueError):
                MODULE.extract(
                    response,
                    directory / "output.json",
                    "sakamoto-sann/quorum-router",
                )

        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            response = self.write_response(directory, self.valid_response())
            with self.assertRaises(ValueError):
                MODULE.extract(response, directory / "output.json", "other/repo")

        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            response_value = self.valid_response()
            response_value["sbom"]["name"] = (  # type: ignore[index]
                "evil-sakamoto-sann/quorum-router"
            )
            response = self.write_response(directory, response_value)
            with self.assertRaises(ValueError):
                MODULE.extract(
                    response,
                    directory / "output.json",
                    "sakamoto-sann/quorum-router",
                )

    def test_rejects_empty_packages_and_non_spdx_versions(self) -> None:
        for field, value in (("packages", []), ("spdxVersion", "CycloneDX-1.6")):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as tmp:
                directory = Path(tmp)
                response_value = self.valid_response()
                response_value["sbom"][field] = value  # type: ignore[index]
                response = self.write_response(directory, response_value)
                with self.assertRaises(ValueError):
                    MODULE.extract(
                        response,
                        directory / "output.json",
                        "sakamoto-sann/quorum-router",
                    )


if __name__ == "__main__":
    unittest.main()
