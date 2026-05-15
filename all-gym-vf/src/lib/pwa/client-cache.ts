"use client";

const CACHE_PREFIX = "all-gym-";

export async function clearPwaCaches() {
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    registration?.active?.postMessage({ type: "CLEAR_CLIENT_CACHES" });
  }

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key)));
  }
}
