const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("allgymShell", {
  electronVersion: process.versions.electron,
  retryLoadUI: () => ipcRenderer.send("allgym-shell:retry-load-ui")
});
