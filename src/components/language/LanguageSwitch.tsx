"use client";

import { useLanguage } from "@/lib/i18n/use-language";
import { LANGUAGE_NATIVE, type UiLanguage } from "@/lib/i18n/strings";
import styles from "./picker.module.css";

const ORDER: UiLanguage[] = [
  "hi-IN", "mr-IN", "ta-IN", "te-IN", "kn-IN",
  "ml-IN", "bn-IN", "gu-IN", "pa-IN", "en-IN",
];

/**
 * Change the app's language after the first run.
 *
 * A real `<select>`, not a custom menu: it is keyboard-operable for free, it
 * opens as the system picker on a phone, and it is the one control here that
 * must work for someone who has set the app to a language they cannot read
 * and wants out.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const { language, set, t } = useLanguage();

  return (
    <label className={`${styles.switch} ${className ?? ""}`}>
      <span className="visually-hidden">{t("changeLanguage")}</span>
      <select
        className={styles.switchSelect}
        value={language}
        onChange={(e) => set(e.target.value as UiLanguage)}
      >
        {ORDER.map((code) => (
          <option key={code} value={code} lang={code}>
            {LANGUAGE_NATIVE[code]}
          </option>
        ))}
      </select>
      <span className={styles.switchFace} aria-hidden lang={language}>
        {LANGUAGE_NATIVE[language]}
      </span>
    </label>
  );
}
