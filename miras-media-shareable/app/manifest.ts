import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MIRAS: Udaipur heritage and local makers",
    short_name: "MIRAS",
    description: "Find a heritage site, read a sourced story, and meet a local artisan in Udaipur.",
    start_url: "/",
    id: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F5EEE0",
    theme_color: "#131B31",
    orientation: "portrait",
    categories: ["travel", "culture", "heritage"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    shortcuts: [
      {
        name: "Explore Heritage Sites",
        short_name: "Explore",
        description: "Discover Udaipur heritage landmarks",
        url: "/",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Local Artisans",
        short_name: "Artisans",
        description: "Meet local makers",
        url: "/artisans",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Camera Identifier",
        short_name: "Camera",
        description: "Identify sites with your camera",
        url: "/camera",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Offline Copies",
        short_name: "Offline",
        description: "Access saved offline guides and plans",
        url: "/offline",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
