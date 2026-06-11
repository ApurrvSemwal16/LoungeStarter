/**
 * store.js  (renderer-side)
 * Thin async wrapper around the window.api IPC calls for persistence.
 * Keeps renderer.js clean — storage details live here.
 */

const DEFAULT_APPS = [
  {
    id: 1,
    name: 'Discord',
    icon: null,
    emoji: '💬',
    path: 'C:\\Users\\%USERNAME%\\AppData\\Local\\Discord\\Update.exe --processStart Discord.exe',
    enabled: true,
  },
  {
    id: 2,
    name: 'Steam',
    icon: null,
    emoji: '🎮',
    path: 'C:\\Program Files (x86)\\Steam\\steam.exe',
    enabled: false,
  },
  {
    id: 3,
    name: 'Spotify',
    icon: null,
    emoji: '🎵',
    path: 'C:\\Users\\%USERNAME%\\AppData\\Roaming\\Spotify\\Spotify.exe',
    enabled: true,
  },
];

async function loadApps() {
  const saved = await window.api.loadApps();
  return saved || DEFAULT_APPS;
}

async function saveApps(apps) {
  // Strip icon data URLs before saving — they're re-extracted on load
  const slim = apps.map(({ icon, ...rest }) => rest);
  return window.api.saveApps(slim);
}

export { loadApps, saveApps, DEFAULT_APPS };
