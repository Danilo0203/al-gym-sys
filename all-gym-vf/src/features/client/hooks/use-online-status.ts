"use client";

import { useEffect, useState } from "react";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const syncState = () => setIsOnline(window.navigator.onLine);
    syncState();

    window.addEventListener("online", syncState);
    window.addEventListener("offline", syncState);

    return () => {
      window.removeEventListener("online", syncState);
      window.removeEventListener("offline", syncState);
    };
  }, []);

  return isOnline;
}
