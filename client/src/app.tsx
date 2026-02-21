import { Routes, Route, Navigate } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { LoginPage } from '@/pages/login-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { InvoicesPage } from '@/pages/invoices-page';
import { InvoiceCreatePage } from '@/pages/invoice-create-page';
import { InvoiceDetailPage } from '@/pages/invoice-detail-page';
import { InvoiceEditPage } from '@/pages/invoice-edit-page';
import { ClientsPage } from '@/pages/clients-page';
import { ClientDetailPage } from '@/pages/client-detail-page';
import { QuotesPage } from '@/pages/quotes-page';
import { QuoteCreatePage } from '@/pages/quote-create-page';
import { QuoteDetailPage } from '@/pages/quote-detail-page';
import { PaymentsPage } from '@/pages/payments-page';
import { SettingsPage } from '@/pages/settings-page';
import { RecurringPage } from '@/pages/recurring-page';
import { QuoteEditPage } from '@/pages/quote-edit-page';
import { BankAccountsPage } from '@/pages/bank-accounts-page';
import { TransactionsPage } from '@/pages/transactions-page';
import { TaxReportsPage } from '@/pages/tax-reports-page';
import { NotFoundPage } from '@/pages/not-found-page';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/new" element={<InvoiceCreatePage />} />
        <Route path="invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="invoices/:id/edit" element={<InvoiceEditPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:id" element={<ClientDetailPage />} />
        <Route path="quotes" element={<QuotesPage />} />
        <Route path="quotes/new" element={<QuoteCreatePage />} />
        <Route path="quotes/:id" element={<QuoteDetailPage />} />
        <Route path="quotes/:id/edit" element={<QuoteEditPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="recurring" element={<RecurringPage />} />
        <Route path="bank-accounts" element={<BankAccountsPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="tax-reports" element={<TaxReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
