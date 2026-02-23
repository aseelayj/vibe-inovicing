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
import { ClientForm } from '@/components/clients/client-form';
import {
  useClients,
  useCreateClient,
  useDeleteClient,
} from '@/hooks/use-clients';
import { formatDate } from '@/lib/format';
import { ApiError } from '@/lib/api-client';

export function ClientsPage() {
  const { t } = useTranslation('clients');
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const { data, isLoading } = useClients(search);
  const createClient = useCreateClient();
  const deleteClient = useDeleteClient();

  const clients = (Array.isArray(data) ? data : data?.data ?? []) as any[];

  const handleCreate = async (formData: Record<string, unknown>) => {
    try {
      const client = await createClient.mutateAsync(formData);
      setShowCreate(false);
      navigate(`/clients/${client.id}`);
    } catch {
      // handled
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteClient.mutateAsync({ id: deleteId });
      setDeleteId(null);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409 && err.data) {
        setDeleteWarning(err.data.message as string || err.message);
      }
    }
  };

  const handleForceDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteClient.mutateAsync({ id: deleteId, force: true });
      setDeleteId(null);
      setDeleteWarning(null);
    } catch {
      // handled
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold sm:text-2xl">{t('title')}</h2>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            {t('subtitle')}
          </p>
        </div>
        <Button size="sm" className="shrink-0 sm:size-default" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('newClient')}</span>
          <span className="sm:hidden">{tc('new')}</span>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full ps-9 sm:w-80"
        />
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('noClientsFound')}
          description={
            search
              ? t('adjustSearch')
              : t('addFirstClient')
          }
          actionLabel={!search ? t('addClient') : undefined}
          onAction={!search ? () => setShowCreate(true) : undefined}
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('email')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('company')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('created')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link
                      to={`/clients/${client.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {client.name}
                    </Link>
                  </TableCell>
                  <TableCell>{client.email || '--'}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {client.company || '--'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {client.createdAt
                      ? formatDate(client.createdAt)
                      : '--'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            navigate(`/clients/${client.id}`)
                          }
                        >
                          <Eye className="h-4 w-4" />
                          {tc('view')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            navigate(`/clients/${client.id}`)
                          }
                        >
                          <Pencil className="h-4 w-4" />
                          {tc('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteId(client.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {tc('delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create client dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => !open && setShowCreate(false)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('newClient')}</DialogTitle>
            <DialogDescription>
              {t('newClientDesc')}
            </DialogDescription>
          </DialogHeader>
          <ClientForm
            onSubmit={handleCreate}
            isLoading={createClient.isPending}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setDeleteWarning(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteClient')}</DialogTitle>
            <DialogDescription>
              {deleteWarning || t('deleteClientConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteId(null); setDeleteWarning(null); }}>
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={deleteWarning ? handleForceDelete : handleDelete}
              disabled={deleteClient.isPending}
            >
              {deleteClient.isPending ? tc('deleting') : deleteWarning ? tc('deleteAnyway') : tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
