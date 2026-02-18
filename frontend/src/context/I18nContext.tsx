import { createContext, useContext, useMemo, useState } from 'react'

export type Language = 'de' | 'en'

const DEFAULT_LANG = (import.meta.env.VITE_UI_LANG as Language) || 'de'

type I18nContextValue = {
  lang: Language
  setLang: (lang: Language) => void
  tr: (de: string, en: string) => string
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>(DEFAULT_LANG === 'en' ? 'en' : 'de')

  const value = useMemo<I18nContextValue>(() => ({
    lang,
    setLang,
    tr: (de: string, en: string) => (lang === 'en' ? en : de),
  }), [lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
