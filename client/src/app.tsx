import { Routes, Route, Navigate } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { useLanguageDirection } from '@/hooks/use-language-direction';
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
import { SettingsLayout } from '@/pages/settings/settings-layout';
import { GeneralSettingsPage } from '@/pages/settings/general-settings-page';
import { EmailSettingsPage } from '@/pages/settings/email-settings-page';
import { IntegrationsSettingsPage } from '@/pages/settings/integrations-settings-page';
import { TaxSettingsPage } from '@/pages/settings/tax-settings-page';
import { RecurringPage } from '@/pages/recurring-page';
import { QuoteEditPage } from '@/pages/quote-edit-page';
import { BankAccountsPage } from '@/pages/bank-accounts-page';
import { TransactionsPage } from '@/pages/transactions-page';
import { TaxReportsPage } from '@/pages/tax-reports-page';
import { TeamPage } from '@/pages/team-page';
import { TeamActivityPage } from '@/pages/team-activity-page';
import { PayrollPage } from '@/pages/payroll-page';
import { PayrollRunDetailPage } from '@/pages/payroll-run-detail-page';
import { EmployeesPage } from '@/pages/employees-page';
import { EmployeeDetailPage } from '@/pages/employee-detail-page';
import { PartnerExpensesPage } from '@/pages/partner-expenses-page';
import { ChartOfAccountsPage } from '@/pages/chart-of-accounts-page';
import { CommitmentsPage } from '@/pages/commitments-page';
import { ProductsPage } from '@/pages/products-page';
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
  useLanguageDirection();

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
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="payroll/:id" element={<PayrollRunDetailPage />} />
        <Route path="payroll/employees" element={<EmployeesPage />} />
        <Route path="payroll/employees/:id" element={<EmployeeDetailPage />} />
        <Route path="partner-expenses" element={<PartnerExpensesPage />} />
        <Route path="chart-of-accounts" element={<ChartOfAccountsPage />} />
        <Route path="commitments" element={<CommitmentsPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="tax-reports" element={<TaxReportsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="team-activity" element={<TeamActivityPage />} />
        <Route path="settings" element={<SettingsLayout />}>
          <Route index element={<GeneralSettingsPage />} />
          <Route path="email" element={<EmailSettingsPage />} />
          <Route path="integrations" element={<IntegrationsSettingsPage />} />
          <Route path="tax" element={<TaxSettingsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
