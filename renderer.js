const tabsContainer = document.getElementById('tabs-container');
const newTabBtn = document.getElementById('btn-new-tab');
const viewsContainer = document.getElementById('views-container');
const urlInput = document.getElementById('url-input');
const btnBack = document.getElementById('btn-back');
const btnForward = document.getElementById('btn-forward');
const btnReload = document.getElementById('btn-reload');

let tabs = [];
let activeTabId = null;
let tabCounter = 0;

const DEFAULT_URL = 'https://www.google.com';

function createTab(url = DEFAULT_URL) {
  const id = `tab-${tabCounter++}`;
  
  // 1. Create Tab UI Element
  const tabEl = document.createElement('div');
  tabEl.className = 'tab';
  tabEl.id = id;
  tabEl.innerHTML = `
    <span class="tab-title">New Tab</span>
    <div class="tab-close">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </div>
  `;

  // 2. Create Webview (Chromium Instance)
  const viewEl = document.createElement('webview');
  viewEl.setAttribute('src', url);
  viewEl.id = `view-${id}`;
  
  // 3. Setup Listeners for the Webview
  viewEl.addEventListener('page-title-updated', (e) => {
    tabEl.querySelector('.tab-title').textContent = e.title;
  });

  viewEl.addEventListener('did-navigate', (e) => {
    if (activeTabId === id) {
      urlInput.value = e.url;
      updateNavButtons(viewEl);
    }
  });

  viewEl.addEventListener('did-navigate-in-page', (e) => {
    if (activeTabId === id) {
      urlInput.value = e.url;
      updateNavButtons(viewEl);
    }
  });

  // 4. Tab interactions
  tabEl.addEventListener('click', () => switchTab(id));
  tabEl.querySelector('.tab-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(id);
  });

  tabsContainer.insertBefore(tabEl, newTabBtn);
  viewsContainer.appendChild(viewEl);

  tabs.push({ id, tabEl, viewEl });
  switchTab(id);
}

function switchTab(id) {
  activeTabId = id;
  tabs.forEach(tab => {
    if (tab.id === id) {
      tab.tabEl.classList.add('active');
      tab.viewEl.classList.add('active');
      urlInput.value = tab.viewEl.getURL() || '';
      updateNavButtons(tab.viewEl);
    } else {
      tab.tabEl.classList.remove('active');
      tab.viewEl.classList.remove('active');
    }
  });
}

function closeTab(id) {
  const tabIndex = tabs.findIndex(t => t.id === id);
  if (tabIndex === -1) return;

  const tab = tabs[tabIndex];
  tab.tabEl.remove();
  tab.viewEl.remove();
  tabs.splice(tabIndex, 1);

  if (tabs.length === 0) {
    createTab(); // Always keep at least one tab open
  } else if (activeTabId === id) {
    // Switch to the previous tab, or the next one if it was the first
    const newActiveIndex = Math.max(0, tabIndex - 1);
    switchTab(tabs[newActiveIndex].id);
  }
}

function getActiveView() {
  const tab = tabs.find(t => t.id === activeTabId);
  return tab ? tab.viewEl : null;
}

function updateNavButtons(view) {
  if (!view) return;
  // Use try-catch because webview methods might not be ready immediately
  try {
    btnBack.disabled = !view.canGoBack();
    btnForward.disabled = !view.canGoForward();
  } catch(e) {}
}

// Navigation Controls
btnBack.addEventListener('click', () => {
  const view = getActiveView();
  if (view && view.canGoBack()) view.goBack();
});

btnForward.addEventListener('click', () => {
  const view = getActiveView();
  if (view && view.canGoForward()) view.goForward();
});

btnReload.addEventListener('click', () => {
  const view = getActiveView();
  if (view) view.reload();
});

newTabBtn.addEventListener('click', () => createTab());

// Address Bar Logic (Search vs URL)
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    let query = urlInput.value.trim();
    if (!query) return;

    // Basic regex to check if it's a domain/URL or a search query
    const isUrl = /^(https?:\/\/)?([\w.-]+)\.([a-z]{2,})(:\d{1,5})?(\/.*)?$/i.test(query) || query.startsWith('localhost:');
    
    if (isUrl) {
      if (!query.startsWith('http://') && !query.startsWith('https://')) {
        query = 'https://' + query;
      }
    } else {
      // Treat as a search query
      query = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    }

    const view = getActiveView();
    if (view) view.loadURL(query);
    
    urlInput.blur(); // Remove focus after pressing enter
  }
});

// Initialize first tab
createTab();

//Dynamic Notification
const { ipcRenderer } = require('electron');

const updateBanner = document.getElementById('update-banner');
const updateText = document.getElementById('update-text');
const updateProgressFill = document.getElementById('update-progress-fill');
const btnRestart = document.getElementById('btn-restart');

ipcRenderer.on('update-status', (event, data) => {
  if (data.type === 'available') {
    updateBanner.classList.remove('hidden');
    updateText.textContent = 'تم العثور على تحديث جديد، جاري بدء التنزيل...';
  } else if (data.type === 'progress') {
    updateBanner.classList.remove('hidden');
    updateText.textContent = `جاري تنزيل التحديث: ${data.percent}%`;
    updateProgressFill.style.width = `${data.percent}%`;
  } else if (data.type === 'downloaded') {
    updateBanner.classList.remove('hidden');
    updateText.textContent = 'اكتمل التنزيل! المتصفح جاهز للتحديث.';
    updateProgressFill.style.width = '100%';
    btnRestart.classList.remove('hidden');
  }
});

btnRestart.addEventListener('click', () => {
  ipcRenderer.send('restart-and-install');
});