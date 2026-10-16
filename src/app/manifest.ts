import type { MetadataRoute } from "next";

// Lets staff install ShelfLife on a phone or tablet ("Add to Home Screen"): own icon, full screen, no browser bar.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ShelfLife: sell it before it expires",
    short_name: "ShelfLife",
    description: "Expiry tracking and rescue bundles for small cafés and grocers.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf9",
    theme_color: "#059669",
    categories: ["business", "food", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Scan a bill", url: "/stock", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Bundles", url: "/bundles", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
