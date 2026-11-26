#!/usr/bin/env python3
"""Regenerate cover, portrait, Open Graph, press-download and icon images in src/assets/images and src/static.

Usage:
  python3 tools/make-images.py                          # sources in src/assets/images/source/
  python3 tools/make-images.py cover.jpg [portrait.jpg]  # other source files

Needs Google Chrome (headless) and Pillow. Run `npm run build` afterwards.
"""
import pathlib, shutil, subprocess, sys, tempfile
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMG = ROOT / "src/assets/images"
STATIC = ROOT / "src/static"
CHROME = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")


def shoot(html: pathlib.Path, out: pathlib.Path, w: int, h: int, scale: int = 1) -> None:
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--force-device-scale-factor={scale}",
                    f"--window-size={w},{h}", "--virtual-time-budget=3000", f"--screenshot={out}", html.as_uri()],
                   check=True, capture_output=True)


def save_set(img: Image.Image, name: str, widths) -> None:
    w, h = img.size
    for width in widths:
        r = img.resize((width, round(h * width / w)), Image.LANCZOS)
        r.save(IMG / f"{name}-{width}.webp", "WEBP", quality=82, method=6)
        r.save(IMG / f"{name}-{width}.jpg", "JPEG", quality=84, optimize=True, progressive=True)


def main() -> None:
    IMG.mkdir(parents=True, exist_ok=True)
    tmp = pathlib.Path(tempfile.mkdtemp())
    press = STATIC / "press"
    press.mkdir(parents=True, exist_ok=True)
    src = IMG / "source"
    cover = Image.open(sys.argv[1] if len(sys.argv) > 1 else src / "cover-real-1600x2560.jpg").convert("RGB")
    portrait = Image.open(sys.argv[2] if len(sys.argv) > 2 else src / "hemanth-portrait.jpg").convert("RGB")

    # Cover keeps its own aspect ratio (5:8 for the real cover).
    save_set(cover, "cover", (400, 800))
    cover.save(press / "the-autonomous-enterprise-cover.jpg", "JPEG", quality=90, optimize=True, progressive=True)
    save_set(portrait, "portrait", (480, 960))
    portrait.save(press / "hemanth-reganti-headshot.jpg", "JPEG", quality=92, optimize=True, progressive=True)

    cover.save(tmp / "cover-og.png")
    og_html = (ROOT / "tools/og-mock.html").read_text().replace("COVER_SRC", (tmp / "cover-og.png").as_uri())
    og_src = ROOT / "tools/.og-render.html"
    og_src.write_text(og_html)
    try:
        shoot(og_src, tmp / "og.png", 1200, 630)
    finally:
        og_src.unlink()
    Image.open(tmp / "og.png").convert("RGB").save(IMG / "og-image.jpg", "JPEG", quality=86, optimize=True, progressive=True)

    # Icons: the rising-bars mark (same geometry as favicon.svg, 32-unit grid).
    def mark(size: int, pad: float = 0.0) -> Image.Image:
        im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        s = size / 32
        d.rounded_rectangle((0, 0, size - 1, size - 1), radius=max(1, int(3 * s)), fill="#F2622E")
        inner = 1 - 2 * pad
        off = size * pad
        for x, y in ((5, 23), (9.5, 20), (14, 17), (18.5, 13), (23, 9)):
            d.rectangle((off + x * s * inner, off + y * s * inner, off + (x + 3) * s * inner, off + 27 * s * inner), fill="#141414")
        return im

    mark(180).save(STATIC / "apple-touch-icon.png", optimize=True)
    mark(192).save(IMG / "icon-192.png", optimize=True)
    mark(512).save(IMG / "icon-512.png", optimize=True)
    mark(512, pad=0.1).save(IMG / "icon-maskable-512.png", optimize=True)
    mark(64).save(STATIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("images written to", IMG, "and", STATIC)


if __name__ == "__main__":
    main()
