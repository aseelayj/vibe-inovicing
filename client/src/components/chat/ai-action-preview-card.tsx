import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChatToolCall } from '@vibe/shared';

interface AiActionPreviewCardProps {
  toolCall: ChatToolCall;
  onConfirm: () => void;
  onReject: () => void;
  isExecuting?: boolean;
}

const ACTION_COLORS: Record<string, string> = {
  create: 'border-l-blue-500',
  update: 'border-l-yellow-500',
  delete: 'border-l-red-500',
  send: 'border-l-green-500',
  convert: 'border-l-purple-500',
  toggle: 'border-l-orange-500',
  duplicate: 'border-l-blue-500',
};

function getActionColor(toolName: string): string {
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (toolName.includes(key)) return color;
  }
  return 'border-l-gray-500';
}

function formatToolArgs(args: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    if (key === 'lineItems' && Array.isArray(value)) {
      lines.push(`Line Items: ${value.length} item(s)`);
      for (const item of value.slice(0, 3)) {
        const li = item as { description?: string; quantity?: number; unitPrice?: number };
        lines.push(`  - ${li.description} (${li.quantity} x ${li.unitPrice})`);
      }
      if (value.length > 3) lines.push(`  ... and ${value.length - 3} more`);
    } else if (value !== undefined && value !== null && value !== '') {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
      lines.push(`${label}: ${value}`);
    }
  }
  return lines;
}

export function AiActionPreviewCard({
  toolCall,
  onConfirm,
  onReject,
  isExecuting,
}: AiActionPreviewCardProps) {
  const color = getActionColor(toolCall.name);
  const readableName = toolCall.name.replace(/_/g, ' ');
  const details = formatToolArgs(toolCall.args);

  return (
    <div className={cn('rounded-lg border border-l-4 bg-muted/50 p-3', color)}>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {readableName}
      </div>

      {details.length > 0 && (
        <div className="mb-3 space-y-0.5 text-xs text-foreground/80">
          {details.map((line, i) => (
            <p key={i} className="font-mono">{line}</p>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={onConfirm}
          disabled={isExecuting}
          className="h-7 text-xs"
        >
          <Check className="mr-1 h-3 w-3" />
          {isExecuting ? 'Executing...' : 'Confirm'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onReject}
          disabled={isExecuting}
          className="h-7 text-xs"
        >
          <X className="mr-1 h-3 w-3" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
