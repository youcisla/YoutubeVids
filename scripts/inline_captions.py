#!/usr/bin/env python3
"""
Inline the captions JSON into the Hyperframes composition HTML.
Replaces the CAPTIONS_JSON_PLACEHOLDER token with the actual data.
"""
import json, os, sys

base = r"C:\Users\Y.CHEHBOUB\workspace\edu-channel"
episodes = [
    "channel-a/phone-orientation",
    "channel-b/what-is-a-robot",
]

for slug in episodes:
    ep_dir = os.path.join(base, slug)
    html_path = os.path.join(ep_dir, "index.html")
    captions_path = os.path.join(ep_dir, "captions.json")

    with open(html_path) as f:
        html = f.read()
    with open(captions_path) as f:
        captions = json.load(f)

    # Inject the JSON as a `const captions = {...};` assignment
    # right before the `window.__timelines["main"] = tl;` line
    json_str = json.dumps(captions)
    replacement = f"const captions = {json_str};"
    # Replace the placeholder line
    new_html = html.replace("const captions = CAPTIONS_JSON_PLACEHOLDER;", replacement)

    if new_html == html:
        print(f"WARNING: placeholder not found in {slug}")
        continue

    with open(html_path, "w") as f:
        f.write(new_html)
    print(f"OK {slug}: inlined {len(captions['cues'])} cues")