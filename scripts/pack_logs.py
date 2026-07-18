#!/usr/bin/env python3
"""Pack one CVDP work directory and update a single leaderboard logs/trajs link.

Reads composite_report.txt from -p for dataset name and (by default) Model/Agent,
maps dataset name -> leaderboard section, matches the model name to a result "name",
creates/reuses a GUID-named directory under --upload-dir, writes README.md, copies the report,
and packs logs.tgz. Updates data/leaderboards.json in place.

-m is optional: when omitted, the model comes from the report's Model/Agent line.
Use -m to override when that value does not match the JSON "name" (e.g. effort
variants like "gpt-5.2 medium reasoning").
-u/--upload-dir is optional for output and defaults to <PWD>/upload.

Examples:
  python scripts/pack_logs.py -p /path/to/work_dir
  python scripts/pack_logs.py -p /path/to/work_dir -m "gpt-5.2 medium reasoning"
  python scripts/pack_logs.py -p /path/to/work_dir --dry-run
  python scripts/pack_logs.py -p /path/to/work_dir -u /tmp/upload
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import tarfile
import uuid
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
LEADERBOARDS_JSON = SCRIPT_DIR.parent / "data" / "leaderboards.json"

HF_BASE = "https://huggingface.co/buckets/si2admin/lbc-bench-storage/tree/"
LOGS_FIELD = "logs/trajs"

DATASET_TO_CATEGORY = {
    "agentic_code_generation_commercial": "code-generation-limited-context",
    "agentic_code_generation_no_commercial": "code-generation-limited-context",
    "nonagentic_code_generation_commercial": "code-generation-limited-context",
    "nonagentic_code_generation_no_commercial": "code-generation-limited-context",
    "nonagentic_code_comprehension": "code-comprehension",
}

# Filename stem after stripping .jsonl / .copilot_transformed.jsonl:
#   cvdp_v1.0.2_agentic_code_generation_no_commercial
DATASET_FROM_STEM = re.compile(r"^cvdp_v\d+\.\d+\.\d+_(.+)$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Pack one work directory and update its leaderboard logs/trajs link."
    )
    parser.add_argument(
        "-m",
        "--model",
        default=None,
        help=(
            "exact leaderboard result name (overrides Model/Agent from "
            "composite_report.txt)"
        ),
    )
    parser.add_argument(
        "-p",
        "--work-dir",
        required=True,
        type=Path,
        help="path to the CVDP work directory to pack",
    )
    parser.add_argument(
        "-u",
        "--upload-dir",
        type=Path,
        default=Path("./upload"),
        help="upload root directory (default: ./upload relative to PWD)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print planned actions without writing files or updating JSON",
    )
    return parser.parse_args()


def find_dataset_line(report_path: Path) -> str:
    for line in report_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("Dataset:"):
            return line[len("Dataset:") :].strip()
    raise SystemExit(f"error: no Dataset: line in {report_path}")


def find_model_agent_line(report_path: Path) -> str:
    for line in report_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("Model/Agent:"):
            value = line[len("Model/Agent:") :].strip()
            if not value:
                raise SystemExit(f"error: empty Model/Agent: line in {report_path}")
            return value
    raise SystemExit(f"error: no Model/Agent: line in {report_path}")


def dataset_name_from_path(dataset_path: str) -> str:
    """
    From .../cvdp_v1.0.2_<dataset>[.copilot_transformed].jsonl extract <dataset>.
    """
    name = Path(dataset_path).name
    for suffix in (".copilot_transformed.jsonl", ".jsonl"):
        if name.endswith(suffix):
            name = name[: -len(suffix)]
            break
    match = DATASET_FROM_STEM.match(name)
    if not match:
        raise SystemExit(
            f"error: cannot extract dataset name from {dataset_path!r} "
            f"(stem={name!r})"
        )
    return match.group(1)


def section_results(data: dict, section_name: str) -> list[dict]:
    for board in data.get("leaderboards", []):
        if board.get("name") == section_name:
            return board["results"]
    raise SystemExit(f"error: section {section_name!r} not found in {LEADERBOARDS_JSON}")


def find_unique_result(results: list[dict], model: str) -> dict:
    matches = [item for item in results if str(item.get("name", "")).strip() == model]
    if not matches:
        raise SystemExit(f"error: no name match for model {model!r}")
    if len(matches) > 1:
        raise SystemExit(f"error: multiple name matches for model {model!r}")
    return matches[0]


def guid_from_existing_url(url: str) -> str:
    guid = url.rstrip("/").rsplit("/", 1)[-1]
    if not guid:
        raise SystemExit(f"error: could not extract GUID from existing {LOGS_FIELD}: {url!r}")
    return guid


def results_array_span(raw: str, section_name: str) -> tuple[int, int]:
    """Return [start, end) indexes of the results array contents for a section."""
    header = re.search(
        rf'"name"\s*:\s*"{re.escape(section_name)}"\s*,\s*"results"\s*:\s*\[',
        raw,
    )
    if not header:
        raise SystemExit(f"error: could not locate results array for {section_name!r}")
    start = header.end()
    depth = 1
    i = start
    while i < len(raw) and depth:
        ch = raw[i]
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
        elif ch == '"':
            i += 1
            while i < len(raw):
                if raw[i] == "\\":
                    i += 2
                    continue
                if raw[i] == '"':
                    break
                i += 1
        i += 1
    if depth:
        raise SystemExit(f"error: unclosed results array for {section_name!r}")
    return start, i - 1


def set_logs_trajs_preserving_format(
    raw: str, section_name: str, exact_name: str, new_url: str
) -> str:
    """Replace only an empty logs/trajs value for one result; keep other text."""
    arr_start, arr_end = results_array_span(raw, section_name)
    section = raw[arr_start:arr_end]
    name_json = json.dumps(exact_name)
    pattern = re.compile(
        rf'(\{{[^{{}}]*"name"\s*:\s*{re.escape(name_json)}[^{{}}]*"{re.escape(LOGS_FIELD)}"\s*:\s*)""',
        re.DOTALL,
    )
    match = pattern.search(section)
    if not match:
        raise SystemExit(
            f"error: could not surgically update empty {LOGS_FIELD} for "
            f"{section_name}/{exact_name!r}"
        )
    new_section = (
        section[: match.start()]
        + match.group(1)
        + json.dumps(new_url)
        + section[match.end() :]
    )
    return raw[:arr_start] + new_section + raw[arr_end:]


def pack_contents(src_dir: Path, dest_tgz: Path) -> None:
    """Tar+gzip the contents of src_dir into dest_tgz (not src_dir itself)."""
    if not src_dir.is_dir():
        raise FileNotFoundError(f"source directory does not exist: {src_dir}")
    dest_tgz.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(dest_tgz, "w:gz") as tar:
        for entry in sorted(src_dir.iterdir()):
            tar.add(entry, arcname=entry.name)


def readme_text(item: dict) -> str:
    return "```json\n" + json.dumps(item, indent=2, ensure_ascii=False) + "\n```\n"


def main() -> None:
    args = parse_args()
    work_dir = args.work_dir.expanduser().resolve()
    upload_root = args.upload_dir.expanduser()
    if not upload_root.is_absolute():
        upload_root = (Path.cwd() / upload_root).resolve()

    report = work_dir / "composite_report.txt"
    if not report.is_file():
        raise SystemExit(f"error: missing composite_report.txt in {work_dir}")

    if not LEADERBOARDS_JSON.is_file():
        raise SystemExit(f"error: leaderboards file not found: {LEADERBOARDS_JSON}")

    dataset_path = find_dataset_line(report)
    dataset = dataset_name_from_path(dataset_path)
    if dataset not in DATASET_TO_CATEGORY:
        raise SystemExit(
            f"error: dataset {dataset!r} not in known map "
            f"(from {dataset_path!r})"
        )
    category = DATASET_TO_CATEGORY[dataset]

    report_model = find_model_agent_line(report)
    if args.model is not None:
        model = args.model
        model_source = "-m"
    else:
        model = report_model
        model_source = "Model/Agent"

    raw = LEADERBOARDS_JSON.read_text(encoding="utf-8")
    data = json.loads(raw)
    results = section_results(data, category)
    item = find_unique_result(results, model)

    current = item.get(LOGS_FIELD, "")
    if current == "":
        guid = str(uuid.uuid4())
        url_was_empty = True
    else:
        guid = guid_from_existing_url(str(current))
        url_was_empty = False

    hf_url = f"{HF_BASE.rstrip('/')}/{guid}"
    guid_dir = upload_root / guid
    logs_dir = guid_dir / dataset
    readme_path = guid_dir / "README.md"
    dest_tgz = logs_dir / "logs.tgz"
    dest_report = logs_dir / "composite_report.txt"

    if logs_dir.exists():
        raise SystemExit(f"error: dataset folder already exists: {logs_dir}")

    print(f"work_dir:     {work_dir}")
    print(f"dataset:      {dataset} -> {category}")
    print(f"model:        {model} (from {model_source})")
    if model_source == "-m" and model != report_model:
        print(f"report model: {report_model} (overridden)")
    print(f"GUID:         {guid} ({'new' if url_was_empty else 'from existing URL'})")
    print(f"HF URL:       {hf_url}")
    print(f"guid_dir:     {guid_dir}")
    print(f"logs_dir:     {logs_dir}")
    print(f"README:       {readme_path}")
    print(f"logs.tgz:     {dest_tgz}")
    print(f"report:       {dest_report}")
    print(
        f"json:         {LEADERBOARDS_JSON} "
        f"({'set logs/trajs' if url_was_empty else 'leave logs/trajs'})"
    )

    if args.dry_run:
        print("dry-run: no files written")
        return

    # 1. Update logs/trajs in place if empty.
    if url_was_empty:
        raw = set_logs_trajs_preserving_format(raw, category, item["name"], hf_url)
        item[LOGS_FIELD] = hf_url
        LEADERBOARDS_JSON.write_text(raw, encoding="utf-8")
        print(f"set {category}/{model}: {hf_url}")
    else:
        if str(current) != hf_url:
            raise SystemExit(
                f"error: existing {LOGS_FIELD} does not match expected HF URL\n"
                f"  existing: {current}\n"
                f"  expected: {hf_url}"
            )
        print(f"ok  {category}/{model}: already set")

    # 2-5. Upload tree: README, dataset dir, report copy, logs.tgz.
    guid_dir.mkdir(parents=True, exist_ok=True)
    readme_path.write_text(readme_text(item), encoding="utf-8")
    print(f"wrote {readme_path}")

    logs_dir.mkdir(parents=False, exist_ok=False)
    shutil.copy2(report, dest_report)
    print(f"copied {report} -> {dest_report}")

    pack_contents(work_dir, dest_tgz)
    print(f"packed {work_dir} -> {dest_tgz}")
    print("done")


if __name__ == "__main__":
    main()
