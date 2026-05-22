const { app, BrowserWindow, Menu, ipcMain } = require("electron");

const WEB_URL = process.env.ALLGYM_WEB_URL || "http://127.0.0.1:3000";
const WEB_HEALTH_URL = `${WEB_URL.replace(/\/$/, "")}/api/health`;
const API_HEALTH_URL = process.env.ALLGYM_API_URL || "http://127.0.0.1:4000/health";
const BOOT_TIMEOUT_MS = clampNumber(process.env.ALLGYM_ELECTRON_BOOT_TIMEOUT_MS, 45000, 30000, 60000);
const PROBE_TIMEOUT_MS = 2000;
const PROBE_INTERVAL_MS = 1000;
const DEBUG_TOOLS_ENABLED = process.env.ALLGYM_DEBUG === "1";

let activeLaunchToken = 0;
let mainWindow = null;

function clampNumber(value, fallback, min, max) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probeUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function getServiceStatus() {
  const [webAvailable, apiAvailable] = await Promise.all([probeUrl(WEB_HEALTH_URL), probeUrl(API_HEALTH_URL)]);
  return { webAvailable, apiAvailable };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildDiagnosticHtml(status) {
  const webLabel = status.webAvailable ? "Disponible" : "No disponible";
  const apiLabel = status.apiAvailable ? "Disponible" : "No disponible";
  const webTone = status.webAvailable ? "ok" : "bad";
  const apiTone = status.apiAvailable ? "ok" : "bad";

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>All Gym Local - diagnóstico</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Segoe UI", sans-serif;
        --bg: #111827;
        --card: rgba(255, 255, 255, 0.94);
        --text: #111827;
        --muted: #6b7280;
        --ok: #0f766e;
        --bad: #b91c1c;
        --line: rgba(17, 24, 39, 0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top left, rgba(59, 130, 246, 0.18), transparent 34%),
          radial-gradient(circle at right, rgba(16, 185, 129, 0.12), transparent 30%),
          linear-gradient(135deg, #f3f4f6, #e5e7eb);
        color: var(--text);
      }
      main {
        width: min(860px, calc(100vw - 40px));
        padding: 32px;
        border-radius: 24px;
        background: var(--card);
        box-shadow: 0 24px 64px rgba(17, 24, 39, 0.18);
        border: 1px solid rgba(255, 255, 255, 0.7);
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 12px;
        color: var(--muted);
        margin-bottom: 10px;
      }
      h1 { margin: 0 0 8px; font-size: 2rem; }
      p { margin: 0 0 18px; line-height: 1.6; color: var(--muted); }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
        margin: 20px 0 24px;
      }
      .status {
        padding: 16px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.7);
      }
      .status strong { display: block; margin-bottom: 6px; }
      .ok { color: var(--ok); }
      .bad { color: var(--bad); }
      .actions { display: flex; gap: 12px; flex-wrap: wrap; }
      button {
        appearance: none;
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        font: inherit;
        cursor: pointer;
        background: #111827;
        color: white;
      }
      button.secondary {
        background: white;
        color: #111827;
        border: 1px solid var(--line);
      }
      code {
        font-family: Consolas, monospace;
        font-size: 0.95em;
      }
      .footer {
        margin-top: 18px;
        font-size: 12px;
        color: var(--muted);
      }
    </style>
  </head>
  <body>
    <main>
      <div class="eyebrow">All Gym Local</div>
      <h1>Diagnóstico de inicio</h1>
      <p>La UI no respondió a tiempo. Revisa los servicios locales y vuelve a intentar cargar el login real.</p>

      <div class="grid">
        <div class="status">
          <strong class="${webTone}">Web ${webLabel}</strong>
          <span>Objetivo: <code>http://127.0.0.1:3000/api/health</code></span>
        </div>
        <div class="status">
          <strong class="${apiTone}">API ${apiLabel}</strong>
          <span>Objetivo: <code>http://127.0.0.1:4000/health</code></span>
        </div>
      </div>

      <div class="actions">
        <button id="retry">Reintentar cargar UI</button>
        <button class="secondary" id="reload">Volver a comprobar</button>
      </div>

      <div class="footer">
        Si ambos servicios están activos, la app debería abrir <code>${escapeHtml(WEB_URL)}</code>.
      </div>
    </main>

    <script>
      const retry = () => {
        if (window.allgymShell && typeof window.allgymShell.retryLoadUI === "function") {
          window.allgymShell.retryLoadUI();
        }
      };

      document.getElementById("retry").addEventListener("click", retry);
      document.getElementById("reload").addEventListener("click", retry);
    </script>
  </body>
</html>`;
}

async function loadDiagnostic(window) {
  const status = await getServiceStatus();
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildDiagnosticHtml(status))}`);
  if (!window.isVisible()) {
    window.show();
  }
  window.focus();
}

async function waitForWebReady(token) {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (token !== activeLaunchToken || !mainWindow || mainWindow.isDestroyed()) {
      return false;
    }

    if (await probeUrl(WEB_HEALTH_URL)) {
      return true;
    }

    await sleep(PROBE_INTERVAL_MS);
  }

  return false;
}

async function launchApp(window) {
  const token = ++activeLaunchToken;

  try {
    const webReady = await waitForWebReady(token);
    if (token !== activeLaunchToken || !window || window.isDestroyed()) {
      return;
    }

    if (webReady) {
      await window.loadURL(WEB_URL);
      if (!window.isVisible()) {
        window.show();
      }
      window.focus();
      return;
    }

    await loadDiagnostic(window);
  } catch {
    if (token === activeLaunchToken && window && !window.isDestroyed()) {
      await loadDiagnostic(window);
    }
  }
}

function openDevTools() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.openDevTools({ mode: "detach" });
}

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: "Archivo",
      submenu: [
        {
          label: "Reintentar cargar UI",
          accelerator: "F5",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              void launchApp(mainWindow);
            }
          }
        },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "Ver",
      submenu: [
        {
          label: "Abrir DevTools",
          accelerator: "F12",
          click: () => {
            openDevTools();
          }
        }
      ]
    }
  ]);
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    show: false,
    backgroundColor: "#f3f4f6",
    webPreferences: {
      preload: require("node:path").join(__dirname, "preload.js")
    }
  });

  mainWindow = window;
  Menu.setApplicationMenu(buildMenu());

  window.webContents.on("before-input-event", (_event, input) => {
    const isF12 = input.type === "keyDown" && input.key === "F12";
    const isCtrlShiftI =
      input.type === "keyDown" &&
      input.control &&
      input.shift &&
      String(input.key).toUpperCase() === "I";

    if (isF12 || isCtrlShiftI) {
      openDevTools();
    }
  });

  if (DEBUG_TOOLS_ENABLED) {
    window.webContents.once("did-finish-load", () => {
      openDevTools();
    });
  }

  ipcMain.removeAllListeners("allgym-shell:retry-load-ui");
  ipcMain.on("allgym-shell:retry-load-ui", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      void launchApp(mainWindow);
    }
  });

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  void launchApp(window);
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
