import { useState, useRef, useEffect } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import { useClients, useCreateClient } from '@/hooks/use-clients';
import { cn } from '@/lib/cn';

export interface ClientPickerProps {
  value: number | null;
  onChange: (clientId: number | null) => void;
}

export function ClientPicker({ value, onChange }: ClientPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: clientsData } = useClients(search);
  const createClient = useCreateClient();

  const clients = clientsData?.data ?? [];
  const selectedClient = clients.find((c) => c.id === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setShowCreate(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    try {
      const client = await createClient.mutateAsync({
        name: newClientName.trim(),
      });
      onChange(client.id);
      setNewClientName('');
      setShowCreate(false);
      setIsOpen(false);
    } catch {
      // error handled by mutation
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        Client
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm',
          'transition-colors',
          isOpen
            ? 'border-primary-500 ring-2 ring-primary-500/20'
            : 'border-gray-300 hover:border-gray-400',
        )}
      >
        <span className={selectedClient ? 'text-gray-900' : 'text-gray-400'}>
          {selectedClient
            ? `${selectedClient.name}${selectedClient.company ? ` - ${selectedClient.company}` : ''}`
            : 'Select a client...'}
        </span>
        <Search className="h-4 w-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="p-2">
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/20"
              autoFocus
            />
          </div>

          <ul className="max-h-48 overflow-y-auto py-1">
            {clients.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-500">
                No clients found
              </li>
            )}
            {clients.map((client) => (
              <li key={client.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(client.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  {value === client.id && (
                    <Check className="h-4 w-4 shrink-0 text-primary-500" />
                  )}
                  <div className={value === client.id ? '' : 'pl-6'}>
                    <p className="font-medium text-gray-900">{client.name}</p>
                    {client.company && (
                      <p className="text-xs text-gray-500">{client.company}</p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t border-gray-100 p-2">
            {showCreate ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Client name"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm placeholder-gray-400 focus:border-primary-500 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateClient();
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateClient}
                  disabled={createClient.isPending}
                  className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50"
              >
                <Plus className="h-4 w-4" />
                Create new client
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
