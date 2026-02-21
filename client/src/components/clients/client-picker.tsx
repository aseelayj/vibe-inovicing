import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useClients, useCreateClient } from '@/hooks/use-clients';
import { cn } from '@/lib/utils';

export interface ClientPickerProps {
  value: number | null;
  onChange: (clientId: number | null) => void;
}

export function ClientPicker({ value, onChange }: ClientPickerProps) {
  const { t } = useTranslation('clients');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  const { data: clientsData } = useClients(search);
  const createClient = useCreateClient();

  const clients = (Array.isArray(clientsData) ? clientsData : clientsData?.data ?? []) as any[];
  const selectedClient = clients.find((c) => c.id === value);

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    try {
      const client = await createClient.mutateAsync({
        name: newClientName.trim(),
      });
      onChange(client.id);
      setNewClientName('');
      setShowCreate(false);
      setOpen(false);
    } catch {
      // error handled by mutation
    }
  };

  return (
    <div className="space-y-2">
      <Label>{t('client')}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className={cn(!selectedClient && 'text-muted-foreground')}>
              {selectedClient
                ? `${selectedClient.name}${selectedClient.company ? ` - ${selectedClient.company}` : ''}`
                : t('selectClient')}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t('searchClients')}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>{t('noClientsFound')}</CommandEmpty>
              <CommandGroup>
                {clients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={String(client.id)}
                    onSelect={() => {
                      onChange(client.id);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <Check
                      className={cn(
                        'h-4 w-4',
                        value === client.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <div>
                      <p className="font-medium">{client.name}</p>
                      {client.company && (
                        <p className="text-xs text-muted-foreground">
                          {client.company}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <CommandSeparator />
            <div className="p-2">
              {showCreate ? (
                <div className="flex gap-2">
                  <Input
                    placeholder={t('clientName')}
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateClient();
                      }
                    }}
                    autoFocus
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateClient}
                    disabled={createClient.isPending}
                  >
                    {t('add')}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setShowCreate(true)}
                >
                  <Plus className="h-4 w-4" />
                  {t('createNewClient')}
                </Button>
              )}
            </div>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
