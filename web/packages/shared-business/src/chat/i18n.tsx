import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import { chatMessages } from "./locales";

export type Lang = "zh-cn" | "zh-tw" | "en" | "ja";

/** 前缀，避免覆盖主站翻译 */
const PREFIX = "_shared.";

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: "zh-cn",
  setLang: () => {},
  t: (key: string) => key,
});

const LANG_KEY = "agentplugin-lang";

function detectBrowserLanguage(): Lang {
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("zh-tw") || browserLang.startsWith("zh-hant")) {
    return "zh-tw";
  }
  if (browserLang.startsWith("zh")) {
    return "zh-cn";
  }
  if (browserLang.startsWith("ja")) {
    return "ja";
  }
  if (browserLang.startsWith("en")) {
    return "en";
  }
  return "zh-cn";
}

export function ChatI18nProvider({
  lang: initialLang = "zh-cn",
  children,
}: {
  lang?: Lang;
  children: ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(() => {
    // Priority: localStorage > browser language > default
    const stored = localStorage.getItem(LANG_KEY) as Lang | null;
    if (stored) {
      return stored;
    }
    return detectBrowserLanguage();
  });

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem(LANG_KEY, newLang);
  }, []);

  const t = useCallback((key: string): string => {
    const messages = chatMessages[lang] || chatMessages["zh-cn"];
    // 自动添加前缀
    const fullKey = PREFIX + key;
    const parts = fullKey.split(".");
    let result: any = messages;
    for (const part of parts) {
      if (result && typeof result === "object" && part in result) {
        result = result[part];
      } else {
        return key;
      }
    }
    return typeof result === "string" ? result : key;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
