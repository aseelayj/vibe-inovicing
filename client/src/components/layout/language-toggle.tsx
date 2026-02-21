import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LanguageToggle() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const next = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(next);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="gap-1.5 text-sm font-medium"
      aria-label={i18n.language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      <Languages className="h-4 w-4" />
      {i18n.language === 'ar' ? 'EN' : 'AR'}
    </Button>
  );
}
