# ClassAlbum Desktop

把班级相册网页版装进一个独立的桌面窗口：装完之后桌面 / 开始菜单会有 **ClassAlbum** 图标，双击就是网站，像 App 一样。

> 图标是圆形猫耳女孩（`build/icon.ico`），换成别的图后重新跑一遍生成脚本即可（见下文）。

## 目录

```
desktop/
├── main.js         # 主进程：窗口、splash、外链、快捷键、窗口大小记忆
├── preload.js      # 只暴露 karaFile.reload() 等最小接口
├── splash.html     # 开场动画位置（TODO 都标在这里）
├── offline.html    # 加载失败时的重试页
├── build/          # 图标资源（icon.ico / icon.png / icon-256.png / icon-src.jpg）
└── package.json    # electron-builder(nsis) 打包配置
```

## 开发 / 打包

```bash
cd desktop
npm install

# 本地调试：默认连本机 http://localhost:3000，用 CLASSALBUM_URL 指向线上站
npm start
CLASSALBUM_URL=http://localhost:3000 npm start   # Windows: set CLASSALBUM_URL=... && npm start

# 打 Windows 安装包 → dist/ClassAlbum-Setup-1.1.0.exe
npm run dist
```

安装包是 NSIS（可选安装路径），装完会创建：
- 桌面快捷方式 `ClassAlbum`
- 开始菜单项 `ClassAlbum`
- 控制面板可卸载

## 开场动画（预留位置）

- 现在是一个 900ms 的简单入场（logo 弹出 + 文字浮现 + 三点呼吸）。
- 要做正式开场动画时：**只改 `splash.html`**，把动画写进 `.card` 或新增元素；再把 `main.js` 顶部的 `SPLASH_MIN_MS` 改成动画总时长即可。
- 主窗口 `did-finish-load` 后会自动关掉 splash 并显示主窗口；splash 最多停留 6 秒（兜底）。

## 行为约定

- 单实例：重复双击只唤起已有窗口。
- 站外链接（不是本站 origin 的）交给系统默认浏览器打开。
- 记住上次窗口大小和位置（`%APPDATA%/ClassAlbum/window-state.json`）。
- 快捷键：F5 / Ctrl+R 刷新，F11 全屏，Ctrl+加号/减号/0 缩放。
- 断网时显示重试页，不会白屏。

## 换图标

把新图存成 `build/icon-src.jpg`，然后：

```bash
python - <<'PY'
from PIL import Image, ImageDraw
src = Image.open("build/icon-src.jpg").convert("RGB")
cx, cy, side = 1024, 1015, 1900   # 按新图人物位置调整
im = src.crop((cx-side//2, cy-side//2, cx+side//2, cy+side//2))
SS = 4
big = im.resize((side*SS, side*SS), Image.LANCZOS)
mask = Image.new("L", big.size, 0)
pad = int(side*SS*0.05)
ImageDraw.Draw(mask).ellipse((pad, pad, big.size[0]-pad, big.size[1]-pad), fill=255)
out = Image.new("RGBA", big.size, (0,0,0,0))
out.paste(big, (0,0), mask)
out = out.resize((1024,1024), Image.LANCZOS)
out.save("build/icon-1024.png")
out.resize((512,512), Image.LANCZOS).save("build/icon.png")
out.resize((256,256), Image.LANCZOS).save("build/icon-256.png")
out.save("build/icon.ico", sizes=[(256,256),(128,128),(64,64),(48,48),(32,32),(24,24),(16,16)])
PY
npm run dist
```
