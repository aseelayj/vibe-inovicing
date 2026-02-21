import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { useEmployee } from '@/hooks/use-employees';
import { formatCurrency, formatDate } from '@/lib/format';
import { STATUS_COLORS } from '@/lib/constants';

export function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('payroll');
  const { data: employee, isLoading } = useEmployee(
    id ? parseInt(id, 10) : undefined,
  );

  if (isLoading) return <LoadingSpinner />;
  if (!employee) return <div>Employee not found</div>;

  const isActive = !employee.endDate;
  const entries = (employee as any).payrollEntries ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/payroll/employees')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold sm:text-2xl">{employee.name}</h2>
          <p className="text-sm text-muted-foreground">{employee.role}</p>
        </div>
        <Badge
          className={STATUS_COLORS[isActive ? 'active' : 'inactive']}
          variant="secondary"
        >
          {isActive ? t('active') : t('inactive')}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('baseSalary')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(employee.baseSalary, 'JOD')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('transportAllowance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(employee.transportAllowance, 'JOD')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('sskEnrolled')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {employee.sskEnrolled ? '✓ Yes' : '✗ No'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('employeeDetail')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            {employee.email && (
              <>
                <dt className="text-sm text-muted-foreground">{t('email')}</dt>
                <dd className="text-sm">{employee.email}</dd>
              </>
            )}
            {employee.phone && (
              <>
                <dt className="text-sm text-muted-foreground">{t('phone')}</dt>
                <dd className="text-sm">{employee.phone}</dd>
              </>
            )}
            <dt className="text-sm text-muted-foreground">{t('hireDate')}</dt>
            <dd className="text-sm">{formatDate(employee.hireDate)}</dd>
            {employee.endDate && (
              <>
                <dt className="text-sm text-muted-foreground">
                  {t('endDate')}
                </dt>
                <dd className="text-sm">{formatDate(employee.endDate)}</dd>
              </>
            )}
            {employee.bankAccountName && (
              <>
                <dt className="text-sm text-muted-foreground">
                  {t('bankAccountName')}
                </dt>
                <dd className="text-sm">{employee.bankAccountName}</dd>
              </>
            )}
            {employee.bankIban && (
              <>
                <dt className="text-sm text-muted-foreground">
                  {t('bankIban')}
                </dt>
                <dd className="text-sm font-mono">{employee.bankIban}</dd>
              </>
            )}
            {employee.notes && (
              <>
                <dt className="text-sm text-muted-foreground">
                  {t('notes')}
                </dt>
                <dd className="text-sm sm:col-span-2">{employee.notes}</dd>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('payrollHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('noPayrollHistory')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('month')}</TableHead>
                  <TableHead>{t('basic')}</TableHead>
                  <TableHead>{t('gross')}</TableHead>
                  <TableHead>{t('totalDed')}</TableHead>
                  <TableHead>{t('net')}</TableHead>
                  <TableHead>{t('payment')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry: any) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {entry.payrollRunId ? (
                        <button
                          className="text-primary hover:underline"
                          onClick={() =>
                            navigate(`/payroll/${entry.payrollRunId}`)
                          }
                        >
                          {formatDate(entry.createdAt)}
                        </button>
                      ) : (
                        formatDate(entry.createdAt)
                      )}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(entry.basicSalary, 'JOD')}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(entry.grossSalary, 'JOD')}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(entry.totalDeductions, 'JOD')}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(entry.netSalary, 'JOD')}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={STATUS_COLORS[entry.paymentStatus] || ''}
                        variant="secondary"
                      >
                        {t(entry.paymentStatus)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
