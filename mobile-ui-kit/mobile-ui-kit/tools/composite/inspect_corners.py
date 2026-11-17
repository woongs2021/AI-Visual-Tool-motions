"""inspect_corners.py — a contrast-stretched, gridded close-up of part of a photo, to read the display corners.

  python3 tools/composite/inspect_corners.py photo.png --box 1260,330,1920,1320 --out zoom.png
  python3 tools/composite/inspect_corners.py photo.png --box 1450,350,1600,450 --scale 6 --out tl.png   # one corner

The screen and the black bezel around it are often only a few levels apart (e.g. 19 vs 13); stretching the darks makes the
display edge visible. Grid lines every 10 px (labels every 50 px) are in photo coordinates.
Read 2+ points on the straight part of each display edge (not the rounded corners), extend the four lines, and use their
intersections — top-left, top-right, bottom-right, bottom-left — as --quad for composite_quad.py.
"""
import argparse
import numpy as np
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument('photo')
ap.add_argument('--box', required=True, help='x0,y0,x1,y1 in photo pixels')
ap.add_argument('--scale', type=int, default=0, help='zoom factor (default: fit to about 1000 px)')
ap.add_argument('--lo', type=float, default=4, help='luminance mapped to black')
ap.add_argument('--hi', type=float, default=45, help='luminance mapped to white')
ap.add_argument('--out', default='zoom.png')
a = ap.parse_args()

x0, y0, x1, y1 = [int(v) for v in a.box.split(',')]
im = np.asarray(Image.open(a.photo).convert('RGB')).astype(float)
L = im.mean(2)
s = (np.clip((L - a.lo) / (a.hi - a.lo), 0, 1) ** 0.8 * 255).astype('uint8')
crop = Image.fromarray(s).convert('RGB').crop((x0, y0, x1, y1))
sc = a.scale or max(1, int(1000 / max(x1 - x0, y1 - y0)))
crop = crop.resize((crop.width * sc, crop.height * sc), Image.NEAREST if sc >= 4 else Image.LANCZOS)
d = ImageDraw.Draw(crop)
for x in range(x0 - x0 % 10 + 10, x1, 10):
    X = (x - x0) * sc; d.line([(X, 0), (X, crop.height)], fill=(255, 0, 0) if x % 50 == 0 else (110, 0, 0))
    if x % 50 == 0: d.text((X + 2, 2), str(x), fill='yellow')
for y in range(y0 - y0 % 10 + 10, y1, 10):
    Y = (y - y0) * sc; d.line([(0, Y), (crop.width, Y)], fill=(255, 0, 0) if y % 50 == 0 else (110, 0, 0))
    if y % 50 == 0: d.text((2, Y + 2), str(y), fill='yellow')
crop.save(a.out)
print('✓', a.out, f'{crop.width}×{crop.height} (×{sc})')
