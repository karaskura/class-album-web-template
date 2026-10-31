# -*- coding: utf-8 -*-
"""生成手机版下载页的二维码：public/download/qr.png

用法（在 web/ 目录下）：
    pip install segno
    python scripts/make-download-qr.py                      # 默认 https://example.com/download
    python scripts/make-download-qr.py https://别的域名/download

二维码里写的就是下载页地址，所以换域名/换路径时要重新生成一次。
"""
import os
import sys

import segno

DEFAULT_URL = 'https://example.com/download'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'download', 'qr.png')


def main() -> None:
    url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    qr = segno.make(url, error='m')
    # 深色用站点正文色 #16181d，浅色纯白；scale 10 = 每模块 10px，手机上够清楚
    qr.save(OUT, scale=10, border=2, dark='#16181d', light='#ffffff')
    print('%s -> %s (%d bytes)' % (url, os.path.relpath(OUT), os.path.getsize(OUT)))


if __name__ == '__main__':
    main()
