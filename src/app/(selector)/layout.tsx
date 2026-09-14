import type { Metadata, Viewport } from "next";

import "../globals.css";
import { PwaRuntime } from "@/components/pwa-runtime";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Rango 90",
  description: "Choose your Rango 90 language.",
  applicationName: "Rango 90",
  manifest: `${basePath}/manifest.webmanifest`,
  icons: {
    icon: [
      { url: `${basePath}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${basePath}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: `${basePath}/icons/icon-192.png`,
  },
};

export const viewport: Viewport = {
  themeColor: "#15241d",
  colorScheme: "light",
  viewportFit: "cover",
};

export default function SelectorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body><PwaRuntime />{children}</body>
    </html>
  );
}
