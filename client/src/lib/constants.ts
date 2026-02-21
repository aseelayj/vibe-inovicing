export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-purple-100 text-purple-700',
  paid: 'bg-green-100 text-green-700',
  partially_paid: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-500',
  converted: 'bg-blue-100 text-blue-700',
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

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: 'LayoutDashboard' },
  { label: 'Invoices', path: '/invoices', icon: 'FileText' },
  { label: 'Quotes', path: '/quotes', icon: 'FileCheck' },
  { label: 'Clients', path: '/clients', icon: 'Users' },
  { label: 'Payments', path: '/payments', icon: 'CreditCard' },
  { label: 'Recurring', path: '/recurring', icon: 'RefreshCw' },
  { label: 'Bank Accounts', path: '/bank-accounts', icon: 'Landmark' },
  { label: 'Transactions', path: '/transactions', icon: 'ArrowLeftRight' },
  { label: 'Tax Reports', path: '/tax-reports', icon: 'FileSpreadsheet' },
  { label: 'Settings', path: '/settings', icon: 'Settings' },
] as const;
