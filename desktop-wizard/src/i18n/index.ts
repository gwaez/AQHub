import { ar, type UiCopy } from "./ar.ts";
import { en } from "./en.ts";

export type UiLanguage = "ar" | "en";
export type { UiCopy };
export { ar, en };

export function localeCopy(lang: UiLanguage | string | undefined): UiCopy {
  return lang === "en" ? en : ar;
}

export function applyDocumentLocale(lang: UiLanguage): void {
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === "en" ? "ltr" : "rtl";
}
