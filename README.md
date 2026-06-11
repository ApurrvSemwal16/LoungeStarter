# ⚡ LoungeStarter

A lightweight Windows desktop app to manage which applications launch at startup.

![LoungeStarter](assets/screenshots/screenshot.png)

---

## 📥 Installation (End Users)

### Option 1: Installer (Recommended)
1. Download the latest **`LoungeStarter Setup x.x.x.exe`** from the [Releases page](#)
2. Run the installer — choose your install directory
3. A desktop shortcut and Start Menu entry are created automatically
4. Done! Launch LoungeStarter from your desktop

### Option 2: Portable
1. Download **`LoungeStarter-Portable-x.x.x.exe`** from the [Releases page](#)
2. Place it anywhere — no installation needed
3. Double-click to run

> **Note:** The portable version stores config in `%APPDATA%\loungestarter\` just like the installed version.

---

## 🛠️ Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ (LTS recommended)
- Windows 10/11

### Quick Start

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/LoungeStarter.git
cd LoungeStarter

# Install dependencies
npm install

# Run in development mode
npm start
```

### Building for Distribution

```bash
# Build both installer + portable
npm run dist

# Or build specific targets:
npm run dist:installer    # NSIS installer only
npm run dist:portable     # Portable .exe only
npm run dist:all          # Both targets
```

Output will be in the `dist/` folder:
- `LoungeStarter Setup x.x.x.exe` — Full NSIS installer
- `LoungeStarter-Portable-x.x.x.exe` — Standalone portable executable

---

## 🚀 How It Works

1. Launch LoungeStarter
2. Click **Add App** to add applications you want to auto-launch
3. Use **Browse** to select the `.exe` file for each app
4. Toggle apps **ON/OFF** with the switch on each card
5. LoungeStarter automatically creates and maintains a `.bat` script in your Windows Startup folder
6. Apps with their switch ON will launch automatically every time you boot Windows

---

## 📁 Project Structure

```
LoungeStarter/
├── src/
│   ├── main.js          Electron main process (window, IPC, file system, auto-updater)
│   ├── preload.js       contextBridge — safe API surface for the renderer
│   ├── index.html       UI markup
│   ├── styles.css       App styles (dark theme)
│   └── renderer.js      UI logic, state management, and IPC calls
├── assets/
│   └── icons/
│       ├── icon.png     App window icon (256×256)
│       └── tray.png     System tray icon
├── package.json         Dependencies + build config
├── electron-builder.yml Detailed build/publish configuration
└── README.md
```

## 📦 Distributing to Other PCs

### For non-technical users:
1. Run `npm run dist` on your development machine
2. Share the `dist/LoungeStarter Setup x.x.x.exe` file (or the portable version)
3. They just double-click the installer — no Node.js or setup required

### For developers:
1. Clone the repo on the target machine
2. Run `npm install` then `npm start`

### Via USB / Network Share:
1. Copy the installer `.exe` from `dist/` to a USB drive
2. Run it on the target PC — works offline, no internet needed

---

## 💾 App Data

| Data | Location |
|------|----------|
| App list | `%APPDATA%\loungestarter\apps.json` |
| Icon cache | `%APPDATA%\loungestarter\icon-cache.json` |
| Startup script | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\LoungeStarter.bat` |

---

## 📋 Features

- ⚡ **One-click toggle** — enable/disable startup apps instantly
- 🎨 **Auto icon extraction** — pulls the actual app icon from `.exe` files
- 📝 **Auto-synced script** — startup `.bat` file is always in sync
- 🖥️ **System tray** — minimizes to tray, runs quietly in background
- 🔒 **Single instance** — prevents duplicate windows from opening
- 🔄 **Auto-updates** — get the latest version automatically (when configured)
- 🎯 **Portable mode** — no installation required with the portable build

---

## 📝 License

MIT
