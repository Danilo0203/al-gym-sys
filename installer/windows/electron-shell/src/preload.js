window.addEventListener("DOMContentLoaded", () => {
  const versionEl = document.getElementById("electron-version");
  if (versionEl) {
    versionEl.textContent = process.versions.electron;
  }
});
