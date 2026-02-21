import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { createClientSchema, JORDAN_CITY_CODES } from '@vibe/shared';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ClientFormValues = z.infer<typeof createClientSchema>;

export interface ClientFormProps {
  defaultValues?: Partial<ClientFormValues>;
  onSubmit: (data: ClientFormValues) => void;
  isLoading?: boolean;
  onCancel?: () => void;
}

export function ClientForm({
  defaultValues,
  onSubmit,
  isLoading,
  onCancel,
}: ClientFormProps) {
  const { t } = useTranslation('clients');
  const { t: tc } = useTranslation('common');
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      email: defaultValues?.email ?? '',
      phone: defaultValues?.phone ?? '',
      company: defaultValues?.company ?? '',
      addressLine1: defaultValues?.addressLine1 ?? '',
      addressLine2: defaultValues?.addressLine2 ?? '',
      city: defaultValues?.city ?? '',
      state: defaultValues?.state ?? '',
      postalCode: defaultValues?.postalCode ?? '',
      country: defaultValues?.country ?? '',
      taxId: defaultValues?.taxId ?? '',
      cityCode: defaultValues?.cityCode ?? '',
      notes: defaultValues?.notes ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('contactInformation')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{tc('name')}</Label>
            <Input
              id="name"
              placeholder={t('clientName')}
              aria-invalid={!!errors.name}
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">{tc('email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('emailPlaceholder')}
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{tc('phone')}</Label>
              <Input
                id="phone"
                type="tel"
                placeholder={t('phonePlaceholder')}
                aria-invalid={!!errors.phone}
                {...register('phone')}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">
                  {errors.phone.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">{tc('company')}</Label>
            <Input
              id="company"
              placeholder={t('companyName')}
              aria-invalid={!!errors.company}
              {...register('company')}
            />
            {errors.company && (
              <p className="text-sm text-destructive">
                {errors.company.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('address')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="addressLine1">{t('addressLine1')}</Label>
            <Input
              id="addressLine1"
              placeholder={t('streetAddress')}
              aria-invalid={!!errors.addressLine1}
              {...register('addressLine1')}
            />
            {errors.addressLine1 && (
              <p className="text-sm text-destructive">
                {errors.addressLine1.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine2">{t('addressLine2')}</Label>
            <Input
              id="addressLine2"
              placeholder={t('addressLine2Placeholder')}
              aria-invalid={!!errors.addressLine2}
              {...register('addressLine2')}
            />
            {errors.addressLine2 && (
              <p className="text-sm text-destructive">
                {errors.addressLine2.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">{t('city')}</Label>
              <Input
                id="city"
                placeholder={t('city')}
                aria-invalid={!!errors.city}
                {...register('city')}
              />
              {errors.city && (
                <p className="text-sm text-destructive">
                  {errors.city.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">{t('stateRegion')}</Label>
              <Input
                id="state"
                placeholder={t('state')}
                aria-invalid={!!errors.state}
                {...register('state')}
              />
              {errors.state && (
                <p className="text-sm text-destructive">
                  {errors.state.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="postalCode">{t('postalCode')}</Label>
              <Input
                id="postalCode"
                placeholder="00000"
                aria-invalid={!!errors.postalCode}
                {...register('postalCode')}
              />
              {errors.postalCode && (
                <p className="text-sm text-destructive">
                  {errors.postalCode.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">{t('country')}</Label>
              <Input
                id="country"
                placeholder={t('country')}
                aria-invalid={!!errors.country}
                {...register('country')}
              />
              {errors.country && (
                <p className="text-sm text-destructive">
                  {errors.country.message}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('eInvoicingJoFotara')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="taxId">{t('taxIdTin')}</Label>
              <Input
                id="taxId"
                placeholder="e.g. 10662162"
                {...register('taxId')}
              />
              <p className="text-xs text-muted-foreground">
                {t('taxIdHint')}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t('cityCode')}</Label>
              <Select
                value={watch('cityCode') || ''}
                onValueChange={(val) =>
                  setValue('cityCode', val, { shouldDirty: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('selectGovernorate')} />
                </SelectTrigger>
                <SelectContent>
                  {JORDAN_CITY_CODES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tc('notes')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={4}
            placeholder={t('notesPlaceholder')}
            {...register('notes')}
          />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {tc('cancel')}
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? tc('saving') : t('saveClient')}
        </Button>
      </div>
    </form>
  );
}
