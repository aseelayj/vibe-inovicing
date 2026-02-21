import { Link } from 'react-router';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardContent className="flex flex-col items-center py-10">
          <div className="mb-4 rounded-full bg-muted p-4">
            <FileQuestion className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="mb-2 text-3xl font-bold">404</h1>
          <p className="mb-6 text-muted-foreground">
            The page you are looking for does not exist or has been moved.
          </p>
          <Link to="/">
            <Button>Back to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
