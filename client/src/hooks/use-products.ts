import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Product } from '@vibe/shared';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

export function useProducts(filters?: { search?: string; category?: string; type?: string; active?: string }) {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.type) params.set('type', filters.type);
  if (filters?.active) params.set('active', filters.active);
  const qs = params.toString();
  const path = qs ? `/products?${qs}` : '/products';

  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => api.get<Product[]>(path),
  });
}

export function useProductCategories() {
  return useQuery({
    queryKey: ['products', 'categories'],
    queryFn: () => api.get<string[]>('/products/categories'),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<Product>('/products', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(i18n.t('createdSuccess', { entity: i18n.t('product') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('createFailed', { entity: i18n.t('product') }));
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put<Product>(`/products/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(i18n.t('updatedSuccess', { entity: i18n.t('product') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('updateFailed', { entity: i18n.t('product') }));
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(i18n.t('deletedSuccess', { entity: i18n.t('product') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('deleteFailed', { entity: i18n.t('product') }));
    },
  });
}
