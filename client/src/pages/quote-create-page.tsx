import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useForm, FormProvider, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, addDays } from 'date-fns';
import { ArrowLeft, Plus, Trash2, Loader2, Package } from 'lucide-react';
import { Link } from 'react-router';
import { createQuoteSchema, CURRENCIES } from '@vibe/shared';
import type { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ClientPicker } from '@/components/clients/client-picker';
import { useCreateQuote } from '@/hooks/use-quotes';
import { useProducts } from '@/hooks/use-products';
import { formatCurrency } from '@/lib/format';

type QuoteFormValues = z.infer<typeof createQuoteSchema>;

export function QuoteCreatePage() {
  const { t } = useTranslation('quotes');
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const createQuote = useCreateQuote();
  const { data: productsData } = useProducts({ active: 'true' });
  const activeProducts = Array.isArray(productsData) ? productsData : [];

  const today = format(new Date(), 'yyyy-MM-dd');
  const defaultExpiry = format(addDays(new Date(), 30), 'yyyy-MM-dd');

  const methods = useForm<QuoteFormValues>({
    resolver: zodResolver(createQuoteSchema),
    defaultValues: {
      clientId: null,
      issueDate: today,
      expiryDate: defaultExpiry,
      currency: 'USD',
      taxRate: 0,
      discountAmount: 0,
      notes: '',
      terms: '',
      lineItems: [{ description: '', quantity: 1, unitPrice: 0 }],
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = methods;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lineItems',
  });

  const watchedItems = watch('lineItems') || [];
  const currency = watch('currency') || 'USD';
  const taxRate = Number(watch('taxRate')) || 0;
  const discount = Number(watch('discountAmount')) || 0;

  const subtotal = watchedItems.reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discount;

  const onSubmit = async (data: QuoteFormValues) => {
    try {
      const quote = await createQuote.mutateAsync(data as Record<string, unknown>);
      navigate(`/quotes/${quote.id}`);
    } catch {
      // handled by mutation
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/quotes"
          className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{t('createTitle')}</h2>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            {t('createSubtitle')}
          </p>
        </div>
      </div>

      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('quoteDetails')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ClientPicker
                value={watch('clientId') ?? null}
                onChange={(clientId) => setValue('clientId', clientId)}
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issueDate">{t('issueDate')}</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    {...register('issueDate')}
                  />
                  {errors.issueDate?.message && (
                    <p className="text-sm text-destructive">
                      {errors.issueDate.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">{t('expiryDate')}</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    {...register('expiryDate')}
                  />
                  {errors.expiryDate?.message && (
                    <p className="text-sm text-destructive">
                      {errors.expiryDate.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{tc('currency')}</Label>
                <Select
                  value={watch('currency') || 'USD'}
                  onValueChange={(val) => setValue('currency', val as any)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={tc('selectCurrency')} />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.currency?.message && (
                  <p className="text-sm text-destructive">
                    {errors.currency.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{tc('lineItems')}</CardTitle>
              <div className="flex gap-1">
                {activeProducts.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="sm">
                        <Package className="h-4 w-4" />
                        {tc('addFromCatalog')}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                      {activeProducts.map((product) => (
                        <DropdownMenuItem
                          key={product.id}
                          onClick={() =>
                            append({
                              description: product.name + (product.description ? ` - ${product.description}` : ''),
                              quantity: 1,
                              unitPrice: Number(product.unitPrice),
                            })
                          }
                        >
                          <div className="flex w-full items-center justify-between gap-4">
                            <span className="truncate">{product.name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatCurrency(Number(product.unitPrice), product.currency)}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    append({ description: '', quantity: 1, unitPrice: 0 })
                  }
                >
                  <Plus className="h-4 w-4" />
                  {tc('addItem')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {fields.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <div className="col-span-5">{tc('description')}</div>
                    <div className="col-span-2">{tc('quantity')}</div>
                    <div className="col-span-2">{tc('unitPrice')}</div>
                    <div className="col-span-2 text-end">{tc('amount')}</div>
                    <div className="col-span-1" />
                  </div>

                  {fields.map((field, index) => {
                    const qty = Number(watchedItems[index]?.quantity) || 0;
                    const price = Number(watchedItems[index]?.unitPrice) || 0;
                    const amount = qty * price;

                    return (
                      <div
                        key={field.id}
                        className="grid grid-cols-12 items-start gap-3"
                      >
                        <div className="col-span-5">
                          <Input
                            placeholder={t('itemDescriptionPlaceholder')}
                            {...register(`lineItems.${index}.description`)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="1"
                            {...register(`lineItems.${index}.quantity`, {
                              valueAsNumber: true,
                            })}
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            {...register(`lineItems.${index}.unitPrice`, {
                              valueAsNumber: true,
                            })}
                          />
                        </div>
                        <div className="col-span-2 flex h-9 items-center justify-end text-sm font-medium">
                          {formatCurrency(amount, currency)}
                        </div>
                        <div className="col-span-1 flex h-9 items-center justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {typeof errors.lineItems?.message === 'string' && (
                <p className="mt-2 text-sm text-destructive" role="alert">
                  {errors.lineItems.message}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tc('summary')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taxRate">{tc('taxRate')}</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    {...register('taxRate', { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discountAmount">{tc('discountAmount')}</Label>
                  <Input
                    id="discountAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    {...register('discountAmount', { valueAsNumber: true })}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-2 pt-4">
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{tc('subtotal')}</span>
                    <span>{formatCurrency(subtotal, currency)}</span>
                  </div>
                  {taxRate > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {tc('tax')} ({taxRate}%)
                      </span>
                      <span>{formatCurrency(taxAmount, currency)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{tc('discount')}</span>
                      <span className="text-destructive">
                        -{formatCurrency(discount, currency)}
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>{tc('total')}</span>
                    <span>{formatCurrency(total, currency)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('additionalInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">{tc('notes')}</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder={t('notesPlaceholder')}
                  {...register('notes')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terms">{tc('termsAndConditions')}</Label>
                <Textarea
                  id="terms"
                  rows={3}
                  placeholder={t('termsPlaceholder')}
                  {...register('terms')}
                />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={createQuote.isPending}>
            {createQuote.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {t('saveQuote')}
          </Button>
        </form>
      </FormProvider>
    </div>
  );
}
