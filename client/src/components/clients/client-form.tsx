import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClientSchema } from '@vibe/shared';
import type { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
  const {
    register,
    handleSubmit,
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
      notes: defaultValues?.notes ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          Contact Information
        </h2>
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="Client name"
            error={errors.name?.message}
            {...register('name')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="email@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Phone"
              type="tel"
              placeholder="+1 (555) 000-0000"
              error={errors.phone?.message}
              {...register('phone')}
            />
          </div>
          <Input
            label="Company"
            placeholder="Company name"
            error={errors.company?.message}
            {...register('company')}
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          Address
        </h2>
        <div className="space-y-4">
          <Input
            label="Address Line 1"
            placeholder="Street address"
            error={errors.addressLine1?.message}
            {...register('addressLine1')}
          />
          <Input
            label="Address Line 2"
            placeholder="Apt, suite, unit, etc."
            error={errors.addressLine2?.message}
            {...register('addressLine2')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="City"
              placeholder="City"
              error={errors.city?.message}
              {...register('city')}
            />
            <Input
              label="State / Region"
              placeholder="State"
              error={errors.state?.message}
              {...register('state')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Postal Code"
              placeholder="00000"
              error={errors.postalCode?.message}
              {...register('postalCode')}
            />
            <Input
              label="Country"
              placeholder="Country"
              error={errors.country?.message}
              {...register('country')}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          Notes
        </h2>
        <textarea
          rows={4}
          placeholder="Internal notes about this client..."
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          {...register('notes')}
        />
      </div>

      <div className="flex gap-3">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={isLoading}>
          Save Client
        </Button>
      </div>
    </form>
  );
}
