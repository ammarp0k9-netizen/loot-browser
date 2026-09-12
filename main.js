const { app, BrowserWindow, ipcMain, session, shell, dialog, clipboard } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
let mainWindow, browserSession;
const permissionRequests = new Map(), activeDownloads = new Map(), guests = new Map(), guestContexts = new Map();
const send = (channel, value) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, value); };

function configureSession() {
  browserSession = session.fromPartition('persist:lootbrowser');
  browserSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    const requestId = `${contents.id}-${Date.now()}`;
    permissionRequests.set(requestId, callback);
    send('permission-request', { requestId, permission, origin: details.requestingUrl || contents.getURL() });
  });
  browserSession.on('will-download', (event, item) => {
    const id = `${Date.now()}-${item.getFilename()}`;
    item.setSavePath(path.join(app.getPath('downloads'), item.getFilename())); activeDownloads.set(id, item);
    const publish = state => send('download-update', { id, name: item.getFilename(), path: item.getSavePath(), state, received: item.getReceivedBytes(), total: item.getTotalBytes() });
    publish('progressing'); item.on('updated', (e, state) => publish(state)); item.once('done', (e, state) => { publish(state); activeDownloads.delete(id); });
  });
}
function popupWindow(url) { const popup = new BrowserWindow({ width: 900, height: 700, backgroundColor: '#020617', webPreferences: { partition: 'persist:lootbrowser' } }); popup.loadURL(url); }
async function savePage(guest) { const result = await dialog.showSaveDialog(mainWindow, { defaultPath: 'page.html', filters: [{ name: 'Web page', extensions: ['html'] }] }); if (!result.canceled && result.filePath) try { await guest.savePage(result.filePath, 'HTMLComplete'); } catch { send('browser-toast', 'Could not save this page.'); } }
function attachGuest(guest) {
  guests.set(guest.id, guest); guest.once('destroyed', () => { guests.delete(guest.id); guestContexts.delete(guest.id); });
  guest.setWindowOpenHandler(({ url }) => {
    if (!url) return { action: 'deny' };
    // OAuth code checks window.open() synchronously. Returning allow is essential: a tab would look blocked to the site.
    return { action: 'allow', overrideBrowserWindowOptions: { parent: mainWindow, width: 520, height: 680, minWidth: 420, minHeight: 500, titleBarStyle: 'hidden', titleBarOverlay: { color: '#020617', symbolColor: '#94a3b8' }, backgroundColor: '#020617', autoHideMenuBar: true, webPreferences: { partition: 'persist:lootbrowser', contextIsolation: true, nodeIntegration: false } } };
  });
  guest.on('did-create-window', popup => { popup.setMenuBarVisibility(false); popup.setAutoHideMenuBar(true); });
  guest.on('context-menu', (event, params) => {
    event.preventDefault();
    const context = { linkURL: params.linkURL || '', selectionText: params.selectionText || '', isEditable: !!params.isEditable, canGoBack: guest.canGoBack(), canGoForward: guest.canGoForward() };
    guestContexts.set(guest.id, context); send('context-menu', { guestId: guest.id, x: params.x, y: params.y, context });
  });
}
function createWindow() {
  mainWindow = new BrowserWindow({ width: 1200, height: 800, minWidth: 600, minHeight: 500, icon: path.join(__dirname, 'icon.ico'), titleBarStyle: 'hidden', titleBarOverlay: { color: '#020617', symbolColor: '#94a3b8' }, backgroundColor: '#020617', webPreferences: { webviewTag: true, nodeIntegration: true, contextIsolation: false } });
  mainWindow.webContents.on('did-attach-webview', (event, guest) => attachGuest(guest));
  mainWindow.webContents.on('before-input-event', (event, input) => { const key = input.key.toLowerCase(), ctrl = input.control || input.meta; const shortcut = ctrl && input.shift ? `ctrl-shift-${key}` : ctrl ? `ctrl-${key}` : input.alt ? `alt-${key}` : key === 'f11' ? 'f11' : null; if (shortcut && ['ctrl-l','ctrl-t','ctrl-w','ctrl-shift-t','ctrl-tab','ctrl-shift-tab','ctrl-r','ctrl-shift-r','ctrl-f','ctrl-+','ctrl-=','ctrl--','ctrl-0','alt-left','alt-right','f11'].includes(shortcut)) { event.preventDefault(); send('browser-shortcut', shortcut); } });
  mainWindow.loadFile('index.html');
}
ipcMain.on('permission-response', (event, request) => { const callback = permissionRequests.get(request.requestId); if (callback) { permissionRequests.delete(request.requestId); callback(!!request.allowed); } });
ipcMain.on('context-menu-action', (event, { guestId, action }) => { const guest = guests.get(guestId), context = guestContexts.get(guestId); if (!guest || !context) return; const handlers = { back: () => guest.goBack(), forward: () => guest.goForward(), reload: () => guest.reload(), copy: () => guest.copy(), cut: () => guest.cut(), paste: () => guest.paste(), selectall: () => guest.selectAll(), newtab: () => send('open-url-in-tab', context.linkURL), newwindow: () => popupWindow(context.linkURL), copylink: () => clipboard.writeText(context.linkURL), search: () => send('open-url-in-tab', `https://www.google.com/search?q=${encodeURIComponent(context.selectionText)}`), save: () => savePage(guest), inspect: () => guest.openDevTools({ mode: 'detach' }) }; if (handlers[action]) handlers[action](); });
ipcMain.on('download-cancel', (event, id) => activeDownloads.get(id)?.cancel());
ipcMain.handle('download-action', (event, info) => info.action === 'folder' ? shell.showItemInFolder(info.path) : shell.openPath(info.path));
ipcMain.on('toggle-fullscreen', () => mainWindow.setFullScreen(!mainWindow.isFullScreen())); ipcMain.on('restart-and-install', () => autoUpdater.quitAndInstall());
app.whenReady().then(() => { configureSession(); createWindow(); autoUpdater.checkForUpdatesAndNotify(); autoUpdater.on('update-available', () => send('update-status', { type: 'available' })); autoUpdater.on('download-progress', p => send('update-status', { type: 'progress', percent: Math.round(p.percent) })); autoUpdater.on('update-downloaded', () => send('update-status', { type: 'downloaded' })); app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
