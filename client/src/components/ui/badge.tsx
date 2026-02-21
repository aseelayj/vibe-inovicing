import { cn } from '@/lib/cn';
import { STATUS_COLORS } from '@/lib/constants';

export interface BadgeProps {
  status: string;
  className?: string;
}

export function Badge({ status, className }: BadgeProps) {
  const colorClasses = STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
  const label = status.replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5',
        'text-xs font-medium capitalize',
        colorClasses,
        className,
      )}
    >
      {label}
    </span>
  );
}
