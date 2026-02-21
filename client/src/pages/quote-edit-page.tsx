import { useNavigate, useParams } from 'react-router';
import { useForm, FormProvider, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
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
import { ClientPicker } from '@/components/clients/client-picker';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useQuote, useUpdateQuote } from '@/hooks/use-quotes';
import { formatCurrency } from '@/lib/format';

type QuoteFormValues = z.infer<typeof createQuoteSchema>;

export function QuoteEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: quote, isLoading } = useQuote(id);
  const updateQuote = useUpdateQuote();

  if (isLoading) return <LoadingSpinner />;
  if (!quote) return null;

  return (
    <QuoteEditForm
      quote={quote}
      onSubmit={async (data) => {
        try {
          await updateQuote.mutateAsync({
            id: quote.id,
            data: data as Record<string, unknown>,
          });
          navigate(`/quotes/${quote.id}`);
        } catch {
          // handled by mutation
        }
      }}
      isSubmitting={updateQuote.isPending}
    />
  );
}

function QuoteEditForm({
  quote,
  onSubmit,
  isSubmitting,
}: {
  quote: any;
  onSubmit: (data: QuoteFormValues) => Promise<void>;
  isSubmitting: boolean;
}) {
  const methods = useForm<QuoteFormValues>({
    resolver: zodResolver(createQuoteSchema),
    defaultValues: {
      clientId: quote.clientId,
      issueDate: quote.issueDate?.split('T')[0] || '',
      expiryDate: quote.expiryDate?.split('T')[0] || '',
      currency: quote.currency || 'USD',
      taxRate: quote.taxRate || 0,
      discountAmount: quote.discountAmount || 0,
      notes: quote.notes || '',
      terms: quote.terms || '',
      lineItems: quote.lineItems?.map((item: any) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })) ?? [{ description: '', quantity: 1, unitPrice: 0 }],
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to={`/quotes/${quote.id}`}
          className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
            Edit {quote.quoteNumber}
          </h2>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            Update the quote details below
          </p>
        </div>
      </div>

      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quote Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ClientPicker
                value={watch('clientId') ?? null}
                onChange={(clientId) => setValue('clientId', clientId)}
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issueDate">Issue Date</Label>
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
                  <Label htmlFor="expiryDate">Expiry Date</Label>
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
                <Label>Currency</Label>
                <Select
                  value={watch('currency') || 'USD'}
                  onValueChange={(val) => setValue('currency', val as any)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select currency" />
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
              <CardTitle>Line Items</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  append({ description: '', quantity: 1, unitPrice: 0 })
                }
              >
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
              {fields.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <div className="col-span-5">Description</div>
                    <div className="col-span-2">Quantity</div>
                    <div className="col-span-2">Unit Price</div>
                    <div className="col-span-2 text-right">Amount</div>
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
                            placeholder="Item description"
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
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
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
                  <Label htmlFor="discountAmount">Discount Amount</Label>
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
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(subtotal, currency)}</span>
                  </div>
                  {taxRate > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Tax ({taxRate}%)
                      </span>
                      <span>{formatCurrency(taxAmount, currency)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-destructive">
                        -{formatCurrency(discount, currency)}
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(total, currency)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="Notes visible to the client..."
                  {...register('notes')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terms">Terms & Conditions</Label>
                <Textarea
                  id="terms"
                  rows={3}
                  placeholder="Terms and conditions..."
                  {...register('terms')}
                />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Update Quote
          </Button>
        </form>
      </FormProvider>
    </div>
  );
}
