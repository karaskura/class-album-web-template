'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// 只暴露最小接口给页面
contextBridge.exposeInMainWorld('karaFile', {
  // offline.html 的重试按钮用
  reload: () => ipcRenderer.send('kara:reload'),
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
});
