"""生成班级相册的 PWA 图标（192 / 512 / maskable 512）。"""
from PIL import Image, ImageDraw
import os

OUT = r"Z:\class-album\web\public\icons"
SS = 4  # 超采样倍数，边缘更干净

TOP = (79, 134, 247)     # #4f86f7
BOTTOM = (47, 111, 235)  # #2f6feb


def gradient(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        t = y / max(size - 1, 1)
        r = round(TOP[0] + (BOTTOM[0] - TOP[0]) * t)
        g = round(TOP[1] + (BOTTOM[1] - TOP[1]) * t)
        b = round(TOP[2] + (BOTTOM[2] - TOP[2]) * t)
        for x in range(size):
            px[x, y] = (r, g, b)
    return img


def rounded_mask(size: int, radius_ratio: float) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    radius = int(size * radius_ratio)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def draw_glyph(img: Image.Image, size: int, inset_ratio: float) -> None:
    """在图片中央画一个白色照片图标（太阳 + 山）。"""
    d = ImageDraw.Draw(img)
    inset = size * inset_ratio
    box = [inset, inset, size - inset, size - inset]
    radius = int((box[2] - box[0]) * 0.18)

    # 相框
    d.rounded_rectangle(box, radius=radius, fill=(255, 255, 255, 255))

    # 内部留白
    pad = (box[2] - box[0]) * 0.16
    inner = [box[0] + pad, box[1] + pad, box[2] - pad, box[3] - pad]
    inner_radius = int((inner[2] - inner[0]) * 0.14)
    d.rounded_rectangle(inner, radius=inner_radius, fill=(255, 255, 255, 255))

    # 太阳
    sun_r = (inner[2] - inner[0]) * 0.11
    sun_cx = inner[0] + (inner[2] - inner[0]) * 0.30
    sun_cy = inner[1] + (inner[3] - inner[1]) * 0.30
    d.ellipse(
        [sun_cx - sun_r, sun_cy - sun_r, sun_cx + sun_r, sun_cy + sun_r],
        fill=BOTTOM + (255,),
    )

    # 山（两个三角，用渐变底色挖出来）
    w = inner[2] - inner[0]
    h = inner[3] - inner[1]
    d.polygon(
        [
            (inner[0] + w * 0.10, inner[3]),
            (inner[0] + w * 0.42, inner[1] + h * 0.38),
            (inner[0] + w * 0.72, inner[3]),
        ],
        fill=BOTTOM + (255,),
    )
    d.polygon(
        [
            (inner[0] + w * 0.52, inner[3]),
            (inner[0] + w * 0.74, inner[1] + h * 0.56),
            (inner[0] + w * 0.95, inner[3]),
        ],
        fill=TOP + (255,),
    )


def make_icon(size: int, radius_ratio: float, inset_ratio: float, maskable: bool) -> Image.Image:
    big = size * SS
    base = gradient(big).convert("RGBA")
    draw_glyph(base, big, inset_ratio)
    if maskable:
        return base.resize((size, size), Image.LANCZOS)
    base.putalpha(rounded_mask(big, radius_ratio))
    return base.resize((size, size), Image.LANCZOS)


os.makedirs(OUT, exist_ok=True)

make_icon(192, 0.22, 0.24, False).save(os.path.join(OUT, "icon-192.png"))
make_icon(512, 0.22, 0.24, False).save(os.path.join(OUT, "icon-512.png"))
# maskable：整块铺满，图标缩到中间安全区
make_icon(512, 0.0, 0.30, True).save(os.path.join(OUT, "icon-maskable-512.png"))
# 顺便给个 apple-touch-icon
make_icon(180, 0.22, 0.24, False).save(os.path.join(OUT, "apple-touch-icon.png"))

print("生成完成：", os.listdir(OUT))
