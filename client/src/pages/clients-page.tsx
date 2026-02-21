import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { ClientForm } from '@/components/clients/client-form';
import { useClients, useCreateClient } from '@/hooks/use-clients';

export function ClientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading } = useClients(search);
  const createClient = useCreateClient();

  const clients = data?.data ?? [];

  const handleCreate = async (formData: Record<string, unknown>) => {
    try {
      const client = await createClient.mutateAsync(formData);
      setShowCreate(false);
      navigate(`/clients/${client.id}`);
    } catch {
      // handled
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clients</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your client directory
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          New Client
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 sm:w-80"
        />
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients found"
          description={
            search
              ? 'Try adjusting your search term.'
              : 'Add your first client to get started.'
          }
          actionLabel={!search ? 'Add Client' : undefined}
          onAction={!search ? () => setShowCreate(true) : undefined}
        />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link
                      to={`/clients/${client.id}`}
                      className="font-medium text-primary-600 hover:text-primary-700"
                    >
                      {client.name}
                    </Link>
                  </TableCell>
                  <TableCell>{client.email || '--'}</TableCell>
                  <TableCell>{client.company || '--'}</TableCell>
                  <TableCell>{client.phone || '--'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Client"
      >
        <ClientForm
          onSubmit={handleCreate}
          isLoading={createClient.isPending}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>
    </div>
  );
}
