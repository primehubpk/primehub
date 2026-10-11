#!/usr/bin/env python3
"""PrimeHub v10: small shopping bag / P using existing Play listing artwork.
Only Android launcher resources change, not the Play listing or splash.
Run before both debug and signed release Android builds. Requires Pillow.
"""
from pathlib import Path
import argparse
from collections import Counter
from PIL import Image, ImageDraw

SCALES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def isolate_white_bag(src: Image.Image) -> Image.Image:
    rgba = src.convert('RGBA')
    w, h = rgba.size
    alpha = Image.new('L', (w, h), 0)
    pixel_mask = bytearray(w * h)
    for i, (r, g, b, opacity) in enumerate(rgba.getdata()):
        if opacity > 120 and min(r, g, b) >= 185 and max(r, g, b) - min(r, g, b) < 70:
            pixel_mask[i] = 255
    alpha.putdata(pixel_mask)
    # Ignore white corners outside original red rounded square.
    for x in range(0, w, max(1, w // 64)):
        for y in (0, h - 1):
            if alpha.getpixel((x, y)):
                ImageDraw.floodfill(alpha, (x, y), 0)
    for y in range(0, h, max(1, h // 64)):
        for x in (0, w - 1):
            if alpha.getpixel((x, y)):
                ImageDraw.floodfill(alpha, (x, y), 0)
    bbox = alpha.getbbox()
    if bbox is None or bbox[2]-bbox[0] < w * .20 or bbox[3]-bbox[1] < h * .25:
        raise SystemExit('Cannot identify original Play listing white bag/P: STOP BUILD')
    center_x = (bbox[0]+bbox[2])/(2*w)
    center_y = (bbox[1]+bbox[3])/(2*h)
    if not (.35 < center_x < .65 and .30 < center_y < .70):
        raise SystemExit(f'Unexpected bag placement {bbox}: STOP BUILD')
    return alpha.crop(bbox)


def symbol_mask(mask: Image.Image, size: int, relative_width: float, relative_height: float) -> Image.Image:
    factor = min(size*relative_width/mask.width, size*relative_height/mask.height)
    dims = (max(1, round(mask.width*factor)), max(1, round(mask.height*factor)))
    resized = mask.resize(dims, Image.Resampling.LANCZOS)
    out = Image.new('L', (size, size), 0)
    out.paste(resized, ((size-dims[0])//2, (size-dims[1])//2))
    return out


def red_from_listing(src: Image.Image):
    tiny = src.convert('RGBA').resize((64,64), Image.Resampling.NEAREST)
    candidates = [(r,g,b) for r,g,b,a in tiny.getdata()
                  if a > 200 and r > g*1.8 and r > b*1.8 and r > 120 and g < 120 and b < 120]
    return Counter(candidates).most_common(1)[0][0] if candidates else (230,37,31)


def legacy_icon(size: int, mask: Image.Image, color):
    base = Image.new('RGBA', (size,size), (0,0,0,0))
    rounded = Image.new('L', (size,size), 0)
    ImageDraw.Draw(rounded).rounded_rectangle((0,0,size-1,size-1), radius=round(size*.20), fill=255)
    base.paste((*color,255), (0,0,size,size), rounded)
    symbol = Image.new('RGBA', (size,size), (255,255,255,0))
    symbol.putalpha(mask)
    return Image.alpha_composite(base, symbol)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--root',default=None)
    parser.add_argument('--source',default=None)
    parser.add_argument('--preview',default=None)
    args=parser.parse_args()
    root=Path(args.root) if args.root else Path(__file__).resolve().parents[3]
    source=Path(args.source) if args.source else root/'play-store/listing-assets/play-icon-512.png'
    art=Image.open(source).convert('RGBA')
    mask=isolate_white_bag(art)
    red=red_from_listing(art)
    res=root/'play-store/android-twa/app/src/main/res'
    for density, scale in SCALES.items():
        size=round(48*scale)
        folder=res/f'mipmap-{density}'
        folder.mkdir(parents=True,exist_ok=True)
        compact=symbol_mask(mask,size,.60,.68)
        icon=legacy_icon(size, compact, red)
        icon.save(folder/'ic_launcher.png', optimize=True)
        circle=Image.new('L', (size,size), 0)
        ImageDraw.Draw(circle).ellipse((0,0,size-1,size-1),fill=255)
        round_icon=icon.copy()
        combined=bytes(a*b//255 for a,b in zip(icon.getchannel('A').tobytes(),circle.tobytes()))
        round_icon.putalpha(Image.frombytes('L',(size,size),combined))
        round_icon.save(folder/'ic_launcher_round.png',optimize=True)
        # Android adaptive mask crops the outer 18dp: white symbol stays in safe zone.
        adaptive_size=round(108*scale)
        adaptive_mask=symbol_mask(mask,adaptive_size,.44,.50)
        adaptive=Image.new('RGBA',(adaptive_size,adaptive_size),(255,255,255,0))
        adaptive.putalpha(adaptive_mask)
        adaptive.save(folder/'ic_launcher_foreground.png',optimize=True)
    colors=res/'values/colors.xml'
    original=colors.read_text()
    import re
    bg=f'#{red[0]:02X}{red[1]:02X}{red[2]:02X}'
    modified,count=re.subn(r'(<color name="ic_launcher_background">)#[A-Fa-f0-9]{6}(</color>)',
                            lambda m: m[1]+bg+m[2], original)
    if count != 1: raise SystemExit('Missing Android adaptive background: STOP BUILD')
    colors.write_text(modified)
    if args.preview:
        legacy_icon(512,symbol_mask(mask,512,.60,.68),red).save(args.preview)
    print('v10 SMALL BAG: same Play bag/P graphic, scaled to 60% legacy / 44% adaptive, red',bg)


if __name__=='__main__':
    main()
