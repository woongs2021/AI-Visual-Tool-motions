"""composite_quad.py — for photos whose phone screen already shows something (no white area to find).

  python3 tools/composite/composite_quad.py photo.png captures/pc-health--dark--statusbar@3x.png out.png \
      --quad "1490,390 1855,435 1700,1265 1310,1160" --cutout notch --blur 0.6

--quad   the display's four corners: top-left, top-right, bottom-right, bottom-left (photo pixels). Use the VIRTUAL corners:
         extend the straight parts of each display edge and intersect them — the real corners are rounded and sit inside.
         Measure them with inspect_corners.py. A JSON file with [[x,y],…] works too.
--cutout what the phone has at the top: notch (iPhone X–14), island (Dynamic Island, 14 Pro and later) or none.
         The cutout is drawn as a hole, so the photo's own notch / island shows through.

The UI is warped into the quad, clipped to the display's rounded corners, matched to the photo (soften, dim, grain, a faint
glass sheen), and fingers that reach over the display from outside are kept from the photo.
"""
import argparse, json, os
import cv2
import numpy as np

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument('photo'); ap.add_argument('ui'); ap.add_argument('out')
ap.add_argument('--quad', required=True, help='"x,y x,y x,y x,y" (tl tr br bl) or a JSON file')
ap.add_argument('--cutout', choices=['notch', 'island', 'none'], default='notch')
ap.add_argument('--radius', type=float, default=39, help='display corner radius in pt (default 39; 47–55 on newer phones)')
ap.add_argument('--blur', type=float, default=0.6, help='soften the UI to the photo’s sharpness (px sigma)')
ap.add_argument('--dim', type=float, default=0.94, help='UI brightness multiplier')
ap.add_argument('--grain', type=float, default=1.6, help='noise to match the photo')
ap.add_argument('--no-skin', action='store_true', help='don’t keep skin-coloured areas (fingers) from the photo')
ap.add_argument('--debug', help='also write the photo with the quad outline')
a = ap.parse_args()

if os.path.isfile(a.quad):
    q = np.float32(json.load(open(a.quad)))
else:
    q = np.float32([[float(v) for v in p.split(',')] for p in a.quad.split()])
assert q.shape == (4, 2), '--quad needs 4 points: tl tr br bl'

img = cv2.imread(a.photo).astype(np.float32)
ui = cv2.imread(a.ui).astype(np.float32)          # 1170 × 2532 (390 × 844 @3x)
H, W = img.shape[:2]
uh, uw = ui.shape[:2]; s = uw / 390.0

# display shape in UI space (pt → px), drawn at 2× and scaled down for smooth edges
SS = 2
shape = np.zeros((uh * SS, uw * SS), np.uint8)
f = SS * s
def rrect(m, x0, y0, x1, y1, r, val):
    x0, y0, x1, y1, r = [int(round(v)) for v in (x0, y0, x1, y1, r)]
    cv2.rectangle(m, (x0 + r, y0), (x1 - r, y1), val, -1); cv2.rectangle(m, (x0, y0 + r), (x1, y1 - r), val, -1)
    for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)):
        cv2.circle(m, (cx, cy), r, val, -1, cv2.LINE_AA)
rrect(shape, 0, 0, 390 * f - 1, 844 * f - 1, a.radius * f, 255)
if a.cutout == 'notch':                      # 210 × 31 pt, rounded bottom corners
    nw, nh, nr = 210, 31, 20; x0 = (390 - nw) / 2
    rrect(shape, x0 * f, -nr * f, (x0 + nw) * f, nh * f, nr * f, 0)
elif a.cutout == 'island':                   # 126 × 37 pt pill, 11 pt from the top
    iw, ih, top = 126, 37, 11; x0 = (390 - iw) / 2
    rrect(shape, x0 * f, top * f, (x0 + iw) * f, (top + ih) * f, ih / 2 * f, 0)
shape = cv2.resize(shape, (uw, uh), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0

# pre-scale near the on-photo size, then warp colour and shape together
th = int(max(np.linalg.norm(q[3] - q[0]), np.linalg.norm(q[2] - q[1])) * 2)
tw = int(round(th * uw / uh))
ui_s = cv2.resize(ui, (tw, th), interpolation=cv2.INTER_AREA)
sh_s = cv2.resize(shape, (tw, th), interpolation=cv2.INTER_AREA)
M = cv2.getPerspectiveTransform(np.float32([[0, 0], [tw, 0], [tw, th], [0, th]]), q)
warped = cv2.warpPerspective(ui_s, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
alpha = cv2.warpPerspective(sh_s, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=0)

# match the photo
if a.blur > 0: warped = cv2.GaussianBlur(warped, (0, 0), a.blur)
warped = warped * a.dim
if a.grain > 0: warped += np.random.default_rng(3).normal(0, a.grain, warped.shape).astype(np.float32)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
c = q.mean(0); diag = (xx - c[0]) * 0.55 - (yy - c[1])
gloss = np.clip(diag / (np.linalg.norm(q[2] - q[0]) * 0.8), 0, 1) * 0.04          # cover glass sheen
warped = warped * (1 - gloss[..., None]) + 255 * gloss[..., None]

# fingers over the display stay: skin tones (redder than green, not dark) that reach in from outside the display.
# Skin-coloured areas wholly inside the display (avatar photos in the old UI) and small specks are replaced.
skin = np.zeros((H, W), np.float32)
if not a.no_skin:
    b, g, r = img[..., 0], img[..., 1], img[..., 2]
    skin = np.clip((r - g - 10) / 14, 0, 1) * np.clip((r - 55) / 30, 0, 1)
    n, lab, st, _ = cv2.connectedComponentsWithStats((skin > 0.25).astype(np.uint8), 8)
    inside = np.zeros((H, W), np.uint8); cv2.fillPoly(inside, [q.astype(np.int32)], 1)
    inside = cv2.erode(inside, np.ones((5, 5), np.uint8))
    outside_ids = np.unique(lab[(inside == 0) & (lab > 0)])
    keep = np.isin(lab, [i for i in outside_ids if st[i, cv2.CC_STAT_AREA] > 300])
    skin = skin * cv2.dilate(keep.astype(np.uint8), np.ones((7, 7), np.uint8))
    skin = cv2.GaussianBlur(cv2.dilate(skin, np.ones((3, 3), np.uint8)), (0, 0), 0.8)
alpha3 = (alpha * (1 - skin))[..., None]

out = img * (1 - alpha3) + warped * alpha3
cv2.imwrite(a.out, np.clip(out, 0, 255).astype(np.uint8))
if a.debug:
    dbg = img.astype(np.uint8).copy(); cv2.polylines(dbg, [q.astype(np.int32)], True, (0, 0, 255), 1); cv2.imwrite(a.debug, dbg)
print('✓', a.out)
