/* renderer.js */

// ── Script generator ──────────────────────────────────────────────────────
function generateScript(apps) {
  const enabled = apps.filter(a => a.enabled && a.path && a.path.trim());
  const lines = [
    '@echo off',
    ':: ================================================',
    '::  LoungeStarter -- startup script',
    `::  Generated: ${new Date().toLocaleString()}`,
    '::  Managed by LoungeStarter -- do not edit manually.',
    ':: ================================================',
    '',
  ];
  if (enabled.length === 0) {
    lines.push(':: No apps enabled. Open LoungeStarter to configure.');
  } else {
    enabled.forEach(a => {
      // Sanitize: strip outer quotes, trim whitespace
      const safePath = a.path.trim().replace(/^["']+|["']+$/g, '');
      // Sanitize app name to ASCII for bat comment safety
      const safeName = a.name.replace(/[^\x20-\x7E]/g, '');
      lines.push(`:: ${safeName}`);
      lines.push(`start "" "${safePath}"`);
      lines.push('');
    });
  }
  lines.push('exit');
  return lines.join('\r\n');
}

// ── State ─────────────────────────────────────────────────────────────────
const EMOJIS = ['💬','🎮','🎵','💻','🌐','📁','📊','🔧','🖥️','🎨','📝','🔒','📷','🎬','🚀','⚙️'];
let apps = [];
let nextId = 1;
let selectedEmoji = EMOJIS[0];
let batPath = '';
let isFirstLoad = true;

// ── Persist (save app list WITHOUT icons to disk) ─────────────────────────
function persistApps() {
  // Save full app objects minus the icon data URL (too large for JSON)
  const slim = apps.map(a => ({
    id:      a.id,
    name:    a.name,
    emoji:   a.emoji,
    path:    a.path,
    enabled: a.enabled,
  }));
  console.log('[persist] saving', slim.length, 'apps:', slim.map(a => `${a.name}="${a.path}"`));
  window.api.saveApps(slim);
}

// ── Auto-save: write bat to startup folder + save JSON ────────────────────
async function autoSave() {
  persistApps();
  const script = generateScript(apps);
  const result = await window.api.autoWriteScript(script);
  if (result && !result.success) {
    console.warn('[autoSave] bat write failed:', result.reason);
  }
  return result;
}

// ── Boot ──────────────────────────────────────────────────────────────────
(async () => {
  const [saved, resolvedBatPath, iconCache, appVersion] = await Promise.all([
    window.api.loadApps(),
    window.api.getBatPath(),
    window.api.loadIconCache(),
    window.api.getAppVersion(),
  ]);

  batPath = resolvedBatPath;
  console.log('[boot] loaded apps from disk:', saved);
  console.log('[boot] icon cache keys:', Object.keys(iconCache).length);
  console.log('[boot] version:', appVersion);

  // Show version in titlebar
  const versionEl = document.getElementById('app-version');
  if (versionEl) versionEl.textContent = `v${appVersion}`;

  if (saved && saved.length > 0) {
    // Restore cached icons instantly — no PowerShell needed for already-known apps
    apps = saved.map(a => {
      const cacheKey = (a.path || '').trim().toLowerCase();
      const cachedIcon = cacheKey ? (iconCache[cacheKey] || null) : null;
      return { ...a, icon: cachedIcon };
    });
  } else {
    // First launch on this PC — start with an empty list
    apps = [];
    persistApps();
  }

  nextId = Math.max(...apps.map(a => a.id), 0) + 1;
  isFirstLoad = false;

  render();

  // Force-regenerate the bat file on boot (ensures clean ASCII encoding)
  autoSave();

  // Show welcome overlay if first launch (no apps)
  if (apps.length === 0) {
    showWelcome();
  }

  // Background-extract icons only for apps without a cached icon
  for (const a of apps) {
    if (!a.path || a.icon) continue;   // skip if no path or already have icon
    const cacheKey = a.path.trim().toLowerCase();
    try {
      const icon = await window.api.extractIcon(a.path);
      if (icon) {
        a.icon = icon;
        // Persist to cache so next boot is instant
        window.api.saveIconToCache(cacheKey, icon);
        const iconEl = document.querySelector(`#card-${a.id} .app-icon`);
        if (iconEl) iconEl.innerHTML = `<img src="${icon}" alt="${a.name}" style="width:100%;height:100%;object-fit:contain">`;
      } else {
        console.warn('[icon] no icon returned for', a.name, a.path);
      }
    } catch(e) {
      console.warn('[icon] error for', a.name, e.message);
    }
  }

  // ── Auto-update listeners ─────────────────────────────────────────────
  window.api.onUpdateAvailable((version) => {
    console.log('[update] available:', version);
    showUpdateBanner(`Update v${version} available — downloading…`, false);
  });

  window.api.onUpdateDownloaded((version) => {
    console.log('[update] downloaded:', version);
    showUpdateBanner(`Update v${version} ready — restart to install`, true);
  });
})();


// ── Welcome screen for first-time users ──────────────────────────────────
function showWelcome() {
  const overlay = document.getElementById('welcome-overlay');
  if (overlay) overlay.classList.add('show');
}

function dismissWelcome() {
  const overlay = document.getElementById('welcome-overlay');
  if (overlay) overlay.classList.remove('show');
  openModal();
}

// ── Update banner ────────────────────────────────────────────────────────
function showUpdateBanner(message, canInstall) {
  let banner = document.getElementById('update-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'update-banner';
    document.getElementById('app').prepend(banner);
  }
  banner.innerHTML = `
    <div class="update-text">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>${message}</span>
    </div>
    ${canInstall ? '<button class="btn-update" onclick="window.api.installUpdate()">Restart & Update</button>' : ''}
  `;
  banner.classList.add('show');
}

// ── Titlebar ──────────────────────────────────────────────────────────────
document.getElementById('btn-min').addEventListener('click', () => window.api.minimize());
document.getElementById('btn-max').addEventListener('click', () => window.api.maximize());
document.getElementById('btn-close').addEventListener('click', () => window.api.close());

// Wire up welcome overlay dismiss
const welcomeBtn = document.getElementById('welcome-start-btn');
if (welcomeBtn) welcomeBtn.addEventListener('click', dismissWelcome);

// ── Render ────────────────────────────────────────────────────────────────
function render() {
  const grid = document.getElementById('app-grid');
  grid.innerHTML = '';

  apps.forEach(a => {
    const card = document.createElement('div');
    card.className = 'app-card' + (a.enabled ? ' enabled' : '');
    card.id = 'card-' + a.id;

    const iconContent = a.icon
      ? `<img src="${a.icon}" alt="${a.name}" style="width:100%;height:100%;object-fit:contain">`
      : (a.emoji || '📦');

    card.innerHTML = `
      <div class="card-top">
        <div class="app-identity">
          <div class="app-icon">${iconContent}</div>
          <div>
            <div class="app-name">${a.name}</div>
            <div class="app-status">
              <span class="status-dot ${a.enabled ? 'on' : ''}"></span>
              ${a.enabled ? 'Will launch at startup' : 'Disabled'}
            </div>
          </div>
        </div>
        <div class="toggle-wrap">
          <span class="toggle-label">${a.enabled ? 'ON' : 'OFF'}</span>
          <label class="toggle">
            <input type="checkbox" ${a.enabled ? 'checked' : ''} data-id="${a.id}">
            <span class="track"></span>
            <span class="thumb"></span>
          </label>
        </div>
      </div>
      <div class="card-bottom">
        <input class="path-input" type="text"
          value="${(a.path || '').replace(/"/g, '&quot;')}"
          placeholder="Browse or paste .exe path…"
          data-id="${a.id}">
        <button class="btn-browse" data-id="${a.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          </svg>
          Browse
        </button>
        <button class="btn-remove-card" data-id="${a.id}" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    `;
    grid.appendChild(card);
  });

  // Add tile
  const addTile = document.createElement('div');
  addTile.className = 'add-card';
  addTile.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
    Add new application
  `;
  addTile.addEventListener('click', openModal);
  grid.appendChild(addTile);

  // Events
  grid.querySelectorAll('input[type=checkbox][data-id]').forEach(el =>
    el.addEventListener('change', e => toggleApp(+e.target.dataset.id, e.target.checked)));
  grid.querySelectorAll('.path-input[data-id]').forEach(el =>
    el.addEventListener('change', e => updatePath(+e.target.dataset.id, e.target.value)));
  grid.querySelectorAll('.btn-browse[data-id]').forEach(el =>
    el.addEventListener('click', e => browseForApp(+e.currentTarget.dataset.id)));
  grid.querySelectorAll('.btn-remove-card[data-id]').forEach(el =>
    el.addEventListener('click', e => removeApp(+e.currentTarget.dataset.id)));

  updateStats();
  renderPreview();
}

function updateStats() {
  document.getElementById('stat-enabled').textContent = apps.filter(a => a.enabled).length;
  document.getElementById('stat-total').textContent = apps.length;
}

function renderPreview() {
  const enabled = apps.filter(a => a.enabled && a.path && a.path.trim());
  const pre = document.getElementById('code-preview');
  if (enabled.length === 0) {
    pre.innerHTML = '<span class="cc">:: No apps enabled yet.</span>';
  } else {
    let html = '<span class="cc">@echo off\n</span>';
    enabled.forEach(a => {
      html += `<span class="cc">:: ${a.name}\n</span>`;
      html += `<span class="cmd">start "" "${a.path}"\n</span>`;
    });
    html += '<span class="cc">exit</span>';
    pre.innerHTML = html;
  }
  const pathEl = document.getElementById('bat-path-label');
  if (pathEl) pathEl.textContent = batPath || 'Locating…';
}

// ── Actions ───────────────────────────────────────────────────────────────
function toggleApp(id, val) {
  apps = apps.map(a => a.id === id ? { ...a, enabled: val } : a);
  render();
  autoSave().then(() => toast(`${val ? 'Added to' : 'Removed from'} startup ✓`));
}

async function updatePath(id, val) {
  apps = apps.map(a => a.id === id ? { ...a, path: val } : a);
  console.log('[updatePath]', id, val);
  persistApps();
  renderPreview();

  // Try to load icon for the new path
  if (val) {
    const icon = await window.api.extractIcon(val).catch(() => null);
    if (icon) {
      apps = apps.map(a => a.id === id ? { ...a, icon } : a);
      const iconEl = document.querySelector(`#card-${id} .app-icon`);
      if (iconEl) iconEl.innerHTML = `<img src="${icon}" alt="" style="width:100%;height:100%;object-fit:contain">`;
      window.api.saveIconToCache(val.trim().toLowerCase(), icon);
    }
  }
  autoSave();
}

async function browseForApp(id) {
  const result = await window.api.browseExeWithIcon();
  if (!result) return;

  const { filePath, icon } = result;
  console.log('[browse] picked:', filePath, 'icon:', icon ? 'yes' : 'no');
  apps = apps.map(a => a.id === id ? { ...a, path: filePath, icon: icon || null } : a);

  // Persist icon to cache
  if (icon) window.api.saveIconToCache(filePath.trim().toLowerCase(), icon);

  // Update card immediately without full re-render
  const card = document.getElementById('card-' + id);
  if (card) {
    const iconEl = card.querySelector('.app-icon');
    const pathInput = card.querySelector('.path-input');
    if (iconEl) iconEl.innerHTML = icon
      ? `<img src="${icon}" alt="" style="width:100%;height:100%;object-fit:contain">`
      : (apps.find(a => a.id === id)?.emoji || '📦');
    if (pathInput) pathInput.value = filePath;
  }

  persistApps();
  renderPreview();
  autoSave().then(() => toast('Path set & script updated ✓'));
}

function removeApp(id) {
  const a = apps.find(x => x.id === id);
  if (!a) return;
  if (!confirm(`Remove "${a.name}"?`)) return;
  apps = apps.filter(x => x.id !== id);
  render();
  autoSave().then(() => toast(`"${a.name}" removed ✓`));
}

async function copyScript() {
  await navigator.clipboard.writeText(generateScript(apps));
  toast('Copied ✓');
}

// ── Toolbar ───────────────────────────────────────────────────────────────
document.getElementById('btn-add-app').addEventListener('click', openModal);
document.getElementById('btn-copy').addEventListener('click', copyScript);
document.getElementById('btn-open-folder').addEventListener('click', () => {
  if (batPath) window.api.showInExplorer(batPath);
});

// ── Modal ─────────────────────────────────────────────────────────────────
let modalIcon = null;

function openModal() {
  document.getElementById('new-name').value = '';
  document.getElementById('new-path').value = '';
  modalIcon = null;
  selectedEmoji = EMOJIS[0];
  buildEmojiGrid();
  updateModalIconPreview();
  document.getElementById('modal-add').classList.add('open');
  setTimeout(() => document.getElementById('new-name').focus(), 50);
}

function closeModal() {
  document.getElementById('modal-add').classList.remove('open');
}

function buildEmojiGrid() {
  const grid = document.getElementById('emoji-grid');
  grid.innerHTML = '';
  EMOJIS.forEach(e => {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn' + (e === selectedEmoji ? ' selected' : '');
    btn.textContent = e;
    btn.type = 'button';
    btn.addEventListener('click', () => {
      selectedEmoji = e;
      grid.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      updateModalIconPreview();
    });
    grid.appendChild(btn);
  });
}

function updateModalIconPreview() {
  const preview = document.getElementById('modal-icon-preview');
  if (!preview) return;
  preview.innerHTML = modalIcon
    ? `<img src="${modalIcon}" alt="" style="width:100%;height:100%;object-fit:contain">`
    : selectedEmoji;
}

async function confirmAdd() {
  const name = document.getElementById('new-name').value.trim();
  const pathVal = document.getElementById('new-path').value.trim();
  if (!name) { document.getElementById('new-name').focus(); return; }

  let icon = modalIcon;
  if (!icon && pathVal) {
    icon = await window.api.extractIcon(pathVal).catch(() => null);
  }

  apps.push({ id: nextId++, name, emoji: selectedEmoji, icon: icon || null, path: pathVal, enabled: true });
  closeModal();
  render();
  autoSave().then(() => toast(`"${name}" added ✓`));
}

document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-confirm').addEventListener('click', confirmAdd);
document.getElementById('new-browse').addEventListener('click', async () => {
  const result = await window.api.browseExeWithIcon();
  if (!result) return;
  document.getElementById('new-path').value = result.filePath;
  modalIcon = result.icon;
  updateModalIconPreview();
});
document.getElementById('modal-add').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
document.getElementById('new-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('new-path').focus();
});

// ── Toast ─────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}