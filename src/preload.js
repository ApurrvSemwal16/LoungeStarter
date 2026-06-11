const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize:           ()          => ipcRenderer.send('window-minimize'),
  maximize:           ()          => ipcRenderer.send('window-maximize'),
  close:              ()          => ipcRenderer.send('window-close'),

  // File system
  browseExeWithIcon:  ()          => ipcRenderer.invoke('browse-exe-with-icon'),
  extractIcon:        (exePath)   => ipcRenderer.invoke('extract-icon', exePath),
  autoWriteScript:    (content)   => ipcRenderer.invoke('auto-write-script', content),
  getBatPath:         ()          => ipcRenderer.invoke('get-bat-path'),
  showInExplorer:     (filePath)  => ipcRenderer.invoke('show-in-explorer', filePath),
  setLastBrowseDir:   (dirPath)   => ipcRenderer.send('set-last-browse-dir', dirPath),

  // App list persistence
  loadApps:           ()              => ipcRenderer.invoke('load-apps'),
  saveApps:           (apps)          => ipcRenderer.invoke('save-apps', apps),

  // Icon cache persistence
  loadIconCache:      ()              => ipcRenderer.invoke('load-icon-cache'),
  saveIconToCache:    (key, dataUrl)  => ipcRenderer.invoke('save-icon-to-cache', key, dataUrl),
  clearIconCache:     ()              => ipcRenderer.invoke('clear-icon-cache'),

  // App version
  getAppVersion:      ()              => ipcRenderer.invoke('get-app-version'),

  // Auto-updater events
  onUpdateAvailable:  (cb) => ipcRenderer.on('update-available', (_e, version) => cb(version)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_e, version) => cb(version)),
  installUpdate:      ()   => ipcRenderer.send('install-update'),
});