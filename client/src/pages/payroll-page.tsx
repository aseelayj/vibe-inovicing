import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  Plus,
  Wallet,
  Users,
  MoreHorizontal,
  Eye,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  usePayrollRuns,
  useCreatePayrollRun,
  useDeletePayrollRun,
} from '@/hooks/use-payroll';
import { formatCurrency } from '@/lib/format';
import { STATUS_COLORS } from '@/lib/constants';
import type { PayrollRun } from '@vibe/shared';

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function PayrollPage() {
  const { t } = useTranslation('payroll');
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Create form state
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);
  const [newYear, setNewYear] = useState(currentYear);
  const [newDays, setNewDays] = useState(26);
  const [duplicateFrom, setDuplicateFrom] = useState<number | null>(null);

  const { data, isLoading } = usePayrollRuns({ year, status: statusFilter });
  const createRun = useCreatePayrollRun();
  const deleteRun = useDeletePayrollRun();

  const runs = (Array.isArray(data) ? data : []) as PayrollRun[];

  // Fetch all runs (unfiltered) for the duplicate dropdown
  const { data: allRunsData } = usePayrollRuns({});
  const allRuns = (Array.isArray(allRunsData) ? allRunsData : []) as PayrollRun[];

  const handleCreate = async () => {
    try {
      const run = await createRun.mutateAsync({
        year: newYear,
        month: newMonth,
        standardWorkingDays: newDays,
        ...(duplicateFrom ? { duplicateFromRunId: duplicateFrom } : {}),
      });
      setShowCreate(false);
      setDuplicateFrom(null);
      navigate(`/payroll/${run.id}`);
    } catch { /* handled */ }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteRun.mutateAsync(deleteId);
      setDeleteId(null);
    } catch { /* handled */ }
  };

  const monthNames = t('monthNames', { returnObjects: true }) as string[];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold sm:text-2xl">{t('title')}</h2>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/payroll/employees')}
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t('manageEmployees')}
            </span>
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('newRun')}</span>
            <span className="sm:hidden">{tc('new')}</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={String(year)}
          onValueChange={(v) => setYear(parseInt(v, 10))}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tabs
          value={statusFilter}
          onValueChange={setStatusFilter}
          className="flex-1"
        >
          <TabsList>
            <TabsTrigger value="all">{t('all')}</TabsTrigger>
            <TabsTrigger value="draft">{t('draft')}</TabsTrigger>
            <TabsTrigger value="finalized">{t('finalized')}</TabsTrigger>
            <TabsTrigger value="paid">{t('paid')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : runs.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={t('noRuns')}
          description={t('createFirstRun')}
          actionLabel={t('newRun')}
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('month')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t('employees')}
                </TableHead>
                <TableHead>{t('totalNet')}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t('companyCost')}
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <button
                      className="font-medium text-primary hover:underline"
                      onClick={() => navigate(`/payroll/${run.id}`)}
                    >
                      {monthNames[run.month - 1]} {run.year}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={STATUS_COLORS[run.status] || ''}
                      variant="secondary"
                    >
                      {t(run.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {(run as any).entryCount ?? '—'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(run.totalNet, 'JOD')}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {formatCurrency(run.totalCompanyCost, 'JOD')}
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
                          onClick={() => navigate(`/payroll/${run.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                          {tc('view')}
                        </DropdownMenuItem>
                        {run.status === 'draft' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteId(run.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              {tc('delete')}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create run dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => !open && setShowCreate(false)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('createRun')}</DialogTitle>
            <DialogDescription>{t('createRunDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('month')}</Label>
                <Select
                  value={String(newMonth)}
                  onValueChange={(v) => setNewMonth(parseInt(v, 10))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES_EN.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>
                        {monthNames[i] || m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('year')}</Label>
                <Select
                  value={String(newYear)}
                  onValueChange={(v) => setNewYear(parseInt(v, 10))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1].map(
                      (y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('standardWorkingDays')}</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={newDays}
                onChange={(e) => setNewDays(parseInt(e.target.value, 10))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('duplicateFrom')}</Label>
              <Select
                value={duplicateFrom ? String(duplicateFrom) : 'none'}
                onValueChange={(v) =>
                  setDuplicateFrom(v === 'none' ? null : parseInt(v, 10))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noDuplicate')}</SelectItem>
                  {allRuns.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {monthNames[r.month - 1]} {r.year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
            >
              {tc('cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createRun.isPending}
            >
              {createRun.isPending ? tc('creating') : tc('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteRun')}</DialogTitle>
            <DialogDescription>
              {t('deleteRunConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteRun.isPending}
            >
              {deleteRun.isPending ? tc('deleting') : tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
