import { Link } from 'react-router';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-full bg-gray-100 p-4">
        <FileQuestion className="h-10 w-10 text-gray-400" />
      </div>
      <h1 className="mb-2 text-3xl font-bold text-gray-900">404</h1>
      <p className="mb-6 text-gray-500">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/">
        <Button>Back to Dashboard</Button>
      </Link>
    </div>
  );
}
