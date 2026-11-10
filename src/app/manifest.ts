import type { MetadataRoute } from "next";

// Makes the hub installable on a phone or computer ("Add to Home Screen" /
// "Install app"), opening full screen like an app. Served at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SEEDA Content Operations Hub",
    short_name: "SEEDA",
    description: "Import, review, approve and publish EPCMst Knowledge Hub articles.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Dashboard", url: "/dashboard" },
      { name: "Ideas", url: "/ideas" },
    ],
  };
}
