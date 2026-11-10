import type { Metadata, Viewport } from "next";
// Fonts are self-hosted from npm: no request to Google at build or run time.
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/sora";
import { brand } from "@/config/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.tagline,
  // This is an internal tool: keep it out of search results.
  robots: { index: false, follow: false },
  // Installed on a phone: the app's name, its home-screen icon, and full screen on iPhone.
  applicationName: "SEEDA",
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "SEEDA", statusBarStyle: "default" },
};

// The phone's status bar matches the page, in both themes.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#14111f" },
  ],
};

// Only the two known values are ever applied, whatever is in storage.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The script below may set data-theme before React loads, so the server's
    // <html> and the browser's can differ on purpose: suppressHydrationWarning.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Runs before the first paint, so a saved dark theme never flashes light. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
