import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  UsersRound,
  Plus,
  MoreHorizontal,
  Shield,
  UserCheck,
  UserX,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
} from '@/hooks/use-users';
import { useAuth } from '@/hooks/use-auth';
import { formatDate, formatTimeAgo } from '@/lib/format';

export function TeamPage() {
  const { t } = useTranslation('team');
  const { t: tc } = useTranslation('common');
  const { user: currentUser, isOwner } = useAuth();
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<{
    id: number;
    name: string;
    email: string;
    role: string;
  } | null>(null);

  // Add form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<string>('accountant');

  const resetAddForm = () => {
    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewRole('accountant');
  };

  const handleAdd = async () => {
    await createUser.mutateAsync({
      name: newName,
      email: newEmail,
      password: newPassword,
      role: newRole,
    });
    setAddOpen(false);
    resetAddForm();
  };

  const handleEdit = async () => {
    if (!editingUser) return;
    await updateUser.mutateAsync({
      id: editingUser.id,
      data: {
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role,
      },
    });
    setEditOpen(false);
    setEditingUser(null);
  };

  const handleDeactivate = (id: number) => {
    deleteUser.mutate(id);
  };

  const handleReactivate = (id: number) => {
    updateUser.mutate({ id, data: { isActive: true } });
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        {isOwner && (
          <Dialog open={addOpen} onOpenChange={(open) => {
            setAddOpen(open);
            if (!open) resetAddForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                {t('addMember')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('addMember')}</DialogTitle>
                <DialogDescription>
                  {t('addMemberDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{tc('name')}</Label>
                  <Input
                    id="name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t('namePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{tc('email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{tc('password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('passwordPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('role')}</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accountant">
                        {t('accountant')}
                      </SelectItem>
                      <SelectItem value="owner">
                        {t('owner')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAddOpen(false)}
                >
                  {tc('cancel')}
                </Button>
                <Button
                  onClick={handleAdd}
                  disabled={
                    !newName || !newEmail || !newPassword
                    || createUser.isPending
                  }
                >
                  {tc('add')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersRound className="h-5 w-5" />
            {t('teamMembers')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!users?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('noMembers')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tc('name')}</TableHead>
                  <TableHead>{tc('email')}</TableHead>
                  <TableHead>{t('role')}</TableHead>
                  <TableHead>{t('lastLogin')}</TableHead>
                  <TableHead>{tc('status')}</TableHead>
                  {isOwner && (
                    <TableHead className="w-12" />
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.name}
                      {u.id === currentUser?.id && (
                        <span className="ms-2 text-xs text-muted-foreground">
                          ({t('you')})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={u.role === 'owner' ? 'default' : 'secondary'}
                      >
                        {u.role === 'owner' ? (
                          <Shield className="me-1 h-3 w-3" />
                        ) : null}
                        {t(u.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.lastLoginAt
                        ? formatTimeAgo(u.lastLoginAt)
                        : t('never')}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.isActive ? 'default' : 'outline'}
                        className={
                          u.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'text-muted-foreground'
                        }
                      >
                        {u.isActive ? tc('active') : tc('inactive')}
                      </Badge>
                    </TableCell>
                    {isOwner && (
                      <TableCell>
                        {u.id !== currentUser?.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingUser({
                                    id: u.id,
                                    name: u.name,
                                    email: u.email,
                                    role: u.role,
                                  });
                                  setEditOpen(true);
                                }}
                              >
                                {tc('edit')}
                              </DropdownMenuItem>
                              {u.isActive ? (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeactivate(u.id)}
                                >
                                  <UserX className="me-2 h-4 w-4" />
                                  {t('deactivate')}
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleReactivate(u.id)}
                                >
                                  <UserCheck className="me-2 h-4 w-4" />
                                  {t('reactivate')}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editMember')}</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{tc('name')}</Label>
                <Input
                  value={editingUser.name}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{tc('email')}</Label>
                <Input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('role')}</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(val) =>
                    setEditingUser({ ...editingUser, role: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accountant">
                      {t('accountant')}
                    </SelectItem>
                    <SelectItem value="owner">
                      {t('owner')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
            >
              {tc('cancel')}
            </Button>
            <Button
              onClick={handleEdit}
              disabled={updateUser.isPending}
            >
              {tc('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
