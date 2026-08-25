# Contributing to LBC Benchmark Leaderboard

## Overview

This guide explains how to add or update benchmark results on the LBC leaderboard by editing `data/leaderboards.json` and opening a pull request.

## Prerequisites

- GitHub account
- Git installed locally
- Python 3
- Familiarity with JSON and the GitHub fork/PR workflow
- It is **highly recommended** to run 5 samples (turns) for non-agentic evaluations, while one sample is sufficient for agentic evaluations. A marker on the leaderboard indicates fewer than 5 samples, where applicable.
- Strongly preferred: provide a CVDP evaluation `work*` directory (it must contain `composite_report.txt`) so `scripts/pack_logs.py` can pack your logs and trajectories into a uniform format. A marker on the leaderboard indicates non-standard log or trajectory submissions.

## Workflow at a glance

1. Fork, clone, and create a branch
2. Add an organization logo if needed
3. Add your result entry to `data/leaderboards.json`
4. Validate the JSON
5. Pack evaluation logs and hand them off for Hugging Face upload
6. Test the site locally
7. Commit, push, and open a PR

---

## 1. Fork, clone, and branch

```bash
# Fork the repository via the GitHub web UI, then:
git clone https://github.com/YOUR_GITHUB_USERNAME/lbc-bench.github.io.git
cd lbc-bench.github.io
git checkout -b add-model-results   # use a descriptive branch name
```

## 2. Add an organization logo (if needed)

If the model organization's logo is not already under `./img/`, add it:

```bash
cp model-logo.png ./img/
```

## 3. Edit the leaderboard

### Choose the section

Add your object to the `results` array of the matching leaderboard in `data/leaderboards.json`:

- `code-generation-limited-context`
- `code-comprehension`
- `code-generation-heavy-context`

### Create a unique `id`

Generate a fresh GUID for every new entry before you add it. `scripts/pack_logs.py` looks up rows by this `id`, and duplicate IDs will fail.

```bash
python -c "import uuid; print(uuid.uuid4())"
```

or, if available:

```bash
uuidgen
```

### Example entry

```json
{
    "id": "6ff8fa6c-3b75-4edd-b7ae-2a7838b5f999",
    "name": "model-name",
    "logo": ["./img/model-logo.png"],
    "site": "https://your-organization-site",
    "folder": "",
    "cost": 0.07,
    "resolved_full": 29.46,
    "resolved_oss": 40.81,
    "date": "2025-11-30",
    "logs/trajs": "",
    "notes": "Tokens used: XXXX\nModel snapshot: XXXX",
    "checked": false,
    "release": "1.1.0",
    "tags": [
        "Open Source Tool: tool-name",
        "Commercial Tool: tool-name",
        "Model: model-name",
        "Agent: agent-name",
        "Org: model-organization",
        "Evaluation style: non-agentic",
        "Single turn: true"
    ]
}
```

Leave `"logs/trajs"` empty for now if you will fill it with `pack_logs.py` in the next section. Set `"checked": false` for new submissions.

**Notes:** You should fill `notes` with run details (token usage, runtime, model/agent info, sample count, and so on). Use `\n` for line breaks.

### Field reference

| Field | Description | Notes |
|-------|-------------|-------|
| `id` | Unique GUID for this result | Required. Create a fresh GUID for each new entry |
| `name` | Model name | Required |
| `logo` | Paths to organization logo image(s) | Use an existing file under `./img/` or add a new one |
| `site` | Organization URL | Who ran the benchmark |
| `cost` | Average cost per test in USD | If it costs `$C` to run 5 samples across 800 tests, use `C/(5 × 800)`. Use `null` if cost is unavailable |
| `resolved_full` | Pass rate<sup>&dagger;</sup> | Percentage — use `null` if a commercial simulator was unavailable |
| `resolved_oss` | Pass rate<sup>&Dagger;</sup> | Percentage |
| `date` | Run date | `YYYY-MM-DD` |
| `logs/trajs` | URL to logs and trajectories | Usually filled by `scripts/pack_logs.py` |
| `checked` | Si2 verification flag | Must be `false` for new submissions |
| `release` | Benchmark version | Current release number |
| `tags` | Filterable properties | Follow the example above; include `Model:` and `Agent:` |
| `notes` | Detailed run information | Provide model/agent information, token counts, sample size, runtime, and any other relevant metadata to help interpret the results. |

<sup>†</sup> Pass rate over **open-source and commercial** simulator runs: (Total Passed Problems / Total Attempted Problems) from the “Overall Problem Statistics” table in each evaluated report. Use `null` if commercial simulator results are unavailable.<br>
<sup>‡</sup> Pass rate over **open-source (OSS) only** simulator runs: same formula and table, OSS datasets only.

## 4. Validate JSON

Validate right after editing so the new `id` exists and the file is well-formed before you run `pack_logs.py`:

```bash
python -m json.tool data/leaderboards.json
```

## 5. Attach evaluation logs

This step updates `logs/trajs` in your JSON and prepares an upload tree. The packed files themselves are **not** committed in the PR; send them to Si2 for Hugging Face upload.

`logs/trajs` is the JSON field that stores the public URL to the evaluation logs and trajectories once upload is complete.

After your entry exists in `data/leaderboards.json`, run:

```bash
python scripts/pack_logs.py -p /path/to/work_dir -i 6ff8fa6c-3b75-4edd-b7ae-2a7838b5f999
# Optional: preview without writing
python scripts/pack_logs.py -p /path/to/work_dir -i 6ff8fa6c-3b75-4edd-b7ae-2a7838b5f999 --dry-run
```

- `-p` is the CVDP evaluation `work*` directory (must contain `composite_report.txt`).
- `-i` / `--id` must match exactly one object `id` in `data/leaderboards.json`.
- IDs must be globally unique (the script errors on duplicates or no match).
- If `logs/trajs` is empty, the script sets it to a Hugging Face URL ending with that GUID. If it is already set, it is left unchanged.
- Output goes under `./upload/<GUID>/` by default (`-u` to override). That tree holds `README.md`, the dataset-named folder, `composite_report.txt`, and `logs.tgz`.
- `--dry-run` prints the planned paths and JSON update without writing files.

Contact Ali Sadigh (ali dot sadigh at si2 dot org) with the location of your `upload` data so the logs can be inspected and uploaded to Hugging Face.

## 6. Test locally

```bash
make build && make serve
```

Open http://localhost:8000 and confirm your entry appears correctly on the leaderboard.

## 7. Commit, push, and open a PR

```bash
git add data/leaderboards.json
# also add ./img/model-logo.png if you added a new logo
git commit -m "Add results for your-model-name"
git push origin add-model-results
```

Then on GitHub:

1. Open a pull request from your fork
2. Describe the model name, leaderboard section, and a short summary of the results
3. Submit the PR

Do not commit the `./upload/` tree unless Si2 asks you to.

## Guidelines

**Do**

- Validate JSON and test locally before opening a PR
- Use accurate results and the existing entry format
- Keep `checked: false` on new submissions

**Don't**

- Change other entries without a clear reason
- Omit required fields or submit invalid JSON

## Review process

- PRs are reviewed by Si2
- You may be asked for clarifications or corrections
- Approved entries are merged to `main`
- After review, Si2 uploads the packed evaluation logs to Hugging Face

## Questions?

Open an issue in the repository or contact Si2.
