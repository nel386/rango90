import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { Rango90App } from "@/components/rango90-app";
import { isLocale, type Locale } from "@/i18n/routing";

export default async function LocaleHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params;

  if (!isLocale(value)) {
    notFound();
  }

  setRequestLocale(value);
  return <Rango90App locale={value as Locale} />;
}
