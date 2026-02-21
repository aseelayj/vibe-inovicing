import { Badge } from '@/components/ui/badge';
import type { InvoiceStatus } from '@vibe/shared';

export interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
  className?: string;
}

export function InvoiceStatusBadge({ status, className }: InvoiceStatusBadgeProps) {
  return <Badge status={status} className={className} />;
}
