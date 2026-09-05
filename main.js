const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 600, minHeight: 500,
    icon: path.join(__dirname, 'icon.ico'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#020617', symbolColor: '#94a3b8' },
    backgroundColor: '#020617',
    webPreferences: { webviewTag: true, nodeIntegration: true, contextIsolation: false }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  // فحص التحديثات وإرسال الحالات للواجهة
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update-status', { type: 'available' });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.webContents.send('update-status', { 
      type: 'progress', 
      percent: Math.round(progressObj.percent) 
    });
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-status', { type: 'downloaded' });
  });

  ipcMain.on('restart-and-install', () => {
    autoUpdater.quitAndInstall();
  });
});