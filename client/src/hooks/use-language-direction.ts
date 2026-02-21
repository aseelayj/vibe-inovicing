import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export function useLanguageDirection() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return {
    dir: i18n.language === 'ar' ? 'rtl' as const : 'ltr' as const,
    isRTL: i18n.language === 'ar',
  };
}
