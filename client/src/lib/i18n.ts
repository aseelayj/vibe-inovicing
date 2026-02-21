import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import commonEn from '@/locales/en/common.json';
import navEn from '@/locales/en/nav.json';
import dashboardEn from '@/locales/en/dashboard.json';
import invoicesEn from '@/locales/en/invoices.json';
import quotesEn from '@/locales/en/quotes.json';
import clientsEn from '@/locales/en/clients.json';
import paymentsEn from '@/locales/en/payments.json';
import settingsEn from '@/locales/en/settings.json';
import chatEn from '@/locales/en/chat.json';
import recurringEn from '@/locales/en/recurring.json';
import bankAccountsEn from '@/locales/en/bank-accounts.json';
import transactionsEn from '@/locales/en/transactions.json';
import taxReportsEn from '@/locales/en/tax-reports.json';

import commonAr from '@/locales/ar/common.json';
import navAr from '@/locales/ar/nav.json';
import dashboardAr from '@/locales/ar/dashboard.json';
import invoicesAr from '@/locales/ar/invoices.json';
import quotesAr from '@/locales/ar/quotes.json';
import clientsAr from '@/locales/ar/clients.json';
import paymentsAr from '@/locales/ar/payments.json';
import settingsAr from '@/locales/ar/settings.json';
import chatAr from '@/locales/ar/chat.json';
import recurringAr from '@/locales/ar/recurring.json';
import bankAccountsAr from '@/locales/ar/bank-accounts.json';
import transactionsAr from '@/locales/ar/transactions.json';
import taxReportsAr from '@/locales/ar/tax-reports.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: commonEn,
        nav: navEn,
        dashboard: dashboardEn,
        invoices: invoicesEn,
        quotes: quotesEn,
        clients: clientsEn,
        payments: paymentsEn,
        settings: settingsEn,
        chat: chatEn,
        recurring: recurringEn,
        'bank-accounts': bankAccountsEn,
        transactions: transactionsEn,
        'tax-reports': taxReportsEn,
      },
      ar: {
        common: commonAr,
        nav: navAr,
        dashboard: dashboardAr,
        invoices: invoicesAr,
        quotes: quotesAr,
        clients: clientsAr,
        payments: paymentsAr,
        settings: settingsAr,
        chat: chatAr,
        recurring: recurringAr,
        'bank-accounts': bankAccountsAr,
        transactions: transactionsAr,
        'tax-reports': taxReportsAr,
      },
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
