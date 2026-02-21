import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function LoadingSpinner({ className, size = 'md' }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center py-12',
        className,
      )}
      role="status"
      aria-label="Loading"
    >
      <Loader2 className={cn('animate-spin text-primary-500', sizeMap[size])} />
    </div>
  );
}
