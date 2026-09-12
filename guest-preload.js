const { ipcRenderer } = require('electron');
// The host needs this signal because clicks inside a webview do not bubble to its parent DOM.
window.addEventListener('mousedown', () => ipcRenderer.sendToHost('guest-pointer'), true);
window.addEventListener('keydown', event => { if (event.key === 'Escape') ipcRenderer.sendToHost('guest-pointer'); }, true);
