export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-purple-100 text-purple-700',
  paid: 'bg-green-100 text-green-700',
  partially_paid: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  written_off: 'bg-orange-100 text-orange-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-500',
  converted: 'bg-blue-100 text-blue-700',
  finalized: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-orange-100 text-orange-700',
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
};

export const JOFOTARA_STATUS_COLORS: Record<string, string> = {
  not_submitted: 'bg-gray-100 text-gray-500',
  pending: 'bg-yellow-100 text-yellow-700',
  submitted: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  validation_error: 'bg-orange-100 text-orange-700',
};

export const JORDAN_CITY_NAMES: Record<string, string> = {
  'JO-AM': 'Amman',
  'JO-IR': 'Irbid',
  'JO-AZ': 'Zarqa',
  'JO-BA': 'Balqa',
  'JO-MA': 'Mafraq',
  'JO-KA': 'Karak',
  'JO-JA': 'Jerash',
  'JO-AJ': 'Ajloun',
  'JO-AT': 'Tafilah',
  'JO-MN': "Ma'an",
  'JO-MD': 'Madaba',
  'JO-AQ': 'Aqaba',
};

export const JORDAN_CITY_NAMES_AR: Record<string, string> = {
  'JO-AM': 'عمّان',
  'JO-IR': 'إربد',
  'JO-AZ': 'الزرقاء',
  'JO-BA': 'البلقاء',
  'JO-MA': 'المفرق',
  'JO-KA': 'الكرك',
  'JO-JA': 'جرش',
  'JO-AJ': 'عجلون',
  'JO-AT': 'الطفيلة',
  'JO-MN': 'معان',
  'JO-MD': 'مادبا',
  'JO-AQ': 'العقبة',
};

export const NAV_ITEMS = [
  { labelKey: 'dashboard', path: '/', icon: 'LayoutDashboard' },
  { labelKey: 'invoices', path: '/invoices', icon: 'FileText' },
  { labelKey: 'quotes', path: '/quotes', icon: 'FileCheck' },
  { labelKey: 'clients', path: '/clients', icon: 'Users' },
  { labelKey: 'payments', path: '/payments', icon: 'CreditCard' },
  { labelKey: 'recurring', path: '/recurring', icon: 'RefreshCw' },
  { labelKey: 'bankAccounts', path: '/bank-accounts', icon: 'Landmark' },
  { labelKey: 'transactions', path: '/transactions', icon: 'ArrowLeftRight' },
  { labelKey: 'chartOfAccounts', path: '/chart-of-accounts', icon: 'BookOpen' },
  { labelKey: 'payroll', path: '/payroll', icon: 'Wallet' },
  { labelKey: 'partnerExpenses', path: '/partner-expenses', icon: 'Handshake' },
  { labelKey: 'taxReports', path: '/tax-reports', icon: 'FileSpreadsheet' },
  { labelKey: 'team', path: '/team', icon: 'UsersRound' },
  { labelKey: 'teamActivity', path: '/team-activity', icon: 'Activity' },
  { labelKey: 'settings', path: '/settings', icon: 'Settings' },
] as const;
