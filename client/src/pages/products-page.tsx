import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Package,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from '@/hooks/use-products';
import { formatCurrency } from '@/lib/format';
import { useSettings } from '@/hooks/use-settings';
import { CURRENCIES, PRODUCT_TYPES } from '@vibe/shared';
import type { Product, Currency, ProductType } from '@vibe/shared';

function ProductForm({
  product,
  onSubmit,
  onCancel,
  isLoading,
  defaultCurrency,
}: {
  product?: Product;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading: boolean;
  defaultCurrency: Currency;
}) {
  const { t } = useTranslation('products');
  const { t: tc } = useTranslation('common');
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [unitPrice, setUnitPrice] = useState(
    product?.unitPrice?.toString() ?? '',
  );
  const [currency, setCurrency] = useState<Currency>(
    product?.currency ?? defaultCurrency,
  );
  const [category, setCategory] = useState(product?.category ?? '');
  const [type, setType] = useState<ProductType>(product?.type ?? 'service');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description: description || null,
      unitPrice: parseFloat(unitPrice) || 0,
      currency,
      category: category || null,
      type,
      isActive: product?.isActive ?? true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t('productName')} *
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t('description')}
        </label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('descriptionPlaceholder')}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('unitPrice')} *
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {tc('currency')}
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('type')}
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ProductType)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t('category')}
        </label>
        <Input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder={t('categoryPlaceholder')}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {tc('cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !name.trim() || !unitPrice}
        >
          {isLoading
            ? tc('saving')
            : product
              ? tc('update')
              : tc('create')}
        </Button>
      </div>
    </form>
  );
}

export function ProductsPage() {
  const { t } = useTranslation('products');
  const { t: tc } = useTranslation('common');
  const [showCreate, setShowCreate] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const { data: settings } = useSettings();
  const defaultCurrency = (settings?.defaultCurrency ?? 'USD') as Currency;
  const { data: productsData, isLoading } = useProducts(
    search ? { search } : undefined,
  );
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const items = productsData ?? [];

  const handleCreate = async (formData: Record<string, unknown>) => {
    try {
      await createProduct.mutateAsync(formData);
      setShowCreate(false);
    } catch {
      // handled by hook
    }
  };

  const handleUpdate = async (formData: Record<string, unknown>) => {
    if (!editProduct) return;
    try {
      await updateProduct.mutateAsync({
        id: editProduct.id,
        data: formData,
      });
      setEditProduct(null);
    } catch {
      // handled
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteProduct.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // handled
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold sm:text-2xl">{t('title')}</h2>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            {t('subtitle')}
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0 sm:size-default"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('addProduct')}</span>
          <span className="sm:hidden">{tc('add')}</span>
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="ps-9"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          actionLabel={t('addProduct')}
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tc('name')}</TableHead>
                <TableHead>{t('type')}</TableHead>
                <TableHead>{t('category')}</TableHead>
                <TableHead className="text-end">{t('unitPrice')}</TableHead>
                <TableHead>{tc('status')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.id}
                  className={!item.isActive ? 'opacity-50' : undefined}
                >
                  <TableCell>
                    <div>
                      <span className="font-medium">{item.name}</span>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {item.type === 'service' ? t('typeService') : t('typeProduct')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.category || '--'}
                  </TableCell>
                  <TableCell className="text-end font-mono">
                    {formatCurrency(
                      parseFloat(String(item.unitPrice)),
                      item.currency,
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? 'default' : 'secondary'}>
                      {item.isActive ? tc('active') : tc('inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs" aria-label="Actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditProduct(item)}>
                          <Pencil className="h-4 w-4" />
                          {tc('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteId(item.id)}
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

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && setShowCreate(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('newTitle')}</DialogTitle>
            <DialogDescription>{t('newDescription')}</DialogDescription>
          </DialogHeader>
          <ProductForm
            onSubmit={handleCreate}
            isLoading={createProduct.isPending}
            onCancel={() => setShowCreate(false)}
            defaultCurrency={defaultCurrency}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editProduct !== null} onOpenChange={(open) => !open && setEditProduct(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('editTitle')}</DialogTitle>
            <DialogDescription>{t('editDescription')}</DialogDescription>
          </DialogHeader>
          {editProduct && (
            <ProductForm
              product={editProduct}
              onSubmit={handleUpdate}
              isLoading={updateProduct.isPending}
              onCancel={() => setEditProduct(null)}
              defaultCurrency={defaultCurrency}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteMessage')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteProduct.isPending}
            >
              {deleteProduct.isPending ? tc('deleting') : tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
