"""Refresh the checked-in public PhoenX video index from both YouTube channels.

Requires yt-dlp to be installed. Only entries exposed on each public /videos
listing are included; videos are embedded on the site only after a visitor
chooses to play them.
"""

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "content" / "youtube-videos.json"
CHANNELS = [
    {
        "url": "https://www.youtube.com/@NikolasPhoenx/videos",
        "label": "Nikolas Phoenx",
    },
    {
        "url": "https://www.youtube.com/@PhoenX_Music/videos",
        "label": "PhoenX Music",
    },
]
VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
HIDDEN_TITLES = {"private video", "deleted video", "[private video]", "[deleted video]"}


def main():
    videos = []
    seen = set()
    for channel in CHANNELS:
        result = subprocess.run(
            [
                "yt-dlp", "--no-warnings", "--no-update", "--flat-playlist",
                "--dump-single-json", "--skip-download", channel["url"],
            ],
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        listing = json.loads(result.stdout)
        channel_count = 0
        for entry in listing.get("entries") or []:
            video_id = entry.get("id") or ""
            title = (entry.get("title") or "").strip()
            availability = (entry.get("availability") or "").lower()
            if not VIDEO_ID.fullmatch(video_id) or not title:
                continue
            if title.lower() in HIDDEN_TITLES or availability in {"private", "premium_only"}:
                continue
            if video_id in seen:
                continue
            seen.add(video_id)
            videos.append(
                {
                    "id": video_id,
                    "title": title,
                    "channel": channel["label"],
                    "channel_url": channel["url"],
                    "video_url": f"https://www.youtube.com/watch?v={video_id}",
                }
            )
            channel_count += 1
        print(f"{channel['label']}: {channel_count} public listing entries")
    if not videos:
        raise SystemExit("No public videos found; refusing to overwrite the existing index.")
    OUTPUT.write_text(json.dumps(videos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(videos)} unique public videos to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
