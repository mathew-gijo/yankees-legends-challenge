#!/usr/bin/env python3
"""Generate PWA app icons with no third-party libraries.

Draws a navy field, a gold ring, and an "NY" monogram, then writes valid PNGs.
Run:  python3 tools/generate_icons.py
"""
import math
import os
import struct
import zlib

NAVY = (10, 22, 49)
NAVY3 = (28, 48, 97)
GOLD = (230, 197, 110)

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")


def dist_point_seg(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def render(size):
    buf = bytearray(size * size * 3)

    def put(x, y, c):
        i = (y * size + x) * 3
        buf[i], buf[i + 1], buf[i + 2] = c

    cx = cy = size / 2
    ring_r = size * 0.40
    ring_t = size * 0.045
    # letter geometry (two glyphs centered)
    s = size * 0.16          # half glyph height
    lw = size * 0.045        # stroke half-width
    gap = size * 0.055
    # N spans, Y spans
    nx0 = cx - gap - size * 0.14
    yx0 = cx + gap
    top, bot = cy - s, cy + s

    def n_segs(x0):
        w = size * 0.14
        return [
            (x0, bot, x0, top),            # left stem
            (x0, top, x0 + w, bot),        # diagonal
            (x0 + w, bot, x0 + w, top),    # right stem
        ]

    def y_segs(x0):
        w = size * 0.14
        midx = x0 + w / 2
        midy = cy
        return [
            (x0, top, midx, midy),         # left arm
            (x0 + w, top, midx, midy),     # right arm
            (midx, midy, midx, bot),       # stem
        ]

    segs = n_segs(nx0) + y_segs(yx0)

    for y in range(size):
        for x in range(size):
            # background radial-ish
            c = NAVY if (x + y) % 1 == 0 else NAVY
            # subtle center lift
            d = math.hypot(x - cx, y - cy)
            if d < size * 0.5:
                mix = max(0, 1 - d / (size * 0.5)) * 0.10
                c = tuple(int(a + (b - a) * mix) for a, b in zip(NAVY, NAVY3))
            # ring
            if abs(d - ring_r) < ring_t:
                c = GOLD
            # letters
            for (ax, ay, bx, by) in segs:
                if dist_point_seg(x, y, ax, ay, bx, by) < lw:
                    c = GOLD
                    break
            put(x, y, c)
    return buf


def write_png(path, size, rgb):
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter type 0
        start = y * size * 3
        raw.extend(rgb[start:start + size * 3])
    comp = zlib.compress(bytes(raw), 9)

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", comp) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def main():
    os.makedirs(OUT, exist_ok=True)
    for size in (192, 512):
        print(f"rendering {size}x{size} …")
        write_png(os.path.join(OUT, f"icon-{size}.png"), size, render(size))
    print("done ->", os.path.abspath(OUT))


if __name__ == "__main__":
    main()
