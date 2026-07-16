#!/usr/bin/env python3
"""Validate GitHub's SBOM response and extract the SPDX document."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

MAX_RESPONSE_BYTES = 10 * 1024 * 1024


def object_value(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def extract(response_path: Path, output_path: Path, repository: str) -> None:
    repository_parts = repository.split("/")
    if (
        len(repository_parts) != 2
        or any(not part or part in {".", ".."} for part in repository_parts)
    ):
        raise ValueError("repository must use owner/name form")
    size = response_path.stat().st_size
    if size <= 0 or size > MAX_RESPONSE_BYTES:
        raise ValueError("GitHub SBOM response size is outside the accepted bounds")

    response = object_value(json.loads(response_path.read_text()), "response")
    if set(response) != {"sbom"}:
        raise ValueError("GitHub SBOM response must contain only sbom")
    sbom = object_value(response["sbom"], "response.sbom")

    required = {
        "SPDXID",
        "spdxVersion",
        "dataLicense",
        "name",
        "documentNamespace",
        "creationInfo",
        "packages",
        "relationships",
    }
    missing = sorted(required - set(sbom))
    if missing:
        raise ValueError(f"SPDX document is missing required fields: {missing}")
    if sbom["SPDXID"] != "SPDXRef-DOCUMENT":
        raise ValueError("SPDX document has an unexpected SPDXID")
    if not isinstance(sbom["spdxVersion"], str) or not sbom["spdxVersion"].startswith(
        "SPDX-2."
    ):
        raise ValueError("SPDX document must use an SPDX 2.x version")
    if sbom["dataLicense"] != "CC0-1.0":
        raise ValueError("SPDX document has an unexpected data license")
    if not isinstance(sbom["packages"], list) or not sbom["packages"]:
        raise ValueError("SPDX document must contain at least one package")
    if not isinstance(sbom["relationships"], list):
        raise ValueError("SPDX relationships must be an array")
    accepted_names = {repository.casefold(), f"com.github.{repository}".casefold()}
    document_name = sbom["name"]
    if not isinstance(document_name, str) or document_name.casefold() not in accepted_names:
        raise ValueError("SPDX document name is not bound to this repository")

    namespace = sbom["documentNamespace"]
    if not isinstance(namespace, str):
        raise ValueError("SPDX document namespace must be a string")
    parsed_namespace = urlparse(namespace)
    namespace_parts = parsed_namespace.path.strip("/").split("/")
    if (
        parsed_namespace.scheme != "https"
        or parsed_namespace.netloc.lower() != "spdx.org"
        or parsed_namespace.params
        or parsed_namespace.query
        or parsed_namespace.fragment
        or len(namespace_parts) != 3
        or namespace_parts[:2] != ["spdxdocs", "protobom"]
        or not namespace_parts[2]
    ):
        raise ValueError("SPDX document namespace is not a GitHub protobom namespace")

    described_ids = {
        relationship.get("relatedSpdxElement")
        for relationship in sbom["relationships"]
        if isinstance(relationship, dict)
        and relationship.get("relationshipType") == "DESCRIBES"
        and relationship.get("spdxElementId") == "SPDXRef-DOCUMENT"
        and isinstance(relationship.get("relatedSpdxElement"), str)
    }
    if len(described_ids) != 1:
        raise ValueError("SPDX document must describe exactly one repository root")

    repository_packages = [
        package
        for package in sbom["packages"]
        if isinstance(package, dict)
        and package.get("SPDXID") in described_ids
        and isinstance(package.get("name"), str)
        and package["name"].casefold() in accepted_names
    ]
    if len(repository_packages) != 1:
        raise ValueError("SPDX document must contain one described repository package")
    root_package = repository_packages[0]
    external_refs = root_package.get("externalRefs")
    expected_purl_prefix = f"pkg:github/{repository}@".casefold()
    if not isinstance(external_refs, list) or not any(
        isinstance(reference, dict)
        and reference.get("referenceCategory") == "PACKAGE-MANAGER"
        and reference.get("referenceType") == "purl"
        and isinstance(reference.get("referenceLocator"), str)
        and reference["referenceLocator"].casefold().startswith(expected_purl_prefix)
        for reference in external_refs
    ):
        raise ValueError("SPDX repository package has no matching GitHub purl")

    rendered = json.dumps(sbom, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    output_path.write_text(rendered)


def main() -> int:
    if len(sys.argv) != 4:
        print(
            "usage: extract-github-sbom.py RESPONSE OUTPUT OWNER/REPOSITORY",
            file=sys.stderr,
        )
        return 2
    try:
        extract(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3])
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"SBOM extraction failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
