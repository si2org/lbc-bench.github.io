# Contributing to LBC Benchmark Leaderboard

## Overview
This guide explains how to add or update benchmark results in the LBC leaderboard by submitting changes to `data/leaderboards.json`.

## Prerequisites
- GitHub account
- Git installed locally
- Familiarity with JSON syntax
- Basic understanding of GitHub fork/PR workflow

## Steps to Contribute

### 1. Fork and Clone
```bash
# Fork the repository via GitHub web UI, then:
git clone https://github.com/YOUR_GITHUB_USERNAME/lbc-bench.github.io.git
cd lbc-bench.github.io
```

### 2. Create a Branch
```bash
git checkout -b add-model-results
# Use a descriptive branch name
```

### 3. Add Model's Logo (if needed)
If model organization's logo isn't already in `./img/`, add it:
```bash
cp model-logo.png ./img/
```

### 4. Edit `data/leaderboards.json`

Locate the appropriate leaderboard section:
- `code-generation-limited-context`
- `code-comprehension`  
- `code-generation-heavy-context`

Add your entry to the `results` array:
```json
{
    "name": "model-name",
    "logo": ["./img/model-logo.png"],
    "site": "https://your-organization-site",
    "folder": "",
    "cost": 0.07,
    "resolved_full": 29.46,
    "resolved_oss": 40.81,
    "date": "2025-11-30",
    "logs": "",
    "trajs": "",
    "checked": false,
    "release": "1.0.2",
    "tags": [
        "Open Source Tool: tool-name",
        "Commercial Tool: tool-name",
        "Model: model-name",
        "Org: your-org",
        "Evaluation style: non-agentic",
        "Single turn: true"
    ],
    "warning": null
}
```

#### Field Descriptions
| Field | Description | Notes |
|-------|-------------|-------|
| `name` | Model name | Required |
| `logo` | Logo path array | Use existing or add new to `./img/` |
| `site` | Organization URL | Who ran the benchmark |
| `cost` | Average cost per test in USD | Numeric value |
| `resolved_full` | Pass rate (all datasets, OSS and commercial simulators) | Percentage |
| `resolved_oss` | Pass rate (OSS simulator only) | Percentage |
| `date` | Run date | Format: YYYY-MM-DD |
| `checked` | Validation status | Set to `false` for new submissions |
| `release` | Benchmark version | Current release number |
| `tags` |  properties (filterable) | Follow format shown above |
| `folder`, `logs`, `trajs` | Future use | Leave as empty strings for now |
| `warning` | Future use | Set to `null` for now |

### 5. Validate JSON Syntax
Ensure your JSON is valid. Use any JSON validator or:
```bash
python -m json.tool data/leaderboards.json
```

### 6. Test Locally
```bash
make build && make serve
```
View at: http://localhost:8000

Verify your entry appears correctly in the leaderboard.

### 7. Commit and Push
```bash
git add data/leaderboards.json ./img/model-logo.png (only if a new image was added)
git commit -m "Add results for your-model-name"
git push origin add-model-results
```

### 8. Create Pull Request (PR)
1. Go to your fork on GitHub
2. Click "Contribute" -> "Open pull request"
3. Provide a clear description:
   - Model name
   - Leaderboard section
   - Brief summary of results
4. Submit PR

## Guidelines

**DO:**
- Validate JSON syntax before submitting
- Test locally before creating PR
- Use accurate benchmark results
- Follow the existing entry format
- Set `checked: false` for new submissions

**DON'T:**
- Modify other entries without justification
- Submit without local testing
- Use invalid JSON syntax
- Omit required fields

## Review Process
- PRs are reviewed by the repository owner (Si2)
- Validation may take time
- You may be asked for clarifications or corrections
- Approved entries will be merged to main branch

## Questions?
Open an issue in the repository or contact Si2.
