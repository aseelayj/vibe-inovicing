import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router';
import type { PageContext } from '@vibe/shared';

const SECTION_MAP: Record<string, string> = {
  '/': 'dashboard',
  '/invoices': 'invoices',
  '/quotes': 'quotes',
  '/clients': 'clients',
  '/payments': 'payments',
  '/recurring': 'recurring',
  '/bank-accounts': 'bank-accounts',
  '/transactions': 'transactions',
  '/settings': 'settings',
};

export function usePageContext(): PageContext {
  const location = useLocation();
  const params = useParams();

  return useMemo(() => {
    const path = location.pathname;
    const segments = path.split('/').filter(Boolean);

    let section = 'dashboard';
    let entityType: string | undefined;
    let entityId: number | undefined;
    let action: string | undefined;

    // Match known sections
    for (const [prefix, name] of Object.entries(SECTION_MAP)) {
      if (prefix === '/' && path === '/') {
        section = name;
        break;
      }
      if (prefix !== '/' && path.startsWith(prefix)) {
        section = name;
        break;
      }
    }

    // Detect entity type and ID from URL pattern like /invoices/5
    if (segments.length >= 2) {
      const sectionName = segments[0];
      const idOrAction = segments[1];

      const entityTypeMap: Record<string, string> = {
        invoices: 'invoice',
        quotes: 'quote',
        clients: 'client',
        payments: 'payment',
        recurring: 'recurring',
        'bank-accounts': 'bank_account',
        transactions: 'transaction',
      };

      if (entityTypeMap[sectionName]) {
        if (idOrAction === 'new' || idOrAction === 'create') {
          action = 'create';
          entityType = entityTypeMap[sectionName];
        } else if (!isNaN(Number(idOrAction))) {
          entityType = entityTypeMap[sectionName];
          entityId = Number(idOrAction);
        }
      }
    }

    // Detect edit action
    if (segments.length >= 3 && segments[2] === 'edit') {
      action = 'edit';
    }

    // Use params as fallback
    if (params.id && !entityId) {
      entityId = Number(params.id);
    }

    return { path, section, entityType, entityId, action };
  }, [location.pathname, params]);
}
