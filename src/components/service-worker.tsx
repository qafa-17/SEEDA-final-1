"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (public/sw.js), which shows an offline page
 * when the installed app is opened without a connection. Production only:
 * in development it would get in the way of hot reloading.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not supported or blocked (for example in a private window): the site works the same without it.
    });
  }, []);
  return null;
}
