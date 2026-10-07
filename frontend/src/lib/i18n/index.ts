import { en, type TranslationKey } from './en';
import { ru } from './ru';

export type { TranslationKey };
export type Language = 'en' | 'ru';

const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, ru };

export const UI_LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
];

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'ru';
}

/** Russian plural forms: [one (1), few (2-4), many (0, 5-9, 11-14, ...)]. */
export function pluralRu(count: number, forms: [string, string, string]): string {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

export function translate(
  lang: Language,
  key: TranslationKey,
  vars?: Record<string, string | number>
): string {
  let text: string = dictionaries[lang][key] ?? en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
