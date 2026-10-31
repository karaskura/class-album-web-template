'use strict';

/**
 * ClassAlbum Desktop —— 把网页版装进一个独立的桌面窗口。
 *
 * 设计要点：
 * - 单实例：重复双击只会唤起已有窗口。
 * - 记住窗口大小/位置（userData/window-state.json）。
 * - 站外链接一律交给系统浏览器；站内链接留在窗口里。
 * - 主窗口 ready 前先展示 splash.html（开场动画位置，见文件内 TODO）。
 * - 加载失败 → offline.html（带重试按钮）。
 */

const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const APP_URL = process.env.CLASSALBUM_URL || 'http://localhost:3000';
const APP_ORIGIN = new URL(APP_URL).origin;
const APP_TITLE = 'ClassAlbum';

// 设置 CLASSALBUM_DEBUG=1 时输出加载/失败日志，方便排查
const DEBUG = !!process.env.CLASSALBUM_DEBUG;
const dbg = (...args) => {
  if (DEBUG) console.log('[kara]', ...args);
};

// 开场动画最短展示时间（毫秒）。之后可以按动画时长调整。
const SPLASH_MIN_MS = 900;

let mainWindow = null;
let splashWindow = null;
let splashShownAt = 0;
let statePath = '';

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(win) {
  if (!win || win.isDestroyed() || win.isMinimized() || win.isMaximized() || win.isFullScreen()) return;
  try {
    fs.writeFileSync(statePath, JSON.stringify(win.getBounds()));
  } catch {
    /* 忽略写入失败 */
  }
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 560,
    height: 380,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: false },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'), {
    // 版本号印在开场卡片上（splash.html 读 ?v=）：同学装完随手就能报版本，
    // 下载页也标同一个版本，两边一对就知道装的是不是最新的那个包。
    query: { v: app.getVersion() },
  });
  splashWindow.once('ready-to-show', () => {
    splashShownAt = Date.now();
    splashWindow.show();
  });
}

function revealMain() {
  const wait = Math.max(0, SPLASH_MIN_MS - (Date.now() - splashShownAt));
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    splashWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }, wait);
}

function createMain() {
  const st = readState();
  mainWindow = new BrowserWindow({
    width: Math.max(420, Number(st.width) || 1280),
    height: Math.max(560, Number(st.height) || 820),
    x: Number.isFinite(st.x) ? st.x : undefined,
    y: Number.isFinite(st.y) ? st.y : undefined,
    minWidth: 420,
    minHeight: 560,
    title: APP_TITLE,
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#f7f4ee',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.removeMenu();
  mainWindow.setTitle(APP_TITLE);

  const isInternal = (url) => {
    try {
      return new URL(url).origin === APP_ORIGIN;
    } catch {
      return false;
    }
  };

  // 站内链接留在窗口里，站外链接交给系统浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isInternal(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // 加载失败 → 本地重试页
  mainWindow.webContents.on('did-fail-load', (_event, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || url.startsWith('file://')) return;
    dbg('fail', code, desc, url);
    mainWindow.loadFile(path.join(__dirname, 'offline.html'), {
      query: { url, code: String(code), desc: desc || '' },
    });
  });

  mainWindow.webContents.on('did-finish-load', () => {
    const url = mainWindow.webContents.getURL();
    if (url.startsWith('file://')) return;
    dbg('loaded', mainWindow.webContents.getTitle(), url);
    revealMain();
  });

  // 常用快捷键（菜单已隐藏，保留浏览器习惯）
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key;
    const wc = mainWindow.webContents;
    if (key === 'F5' || (input.control && key.toLowerCase() === 'r')) {
      event.preventDefault();
      wc.reload();
    } else if (key === 'F11') {
      event.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    } else if (input.control && (key === '=' || key === '+')) {
      event.preventDefault();
      wc.setZoomLevel(Math.min(wc.getZoomLevel() + 0.5, 3));
    } else if (input.control && key === '-') {
      event.preventDefault();
      wc.setZoomLevel(Math.max(wc.getZoomLevel() - 0.5, -2));
    } else if (input.control && key === '0') {
      event.preventDefault();
      wc.setZoomLevel(0);
    }
  });

  // 右键：复制/粘贴/全选/刷新
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menu = Menu.buildFromTemplate([
      { role: 'copy', enabled: !!params.selectionText, label: '复制' },
      { role: 'paste', enabled: params.isEditable, label: '粘贴' },
      { role: 'selectAll', label: '全选' },
      { type: 'separator' },
      { label: '刷新', click: () => mainWindow.webContents.reload() },
    ]);
    menu.popup({ window: mainWindow });
  });

  mainWindow.on('close', () => writeState(mainWindow));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.example.classalbum');
    statePath = path.join(app.getPath('userData'), 'window-state.json');
    Menu.setApplicationMenu(null);

    ipcMain.on('kara:reload', () => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(APP_URL);
    });

    createSplash();
    createMain();
    mainWindow.loadURL(APP_URL);

    // 兜底：splash 最多停留 6 秒，避免主窗口迟迟不出
    setTimeout(() => {
      if (splashWindow || (mainWindow && !mainWindow.isVisible())) revealMain();
    }, 6000);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplash();
      createMain();
      mainWindow.loadURL(APP_URL);
    }
  });
}
