#!/usr/bin/env python3
"""Build launcher / Play listing icons from the live Play Store shopping-bag art."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
MASTER = Path("/tmp/play-icons/og-s512.png")
RED = (230, 37, 31, 255)
DENSITIES = {
    "mdpi": 1,
    "hdpi": 2,
    "xhdpi": 3,
    "xxhdpi": 4,
    "xxxhdpi": 5,
}


def clean_master(src: Path) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    pixels = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r < 28 and g < 28 and b < 28:
                pixels[x, y] = RED
    return im


def fit_square(im: Image.Image, size: int) -> Image.Image:
    return im.resize((size, size), Image.Resampling.LANCZOS)


def circle_mask(im: Image.Image) -> Image.Image:
    size = im.size[0]
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    out.paste(im, (0, 0))
    out.putalpha(mask)
    return out


def rounded_preview(im: Image.Image, size: int = 512, radius: int = 96) -> Image.Image:
    square = fit_square(im, size)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(square, (0, 0))
    out.putalpha(mask)
    return out


def save(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG")


def main() -> None:
    master = clean_master(MASTER)
    listing = ROOT / "play-store" / "listing-assets"
    res = ROOT / "play-store" / "android-twa" / "app" / "src" / "main" / "res"
    public_icons = ROOT / "public" / "icons"

    save(fit_square(master, 512), listing / "play-icon-512.png")
    save(rounded_preview(master), listing / "icon-preview-rounded.png")
    save(fit_square(master, 512), public_icons / "icon-512.png")
    save(fit_square(master, 192), public_icons / "icon-192.png")
    save(fit_square(master, 512), res / "drawable" / "splash.png")

    for name, scale in DENSITIES.items():
        folder = res / f"mipmap-{name}"
        launcher = 48 * scale
        foreground = 108 * scale
        square = fit_square(master, launcher)
        save(square, folder / "ic_launcher.png")
        save(circle_mask(square), folder / "ic_launcher_round.png")
        save(fit_square(master, foreground), folder / "ic_launcher_foreground.png")

    evidence = Path("/tmp/play-icons/evidence")
    evidence.mkdir(parents=True, exist_ok=True)
    save(fit_square(master, 512), evidence / "after_square_bag.png")
    save(circle_mask(fit_square(master, 512)), evidence / "after_round_bag.png")
    save(rounded_preview(master), evidence / "after_play_rounded_bag.png")
    print("icons generated")


if __name__ == "__main__":
    main()
