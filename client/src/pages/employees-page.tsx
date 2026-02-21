import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import {
  Plus,
  Search,
  Users,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  useEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
} from '@/hooks/use-employees';
import { formatCurrency, formatDate } from '@/lib/format';
import { STATUS_COLORS } from '@/lib/constants';
import { EMPLOYEE_ROLES } from '@vibe/shared';
import type { Employee } from '@vibe/shared';

function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
  onSubmit: (data: Record<string, unknown>) => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation('payroll');
  const { t: tc } = useTranslation('common');

  const [form, setForm] = useState<Record<string, unknown>>(() =>
    employee
      ? {
          name: employee.name,
          email: employee.email || '',
          phone: employee.phone || '',
          role: employee.role,
          baseSalary: employee.baseSalary,
          transportAllowance: employee.transportAllowance,
          sskEnrolled: employee.sskEnrolled,
          hireDate: employee.hireDate,
          endDate: employee.endDate || '',
          bankAccountName: employee.bankAccountName || '',
          bankIban: employee.bankIban || '',
          notes: employee.notes || '',
        }
      : {
          name: '',
          email: '',
          phone: '',
          role: 'Web Developer',
          baseSalary: 0,
          transportAllowance: 0,
          sskEnrolled: false,
          hireDate: new Date().toISOString().split('T')[0],
          endDate: '',
          bankAccountName: '',
          bankIban: '',
          notes: '',
        },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...form,
      baseSalary: Number(form.baseSalary),
      transportAllowance: Number(form.transportAllowance),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {employee ? t('editEmployee') : t('newEmployee')}
          </DialogTitle>
          <DialogDescription>
            {!employee && t('newEmployeeDesc')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('name')} *</Label>
              <Input
                required
                value={form.name as string}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('role')} *</Label>
              <Select
                value={form.role as string}
                onValueChange={(v) => setForm({ ...form, role: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('email')}</Label>
              <Input
                type="email"
                value={form.email as string}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('phone')}</Label>
              <Input
                value={form.phone as string}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('baseSalary')} (JOD) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.baseSalary as number}
                onChange={(e) =>
                  setForm({ ...form, baseSalary: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t('transportAllowance')} (JOD)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.transportAllowance as number}
                onChange={(e) =>
                  setForm({ ...form, transportAllowance: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t('hireDate')} *</Label>
              <Input
                type="date"
                required
                value={form.hireDate as string}
                onChange={(e) =>
                  setForm({ ...form, hireDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t('endDate')}</Label>
              <Input
                type="date"
                value={form.endDate as string}
                onChange={(e) =>
                  setForm({ ...form, endDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t('bankAccountName')}</Label>
              <Input
                value={form.bankAccountName as string}
                onChange={(e) =>
                  setForm({ ...form, bankAccountName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t('bankIban')}</Label>
              <Input
                value={form.bankIban as string}
                onChange={(e) =>
                  setForm({ ...form, bankIban: e.target.value })
                }
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.sskEnrolled as boolean}
              onCheckedChange={(v) => setForm({ ...form, sskEnrolled: v })}
            />
            <Label>{t('sskEnrolled')}</Label>
          </div>
          <div className="space-y-2">
            <Label>{t('notes')}</Label>
            <Textarea
              value={form.notes as string}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? tc('saving') : tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EmployeesPage() {
  const { t } = useTranslation('payroll');
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useEmployees({ search });
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const list = (Array.isArray(data) ? data : []) as Employee[];

  const handleCreate = async (formData: Record<string, unknown>) => {
    try {
      const emp = await createEmployee.mutateAsync(formData);
      setShowCreate(false);
      navigate(`/payroll/employees/${emp.id}`);
    } catch { /* handled */ }
  };

  const handleUpdate = async (formData: Record<string, unknown>) => {
    if (!editEmployee) return;
    try {
      await updateEmployee.mutateAsync({
        id: editEmployee.id,
        data: formData,
      });
      setEditEmployee(null);
    } catch { /* handled */ }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteEmployee.mutateAsync(deleteId);
      setDeleteId(null);
    } catch { /* handled */ }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold sm:text-2xl">
            {t('employeesTitle')}
          </h2>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            {t('employeesSubtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/payroll')}
          >
            {t('title')}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('newEmployee')}</span>
            <span className="sm:hidden">{tc('new')}</span>
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={`${t('name')}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full ps-9 sm:w-80"
        />
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('noEmployees')}
          description={search ? '' : t('addFirstEmployee')}
          actionLabel={!search ? t('newEmployee') : undefined}
          onAction={!search ? () => setShowCreate(true) : undefined}
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('role')}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t('baseSalary')}
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  {t('sskEnrolled')}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t('status')}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t('hireDate')}
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((emp) => {
                const isActive = !emp.endDate;
                return (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <Link
                        to={`/payroll/employees/${emp.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {emp.name}
                      </Link>
                    </TableCell>
                    <TableCell>{emp.role}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {formatCurrency(emp.baseSalary, 'JOD')}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {emp.sskEnrolled ? '✓' : '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge
                        className={
                          STATUS_COLORS[isActive ? 'active' : 'inactive']
                        }
                        variant="secondary"
                      >
                        {isActive ? t('active') : t('inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {formatDate(emp.hireDate)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-xs">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(`/payroll/employees/${emp.id}`)
                            }
                          >
                            <Eye className="h-4 w-4" />
                            {tc('view')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setEditEmployee(emp)}
                          >
                            <Pencil className="h-4 w-4" />
                            {tc('edit')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteId(emp.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            {tc('delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <EmployeeFormDialog
          open={showCreate}
          onOpenChange={(open) => !open && setShowCreate(false)}
          onSubmit={handleCreate}
          isLoading={createEmployee.isPending}
        />
      )}

      {/* Edit dialog */}
      {editEmployee && (
        <EmployeeFormDialog
          key={editEmployee.id}
          open={!!editEmployee}
          onOpenChange={(open) => !open && setEditEmployee(null)}
          employee={editEmployee}
          onSubmit={handleUpdate}
          isLoading={updateEmployee.isPending}
        />
      )}

      {/* Delete confirmation */}
      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteEmployee')}</DialogTitle>
            <DialogDescription>
              {t('deleteEmployeeConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteEmployee.isPending}
            >
              {deleteEmployee.isPending ? tc('deleting') : tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
