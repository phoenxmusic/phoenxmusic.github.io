"""Rasterize the authored PhoenX social-card SVG to a 1200x630 PNG.

Development-only helper. Requires Pillow, which is not a site-build dependency.
The SVG is the editable source; this script does not fetch external assets.
"""
from pathlib import Path
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SVG = ROOT / "assets" / "phoenx-social-card.svg"
PNG = ROOT / "assets" / "phoenx-social-card.png"
WIDTH, HEIGHT = 1200, 630

ET.parse(SVG)  # Refuse to render malformed source XML.
image = Image.new("RGB", (WIDTH, HEIGHT), "#08090d")
pixels = image.load()

# Deterministic charcoal/plum background and restrained ember bloom.
for y in range(HEIGHT):
    for x in range(WIDTH):
        diagonal = (x / WIDTH) * 0.58 + (y / HEIGHT) * 0.42
        base = (8 + int(14 * diagonal), 9 + int(5 * diagonal), 13 + int(7 * diagonal))
        dx, dy = (x - 1000) / 430, (y - 315) / 360
        glow = max(0.0, 1.0 - (dx * dx + dy * dy) ** 0.5) ** 2 * 0.22
        pixels[x, y] = (
            min(255, int(base[0] + 255 * glow)),
            min(255, int(base[1] + 91 * glow)),
            min(255, int(base[2] + 24 * glow)),
        )

draw = ImageDraw.Draw(image, "RGBA")
for radius, alpha in ((245, 58), (285, 40), (325, 28)):
    draw.ellipse((1000-radius, 315-radius, 1000+radius, 315+radius), outline=(255, 116, 38, alpha), width=2)

font_dir = Path(r"C:\Windows\Fonts")
def font(name, size):
    candidates = [font_dir / name, Path("/usr/share/fonts/truetype/dejavu") / name]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()

bold = font("arialbd.ttf", 112)
medium = font("arial.ttf", 28)
small = font("arial.ttf", 24)
footer = font("arial.ttf", 20)
micro = font("arial.ttf", 16)

draw.line((82, 112, 148, 112), fill=(255, 122, 36, 255), width=5)
draw.text((82, 212), "PHOENX", font=bold, fill="#f7f3ef", stroke_width=0)
draw.text((88, 278), "MUSIC ARCHIVE", font=medium, fill="#ff8a39", stroke_width=0)
draw.line((88, 355, 523, 355), fill=(243, 236, 229, 56), width=1)
draw.text((88, 384), "RELEASES  ·  STORIES  ·  VIDEOS", font=small, fill="#e7e0da")
draw.text((88, 530), "PHOENXMUSIC.GITHUB.IO", font=footer, fill="#bcb1aa")
draw.text((1118, 548), "INDEPENDENT MUSIC", font=micro, fill="#ff8a39", anchor="ra")

# A restrained waveform motif; all marks are original vector-like shapes.
wave = [(790,315),(814,315),(826,279),(844,351),(862,197),(882,363),(901,258),(918,300),(939,300),(960,315)]
draw.line(wave, fill=(255, 112, 34, 230), width=5, joint="curve")
for x1, x2 in ((824,860),(876,886),(904,940),(958,966),(984,1014)):
    draw.line((x1,395,x2,395), fill=(255, 112, 34, 145), width=3)

image.save(PNG, format="PNG", optimize=True)
with Image.open(PNG) as check:
    if check.size != (WIDTH, HEIGHT) or check.format != "PNG":
        raise SystemExit("Social card validation failed")
print(f"Generated {PNG.relative_to(ROOT)}: {WIDTH}x{HEIGHT}, {PNG.stat().st_size} bytes")
