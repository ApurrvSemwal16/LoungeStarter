const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

// ── Auto-updater (safe import — won't crash if not configured) ──────────
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
} catch {
  console.log('[updater] electron-updater not available (dev mode)');
}

let mainWindow;
let tray;
let lastBrowseDir = 'C:\\Program Files';

// ── Single instance lock — prevent multiple copies running ──────────────
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
}

function getStartupBatPath() {
  return path.join(
    app.getPath('appData'),
    'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup',
    'LoungeStarter.bat'
  );
}

function cleanExePath(raw) {
  if (!raw) return null;
  const s = raw.trim();
  const q = s.match(/"([^"]+\.(?:exe|lnk|bat|cmd))"/i);
  if (q) return q[1];
  const u = s.replace(/^["']|["']$/g, '');
  const m = u.match(/^(.*?\.(?:exe|lnk|bat|cmd))(?:\s|$)/i);
  if (m) return m[1];
  return u.split(' ')[0];
}

// ── PowerShell: extract 256x256 icon via System.Drawing ──────────────────
function extractIconPS(exePath) {
  return new Promise((resolve) => {
    const tmpPng = path.join(os.tmpdir(), `lsicon_${Date.now()}.png`);

    // Use -EncodedCommand to handle all path quoting safely
    const script = `
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
try {
  $exePath = [System.IO.Path]::GetFullPath("${exePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")
  $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($exePath)
  if ($null -ne $icon) {
    $bmp = New-Object System.Drawing.Bitmap(256, 256)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawIcon($icon, (New-Object System.Drawing.Rectangle(0, 0, 256, 256)))
    $g.Dispose()
    $bmp.Save("${tmpPng.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $icon.Dispose()
    Write-Host "OK"
  } else { Write-Host "NOICON" }
} catch { Write-Host "ERR:$($_.Exception.Message)" }
`.trim();

    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden',
      '-EncodedCommand', encoded,
    ], { timeout: 15000 }, (err, stdout) => {
      console.log('[ps]', stdout?.trim());
      try {
        if (fs.existsSync(tmpPng)) {
          const data = fs.readFileSync(tmpPng);
          fs.unlinkSync(tmpPng);
          if (data.length > 500) {
            return resolve('data:image/png;base64,' + data.toString('base64'));
          }
        }
      } catch (e) { console.log('[ps read error]', e.message); }
      resolve(null);
    });
  });
}

async function getIcon(rawPath) {
  const exePath = cleanExePath(rawPath);
  if (!exePath) return null;

  const resolved = exePath.replace(/%([^%]+)%/g, (_, k) => process.env[k] || _);
  console.log('[icon] extracting:', resolved);

  // Always use PowerShell first — gives proper 256x256
  const ps = await extractIconPS(resolved);
  if (ps) {
    console.log('[icon] PS success, bytes:', ps.length);
    return ps;
  }

  // Fallback: Electron (may be small but better than nothing)
  try {
    const img = await app.getFileIcon(resolved, { size: 'large' });
    const url = img.toDataURL();
    if (url && url.length > 500) {
      console.log('[icon] Electron fallback, bytes:', url.length);
      return url;
    }
  } catch {}

  console.log('[icon] all methods failed');
  return null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920, height: 680, minWidth: 760, minHeight: 520,
    title: 'LoungeStarter',
    icon: path.join(__dirname, '..', 'assets', 'icons', 'icon.png'),
    frame: false, transparent: false, backgroundColor: '#0e0f11',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); mainWindow.hide(); }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icons', 'tray.png');
  const img = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 64, height: 64 })
    : nativeImage.createEmpty();
  tray = new Tray(img);
  tray.setToolTip('LoungeStarter');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open LoungeStarter', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  checkForUpdates();
});
app.on('window-all-closed', () => {});
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });

// ── Auto-update logic ───────────────────────────────────────────────────
function checkForUpdates() {
  if (!autoUpdater) return;
  try {
    autoUpdater.on('update-available', (info) => {
      console.log('[updater] Update available:', info.version);
      if (mainWindow) {
        mainWindow.webContents.send('update-available', info.version);
      }
      // Auto-download the update
      autoUpdater.downloadUpdate();
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[updater] Update downloaded:', info.version);
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded', info.version);
      }
    });

    autoUpdater.on('error', (err) => {
      console.log('[updater] Error:', err.message);
    });

    autoUpdater.checkForUpdates();
  } catch (e) {
    console.log('[updater] check failed:', e.message);
  }
}

// ── IPC: install update & restart ───────────────────────────────────────
ipcMain.on('install-update', () => {
  if (autoUpdater) {
    app.isQuitting = true;
    autoUpdater.quitAndInstall();
  }
});

// ── IPC: get app version ────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('window-close', () => mainWindow.hide());
ipcMain.on('set-last-browse-dir', (_e, d) => { if (d) lastBrowseDir = d; });

ipcMain.handle('browse-exe-with-icon', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Application', defaultPath: lastBrowseDir,
    filters: [{ name: 'Executables', extensions: ['exe', 'bat', 'cmd', 'lnk'] }, { name: 'All Files', extensions: ['*'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const filePath = result.filePaths[0];
  lastBrowseDir = path.dirname(filePath);
  const icon = await getIcon(filePath);
  return { filePath, icon };
});

ipcMain.handle('extract-icon', async (_e, exePath) => getIcon(exePath));

ipcMain.handle('auto-write-script', (_e, content) => {
  try {
    fs.writeFileSync(getStartupBatPath(), content, 'latin1');
    return { success: true, filePath: getStartupBatPath() };
  } catch (err) { return { success: false, reason: err.message }; }
});

ipcMain.handle('get-bat-path', () => getStartupBatPath());
ipcMain.handle('show-in-explorer', (_e, p) => shell.showItemInFolder(p));

const DATA_FILE      = path.join(app.getPath('userData'), 'apps.json');
const ICON_CACHE_FILE = path.join(app.getPath('userData'), 'icon-cache.json');

// ── Icon cache helpers ────────────────────────────────────────────────────
function loadIconCache() {
  try {
    if (!fs.existsSync(ICON_CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(ICON_CACHE_FILE, 'utf8'));
  } catch { return {}; }
}
function saveIconCache(cache) {
  try { fs.writeFileSync(ICON_CACHE_FILE, JSON.stringify(cache), 'utf8'); } catch {}
}

ipcMain.handle('load-icon-cache', () => loadIconCache());
ipcMain.handle('save-icon-to-cache', (_e, key, dataUrl) => {
  const cache = loadIconCache();
  cache[key] = dataUrl;
  saveIconCache(cache);
  return true;
});
ipcMain.handle('clear-icon-cache', () => {
  try { fs.writeFileSync(ICON_CACHE_FILE, '{}', 'utf8'); return true; } catch { return false; }
});

ipcMain.handle('load-apps', () => {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    console.log('[load-apps]', data?.length, 'apps');
    return data;
  } catch { return null; }
});
ipcMain.handle('save-apps', (_e, apps) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(apps, null, 2), 'utf8');
    console.log('[save-apps]', apps?.length, 'apps');
    return true;
  } catch { return false; }
});