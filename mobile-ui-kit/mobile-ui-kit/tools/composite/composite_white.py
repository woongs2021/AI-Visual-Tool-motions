"""composite_white.py — for photos whose phone screen is BLANK WHITE.

  python3 tools/composite/composite_white.py photo.png captures/meeting-notes--dark--statusbar@3x.png out.png --debug check.png

Composite UI screenshots into the blank white phone screens of photos.

Finds the white display area, fits its four edges (lines through the straight parts, so rounded corners don't skew the
quad), warps the screenshot into that quad and masks it with the white area itself — fingers, bezel and the Dynamic
Island stay on top, and the display's rounded corners clip the UI as on a real phone.
"""
import argparse
import cv2
import numpy as np

def white_region(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mn = img.min(axis=2)
    m = ((mn > 215) & (hsv[..., 1] < 40)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    best, score = 0, 0
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        fill = a / float(w * h)
        s = a * fill * (1 if h > w else 0.2)      # large, solid, portrait
        if s > score:
            best, score = i, s
    return (lab == best).astype(np.uint8)

def fit_quad(mask):
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cnts, key=cv2.contourArea)
    hull = cv2.convexHull(c)
    peri = cv2.arcLength(hull, True)
    approx = None
    for k in np.linspace(0.01, 0.15, 60):
        a = cv2.approxPolyDP(hull, k * peri, True)
        if len(a) == 4:
            approx = a.reshape(4, 2).astype(np.float64); break
    if approx is None:
        raise RuntimeError('no quad')
    # order tl, tr, br, bl
    s = approx.sum(1); d = np.diff(approx, axis=1).ravel()
    q = np.array([approx[np.argmin(s)], approx[np.argmin(d)], approx[np.argmax(s)], approx[np.argmax(d)]])
    # sample the convex hull densely: it bridges the Dynamic Island notch, so the top edge stays straight
    hp = hull.reshape(-1, 2).astype(np.float64)
    pts = np.concatenate([np.linspace(hp[i], hp[(i + 1) % len(hp)], max(2, int(np.linalg.norm(hp[(i + 1) % len(hp)] - hp[i]))), endpoint=False) for i in range(len(hp))])
    lines = []
    for i in range(4):
        p0, p1 = q[i], q[(i + 1) % 4]
        v = p1 - p0; L = np.linalg.norm(v); u = v / L; nrm = np.array([-u[1], u[0]])
        rel = pts - p0
        t = rel @ u / L
        dist = np.abs(rel @ nrm)
        sel = np.empty((0, 2))
        for tol in (6, 10, 16, 24, 40):
            sel = pts[(t > 0.22) & (t < 0.78) & (dist < tol)]
            if len(sel) > 20: break
        vx, vy, x0, y0 = cv2.fitLine(sel.astype(np.float32), cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()
        lines.append((np.array([x0, y0]), np.array([vx, vy])))
    corners = []
    for i in range(4):
        (a, da), (b, db) = lines[i - 1], lines[i]
        A = np.array([da, -db]).T
        t = np.linalg.solve(A, b - a)
        corners.append(a + t[0] * da)
    return np.array(corners, np.float32)   # tl, tr, br, bl (side i-1 ∩ side i → corner i)

def composite(photo_path, ui_path, out_path, debug_path=None):
    img = cv2.imread(photo_path)
    ui = cv2.imread(ui_path)
    mask = white_region(img)
    quad = fit_quad(mask)
    H, W = img.shape[:2]

    # pre-scale the UI near its on-photo size (clean downsampling), then warp
    th = int(max(np.linalg.norm(quad[3] - quad[0]), np.linalg.norm(quad[2] - quad[1])) * 2)
    tw = int(round(th * ui.shape[1] / ui.shape[0]))
    ui_s = cv2.resize(ui, (tw, th), interpolation=cv2.INTER_AREA)
    src = np.float32([[0, 0], [tw, 0], [tw, th], [0, th]])
    M = cv2.getPerspectiveTransform(src, quad)
    warped = cv2.warpPerspective(ui_s, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

    # matte: inside the display's hull, how much of each pixel is the white screen (vs the dark island / bezel or a finger
    # next to it). Each edge pixel is unmixed against the local non-white colour, so no white fringe is left behind.
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    D = np.zeros_like(mask); cv2.fillPoly(D, [cv2.convexHull(max(cnts, key=cv2.contourArea))], 1)
    D = cv2.dilate(D, np.ones((9, 9), np.uint8)).astype(np.float32)
    f = img.astype(np.float32)
    lum = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    nonwhite = (lum < 170).astype(np.float32)
    k = (13, 13)
    den = cv2.boxFilter(nonwhite, -1, k, normalize=False)
    bg = cv2.boxFilter(f * nonwhite[..., None], -1, k, normalize=False) / np.maximum(den, 1e-3)[..., None]
    bg[den < 0.5] = 0
    bglum = bg.mean(axis=2)
    a = np.clip((lum - bglum) / np.maximum(250 - bglum, 1), 0, 1)
    a[lum >= 245] = 1
    near = cv2.dilate(mask, np.ones((5, 5), np.uint8)).astype(np.float32)   # only the white area and its 2 px rim
    a = a * D * near
    alpha = a[..., None]
    # a faint glass reflection so the display sits under the cover glass
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    c = quad.mean(0); diag = (xx - c[0]) * 0.6 - (yy - c[1])
    gloss = np.clip((diag - 0) / (np.linalg.norm(quad[2] - quad[0]) * 0.9), 0, 1)[..., None] * 0.035
    screen = warped.astype(np.float32) * (1 - gloss) + 255 * gloss

    base = np.where(D[..., None] > 0, bg, f)
    base = np.where((alpha > 0.995), f, base)
    out = f * (1 - D[..., None]) + D[..., None] * (base * (1 - alpha) + screen * alpha)
    # outside the display hull nothing changes; inside, non-white pixels (alpha 0) keep their own colour
    out = np.where((alpha < 0.005), f, out)
    cv2.imwrite(out_path, np.clip(out, 0, 255).astype(np.uint8))
    if debug_path:
        dbg = img.copy()
        cv2.polylines(dbg, [quad.astype(np.int32)], True, (0, 0, 255), 2)
        cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        cv2.drawContours(dbg, cnts, -1, (0, 255, 0), 1)
        cv2.imwrite(debug_path, dbg)
    print(out_path, quad.round(1).tolist())

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Composite a UI screenshot into the blank white screen of a phone photo.')
    ap.add_argument('photo', help='photo with a white (blank) phone screen')
    ap.add_argument('ui', help='UI screenshot, e.g. captures/<id>--dark--statusbar@3x.png')
    ap.add_argument('out', help='result image (same size as the photo)')
    ap.add_argument('--debug', help='also write the photo with the detected screen outline (red) and white area (green)')
    a = ap.parse_args()
    composite(a.photo, a.ui, a.out, a.debug)
