# AQWizard — generate tray/window PNG + ICO without Pillow.
import struct, zlib, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, "src-tauri", "icons")
os.makedirs(ICON_DIR, exist_ok=True)

def pixel(x, y, w, h):
    nx, ny = x / (w - 1), y / (h - 1)
    # transparent corners
    cx, cy = 0.5, 0.55
    dx, dy = nx - cx, ny - cy
    if (dx * dx) / 0.22 + (dy * dy) / 0.28 > 1 and ny > 0.42:
        return (0, 0, 0, 0)
    # hat triangle
    hat_left = 0.18 + ny * 0.22
    hat_right = 0.82 - ny * 0.22
    if ny < 0.42 and nx > hat_left and nx < hat_right:
        return (49, 46, 129, 255)
    # brim
    if 0.40 < ny < 0.48 and 0.18 < nx < 0.82:
        return (30, 27, 75, 255)
    # face
    if 0.48 < ny < 0.62 and 0.38 < nx < 0.62:
        return (245, 208, 176, 255)
    # beard
    if 0.58 < ny < 0.72 and 0.36 < nx < 0.64:
        return (229, 231, 235, 255)
    # robe
    if ny > 0.62 and 0.28 < nx < 0.72:
        return (15, 32, 51, 255)
    # wand spark (top-right)
    if (nx - 0.82) ** 2 + (ny - 0.18) ** 2 < 0.012:
        return (253, 230, 138, 255)
    return (0, 0, 0, 0)

def write_png(path, w, h):
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            raw.extend(pixel(x, y, w, h))
    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    return png

def write_ico(path, pngs_with_sizes):
    # ICO with embedded PNG images (Vista+)
    count = len(pngs_with_sizes)
    header = struct.pack("<HHH", 0, 1, count)
    entries = b""
    payload = b""
    offset = 6 + 16 * count
    for w, png in pngs_with_sizes:
        size = 0 if w >= 256 else w
        entries += struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, len(png), offset)
        payload += png
        offset += len(png)
    with open(path, "wb") as f:
        f.write(header + entries + payload)

p32 = write_png(os.path.join(ICON_DIR, "32x32.png"), 32, 32)
p128 = write_png(os.path.join(ICON_DIR, "128x128.png"), 128, 128)
p256 = write_png(os.path.join(ICON_DIR, "128x128@2x.png"), 256, 256)
write_png(os.path.join(ICON_DIR, "icon.png"), 256, 256)
write_ico(os.path.join(ICON_DIR, "icon.ico"), [(32, p32), (256, p256)])
print("wrote icons in", ICON_DIR)
