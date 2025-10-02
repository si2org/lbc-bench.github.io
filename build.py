#!/usr/bin/env python3
import json
import pathlib
import shutil
import sys
from jsonschema import validate, ValidationError
from jinja2 import Environment, FileSystemLoader, select_autoescape


ROOT = pathlib.Path(__file__).parent
TEMPLATES = ROOT / "templates"
DIST = ROOT / "dist"

# Define the JSON schema for validation
LEADERBOARDS_SCHEMA = {
    "type": "object",
    "properties": {
        "leaderboards": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "results": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "logo": {
                                    "type": "array",
                                    "items": {"type": "string"}
                                },
                                "site": {"type": "string"},
                                "folder": {"type": "string"},
                                "cost": {"type": "number"},
                                "resolved_full": {"type": "number"},
                                "resolved_oss": {"type": "number"},
                                "date": {"type": "string"},
                                "logs": {"type": "string"},
                                "trajs": {"type": "string"},
                                "checked": {"type": "boolean"},
                                "tags": {
                                    "type": "array",
                                    "items": {"type": "string"}
                                },
                                "warning": {"type": ["string", "null"]}
                            },
                            "required": [
                                "name", "logo", "site", "folder", "cost", 
                                "resolved_full", "resolved_oss", "date", 
                                "logs", "trajs", "checked", "tags", "warning"
                            ],
                            "additionalProperties": False
                        }
                    }
                },
                "required": ["name", "results"],
                "additionalProperties": False
            }
        }
    },
    "required": ["leaderboards"],
    "additionalProperties": False
}

def validate_leaderboards_data(data):
    """Validate the leaderboards data against the schema"""
    try:
        validate(instance=data, schema=LEADERBOARDS_SCHEMA)
        print("✓ leaderboards.json format is valid")
        return True
    except ValidationError as e:
        print(f"✗ Validation error in leaderboards.json: {e.message}")
        print(f"Path: {' -> '.join(str(p) for p in e.path)}")
        return False
    except Exception as e:
        print(f"✗ Unexpected error during validation: {e}")
        return False

def get_pages():
    pages = {}
    pages_dir = TEMPLATES / "pages"
    for file in pages_dir.glob("*.html"):
        template_path = f"pages/{file.name}"
        output_file = file.name
        pages[template_path] = output_file
    return pages

PAGES = get_pages()


def main() -> None:
    # Load and validate data first
    try:
        with open(ROOT / "data/leaderboards.json", "r") as f:
            leaderboards = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        print(f"✗ Error loading leaderboards.json: {e}")
        sys.exit(1)
    
    # Validate the data format
    if not validate_leaderboards_data(leaderboards):
        print("Build failed due to invalid data format")
        sys.exit(1)
    
    # set up Jinja environment
    env = Environment(
        loader=FileSystemLoader(TEMPLATES),
        autoescape=select_autoescape(["html"])
    )
    
    # start fresh each run
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    
    # copy static assets
    if (ROOT / "css").exists():
        shutil.copytree(ROOT / "css", DIST / "css")
    if (ROOT / "img").exists():
        shutil.copytree(ROOT / "img", DIST / "img")
    if (ROOT / "js").exists():
        shutil.copytree(ROOT / "js", DIST / "js")
    if (ROOT / "favicon.ico").exists():
        shutil.copy(ROOT / "favicon.ico", DIST / "favicon.ico")
    if (ROOT / "CNAME").exists():
        shutil.copy(ROOT / "CNAME", DIST / "CNAME")
    else:
        raise FileNotFoundError("CNAME file not found. Please create a CNAME file in the root directory.")
    
    # load data
    with open(ROOT / "data/leaderboards.json", "r") as f:
        leaderboards = json.load(f)
    with open(ROOT / "data/press.json", "r") as f:
        press = json.load(f)
        press = sorted(press, key=lambda x: x["date"], reverse=True)
    
    # Collect tags per leaderboard and global tags
    leaderboard_tags = {}
    all_tags = set()
    
    for leaderboard in leaderboards["leaderboards"] if isinstance(leaderboards, dict) else leaderboards:
        leaderboard_name = leaderboard["name"]
        leaderboard_tags[leaderboard_name] = set()
        
        for entry in leaderboard["results"]:
            if "tags" in entry and entry["tags"]:
                entry_tags = entry["tags"]
                leaderboard_tags[leaderboard_name].update(entry_tags)
                all_tags.update(entry_tags)
    
    # Convert sets to sorted lists for JSON serialization
    for leaderboard_name in leaderboard_tags:
        leaderboard_tags[leaderboard_name] = sorted(list(leaderboard_tags[leaderboard_name]))
    all_tags = sorted(list(all_tags))
    
    # render all pages
    for tpl_name, out_name in PAGES.items():
        tpl = env.get_template(tpl_name)
        html = tpl.render(
            title="LBC-bench", 
            leaderboards=leaderboards["leaderboards"] if isinstance(leaderboards, dict) else leaderboards,
            press=press,
            all_tags=all_tags,  # Keep for backward compatibility
            leaderboard_tags=leaderboard_tags,  # New per-leaderboard tags
        )
        (DIST / out_name).write_text(html)
        print(f"built {out_name}")
    
    print("All pages generated successfully!")


if __name__ == "__main__":
    main()
