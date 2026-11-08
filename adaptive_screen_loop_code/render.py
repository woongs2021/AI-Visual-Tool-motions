#!/usr/bin/env python3
"""Render screen_loop.html to a seamless looping MP4 (or stills for checking).

Usage:
  python3 render.py screen_loop.html out.mp4            # full loop video
  python3 render.py screen_loop.html stills/ --at 0.5 1.2 2.0   # JPEG stills at times (s)

Needs: pip install playwright && playwright install chromium ; ffmpeg on PATH.
"""
import argparse, os, pathlib, subprocess, sys
from playwright.sync_api import sync_playwright


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html")
    ap.add_argument("out")
    ap.add_argument("--at", nargs="*", type=float, help="render stills at these times instead of a video")
    ap.add_argument("--loops", type=int, default=1, help="how many loop cycles to put in the video")
    ap.add_argument("--chrome", default=None, help="path to a Chrome/Chromium binary (optional)")
    a = ap.parse_args()

    url = pathlib.Path(a.html).resolve().as_uri() + "?capture"
    with sync_playwright() as p:
        kw = {"executable_path": a.chrome} if a.chrome else {}
        if not a.chrome and os.path.exists("/usr/bin/google-chrome"):
            kw = {"executable_path": "/usr/bin/google-chrome"}
        browser = p.chromium.launch(**kw)
        page = browser.new_page()
        page.goto(url)
        cfg = page.evaluate("({w: CONFIG.width, h: CONFIG.height, fps: CONFIG.fps, loop: LOOP_DURATION})")
        page.set_viewport_size({"width": cfg["w"], "height": cfg["h"]})
        page.evaluate("document.fonts.ready")
        stage = page.locator("#stage")

        if a.at:
            os.makedirs(a.out, exist_ok=True)
            for t in a.at:
                page.evaluate(f"renderAt({t})")
                stage.screenshot(path=os.path.join(a.out, f"t_{t:05.2f}.jpg"), type="jpeg", quality=92)
            print("stills ->", a.out)
            return

        fps = cfg["fps"]
        n = round(cfg["loop"] * fps) * a.loops
        tmp = a.out[:-4] + ".part.mp4"
        ff = subprocess.Popen([
            "ffmpeg", "-y", "-v", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", tmp], stdin=subprocess.PIPE)
        for i in range(n):
            page.evaluate(f"renderAt({i / fps})")
            ff.stdin.write(stage.screenshot(type="jpeg", quality=92))
            if i % 30 == 0:
                print(f"frame {i}/{n}", file=sys.stderr)
        ff.stdin.close()
        if ff.wait() != 0:
            sys.exit("ffmpeg failed")
        os.replace(tmp, a.out)
        print("video ->", a.out)
        browser.close()


if __name__ == "__main__":
    main()
