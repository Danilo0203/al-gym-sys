const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const DEFAULT_WEB_URL = process.env.ALLGYM_WEB_URL || "http://127.0.0.1:3000";

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  let loadedFallback = false;
  const loadPlaceholder = () => {
    if (loadedFallback) {
      return;
    }

    loadedFallback = true;
    void window.loadFile(path.join(__dirname, "placeholder.html"));
  };

  window.webContents.once("did-fail-load", () => {
    loadPlaceholder();
  });

  window.loadURL(DEFAULT_WEB_URL).catch(() => {
    loadPlaceholder();
  });
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
