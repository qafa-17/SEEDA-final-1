import type { CapacitorConfig } from "@capacitor/cli";

// The Android and iPhone apps are a native shell around the live hub: they
// open the deployed site, so every Vercel deploy updates the apps too, with
// no new store release. The hub needs its server (sign-in, Drive, AI,
// publishing), so it can't be bundled as offline files.
const config: CapacitorConfig = {
  // Permanent: identifies the app in both stores. Never change it once published.
  appId: "ca.mru.seedahub",
  appName: "SEEDA",
  // Only the offline page lives inside the app.
  webDir: "mobile/www",
  server: {
    url: "https://seedafinal1.vercel.app/dashboard",
    // Shown when the site can't be reached.
    errorPath: "index.html",
  },
  // Lets the hub recognise its own app, to hide Google and GitHub sign-in,
  // which Google and GitHub block inside apps (error: disallowed_useragent).
  appendUserAgent: "SEEDAHubApp",
  backgroundColor: "#ffffff",
};

export default config;
