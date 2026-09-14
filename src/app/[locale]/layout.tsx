import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";

import "../globals.css";

import { isLocale, routing } from "@/i18n/routing";
import { PwaRuntime } from "@/components/pwa-runtime";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export const viewport: Viewport = {
  themeColor: "#15241d",
  colorScheme: "light",
  viewportFit: "cover",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: value } = await params;

  if (!isLocale(value)) {
    return {};
  }

  setRequestLocale(value);
  const t = await getTranslations({ locale: value, namespace: "Metadata" });

  return {
    title: t("title"),
    description: t("description"),
    manifest: `${basePath}/manifest-${value}.webmanifest`,
    icons: {
      icon: [
        { url: `${basePath}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
        { url: `${basePath}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
      ],
      apple: `${basePath}/icons/icon-192.png`,
    },
    alternates: {
      languages: {
        es: `${basePath}/es/`,
        en: `${basePath}/en/`,
      },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale: value } = await params;

  if (!isLocale(value)) {
    notFound();
  }

  setRequestLocale(value);
  const messages = await getMessages();

  return (
    <html lang={value}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <PwaRuntime />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
