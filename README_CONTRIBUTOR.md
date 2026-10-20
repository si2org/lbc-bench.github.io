# Contributing to LBC Benchmark Leaderboard

## Overview

This guide explains how to add or update benchmark results on the LBC leaderboard by editing `data/leaderboards.json` and opening a pull request.

## Prerequisites

- GitHub account
- Git installed locally
- Python 3
- Familiarity with JSON and the GitHub fork/PR workflow

## Recommendations

- For non-agentic evaluations, 5 samples (turns) are highly recommended. For agentic evaluations, a single sample is sufficient. Non-agentic submissions with fewer than 5 samples are marked accordingly on the leaderboard.
- It is also highly desirable that you provide your evaluation logs as proof of work. To do so, run `scripts/pack_logs.py` on all `work*` directories from your evaluation. Each `work*` directory must contain a `composite_report.txt` file so that `scripts/pack_logs.py` can package the logs in a uniform format. Submissions with non-standard logs or trajectories will be identified by a marker on the leaderboard.

## Workflow at a glance

1. Fork, clone, and create a branch
2. Add an organization logo if needed
3. Add your result entry to `data/leaderboards.json`
4. Validate the JSON
5. If available, pack the evaluation logs into `upload.tgz`, which can then be attached to your PR as a release asset
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

Generate a fresh GUID for every new entry's `id` field. `scripts/pack_logs.py` looks up rows by this `id`, and duplicate IDs will fail.

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
    "id": "244264cd-9fc4-49d7-be57-3bc5269ef57b",
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

**Notes:** It is highly recommended that you fill `notes` with run details (token usage, runtime, model/agent info, sample count, and so on). Use `\n` for line breaks.

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

Validate right after editing so the new `id` exists and the file is well-formed before you run `scripts/pack_logs.py` in the next step:

```bash
python -m json.tool data/leaderboards.json
```

## 5. Attach evaluation logs

Skip this step if no logs/trajectories are available to share.  This step updates the `logs/trajs` field in your JSON and creates a folder (`./upload` by default) consisting of the compressed contents of the CVDP work directories.  Upon a successful PR creation, this release asset will be copied to private storage for Si2 to examine and publish it.

`logs/trajs` is the JSON field that stores the public URL to the evaluation logs and trajectories once Si2 has published them.

After your entry has been added to `data/leaderboards.json`, run the following command once for each available CVDP dataset `work*` directory in the category for which you are submitting results. For example, the `Code Generation Limited Context` category currently contains four datasets, so the script should be run four times, each time pointing to a different dataset evaluation `work*` directory to pack everything in the `./upload` folder.

```bash
# Optional: preview without writing
python scripts/pack_logs.py -p /path/to/work_dir -i 244264cd-9fc4-49d7-be57-3bc5269ef57b --dry-run

python scripts/pack_logs.py -p /path/to/work_dir -i 244264cd-9fc4-49d7-be57-3bc5269ef57b
```

- `-p` is the CVDP evaluation `work*` directory (must contain `composite_report.txt`).
- `-i` / `--id` must match exactly one object `id` in `data/leaderboards.json`.
- IDs must be globally unique (the script errors on duplicates or no match).
- If `logs/trajs` is empty, the script sets it to a Hugging Face URL ending with that GUID. If it is already set, it is left unchanged.
- Output goes under `./upload/<GUID>/` by default (`-u` to override). That tree holds `README.md`, the dataset-named folder, `composite_report.txt`, and `logs.tgz`.
- `--dry-run` prints the planned paths and JSON update without writing files.

GitHub release assets must be uploaded as files, not directories. Therefore, package the `./upload` folder into a single archive file, such as `./upload.tgz` (or `./upload.zip`), using the following command:
```bash
tar -czf ./upload.tgz ./upload
(or zip -r ./upload.zip ./upload)
```

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

Then on the GitHub web interface (or using equivalent GitHub CLI commands):

1. If you are sharing your evaluation logs, publish `./upload.tgz` as the only binary asset in a GitHub release on your fork. To do this, navigate to the repository's `Releases` page, click Draft a new release, and upload `./upload.tgz` as the release asset. After the release is published, copy the release URL; you will provide this URL in your pull request in the next step.
GitHub automatically includes source code archives (.zip and .tar.gz) with every release. These files are created by GitHub and can be ignored. Only the uploaded `./upload.tgz` file will be used for result submission.
2. Open a pull request from your fork
3. Provide a brief summary of your results and include the release URL from the previous step, **as described in the pull-request template**. 
4. Submit the PR
5. After the previous step completes successfully, delete any previously created release asset, if applicable.

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
