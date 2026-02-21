import { useState, useCallback } from 'react';
import { Check, X, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ChatToolCall } from '@vibe/shared';

interface AiActionPreviewCardProps {
  toolCall: ChatToolCall;
  onConfirm: (overrideArgs?: Record<string, any>) => void;
  onReject: () => void;
  isExecuting?: boolean;
}

const ACTION_COLORS: Record<string, string> = {
  create: 'border-l-blue-500',
  update: 'border-l-amber-500',
  delete: 'border-l-red-500',
  send: 'border-l-green-500',
  convert: 'border-l-violet-500',
  toggle: 'border-l-orange-500',
  duplicate: 'border-l-blue-500',
  submit: 'border-l-green-500',
};

const EDITABLE_FIELDS: Record<string, Set<string>> = {
  invoice: new Set(['issueDate', 'dueDate', 'notes', 'currency', 'taxRate']),
  quote: new Set(['issueDate', 'expiryDate', 'notes', 'currency', 'taxRate']),
  client: new Set(['name', 'email', 'company', 'phone', 'taxId', 'cityCode']),
  payment: new Set(['amount', 'paymentDate', 'method', 'notes']),
  transaction: new Set(['amount', 'date', 'description', 'category', 'notes']),
  recurring: new Set(['frequency', 'startDate', 'endDate', 'notes']),
  bank_account: new Set(['name', 'bankName', 'currentBalance']),
  settings: new Set([
    'businessName', 'businessEmail', 'defaultCurrency',
    'defaultTaxRate', 'defaultPaymentTerms',
  ]),
};

function getEditableFields(toolName: string): Set<string> {
  for (const [key, fields] of Object.entries(EDITABLE_FIELDS)) {
    if (toolName.includes(key)) return fields;
  }
  return new Set();
}

function getActionColor(toolName: string): string {
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (toolName.includes(key)) return color;
  }
  return 'border-l-border';
}

function formatLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

function ActionArgsDisplay({
  toolName,
  args,
  isEditing,
  editedArgs,
  onFieldChange,
}: {
  toolName: string;
  args: Record<string, unknown>;
  isEditing?: boolean;
  editedArgs?: Record<string, string>;
  onFieldChange?: (key: string, value: string) => void;
}) {
  if (!args || Object.keys(args).length === 0) return null;
  const editableFields = getEditableFields(toolName);

  if (toolName.includes('invoice') || toolName.includes('quote') || toolName.includes('recurring')) {
    const lineItems = (args.lineItems as any[]) || [];
    return (
      <div className="space-y-2.5 mb-3">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {Object.entries(args).map(([key, value]) => {
            if (key === 'lineItems' || value == null || value === '') return null;
            const label = formatLabel(key);
            const canEdit = isEditing && editableFields.has(key);
            return (
              <div key={key} className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground/70">{label}</span>
                {canEdit ? (
                  <Input
                    value={editedArgs?.[key] ?? String(value)}
                    onChange={(e) => onFieldChange?.(key, e.target.value)}
                    className="h-7 text-xs"
                  />
                ) : (
                  <span className="truncate font-medium text-foreground">{String(value)}</span>
                )}
              </div>
            );
          })}
        </div>
        {lineItems.length > 0 && (
          <div className="rounded-lg bg-background/60 p-2.5">
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              {t('lineItems')}
            </div>
            <div className="space-y-1">
              {lineItems.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="truncate pr-2 text-foreground">{item.description}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {item.quantity} &times; {item.unitPrice}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs mb-3">
      {Object.entries(args).map(([key, value]) => {
        if (value == null || value === '') return null;
        const label = formatLabel(key);
        const canEdit = isEditing && editableFields.has(key);
        return (
          <div key={key} className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground/70">{label}</span>
            {canEdit ? (
              <Input
                value={editedArgs?.[key] ?? String(value)}
                onChange={(e) => onFieldChange?.(key, e.target.value)}
                className="h-7 text-xs"
              />
            ) : (
              <span className="truncate font-medium text-foreground">{String(value)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AiActionPreviewCard({
  toolCall,
  onConfirm,
  onReject,
  isExecuting,
}: AiActionPreviewCardProps) {
  const { t } = useTranslation('chat');
  const color = getActionColor(toolCall.name);
  const readableName = toolCall.name.replace(/_/g, ' ');

  const isEmailTool = toolCall.name === 'send_invoice_email'
    || toolCall.name === 'send_invoice_reminder'
    || toolCall.name === 'send_quote_email';
  const hasEditableFields = !isEmailTool && getEditableFields(toolCall.name).size > 0;

  const [isEditing, setIsEditing] = useState(false);
  const [editedArgs, setEditedArgs] = useState<Record<string, string>>({});
  const [editedSubject, setEditedSubject] = useState(String(toolCall.args.subject || ''));
  const [editedBody, setEditedBody] = useState(String(toolCall.args.body || ''));

  const handleFieldChange = useCallback((key: string, value: string) => {
    setEditedArgs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleConfirm = () => {
    if (isEmailTool) {
      onConfirm({ subject: editedSubject, body: editedBody });
    } else if (isEditing && Object.keys(editedArgs).length > 0) {
      onConfirm(editedArgs);
    } else {
      onConfirm();
    }
  };

  return (
    <div className={cn('rounded-xl border border-l-[3px] bg-muted/20 p-3.5', color)}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {readableName}
        </span>
        <div className="flex items-center gap-1.5">
          {hasEditableFields && !isExecuting && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={cn(
                'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                isEditing
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground/60 hover:text-foreground',
              )}
            >
              <Pencil className="h-2.5 w-2.5" />
              {isEditing ? t('editing') : t('edit')}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isEmailTool ? (
        <div className="mb-3 space-y-2">
          <ActionArgsDisplay
            toolName={toolCall.name}
            args={{ ...toolCall.args, subject: null, body: null }}
          />
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground/70">{t('subject')}</span>
            <Input
              value={editedSubject}
              onChange={(e) => setEditedSubject(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground/70">{t('message')}</span>
            <Textarea
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              className="min-h-[80px] text-xs resize-y"
            />
          </div>
        </div>
      ) : (
        <ActionArgsDisplay
          toolName={toolCall.name}
          args={toolCall.args}
          isEditing={isEditing}
          editedArgs={editedArgs}
          onFieldChange={handleFieldChange}
        />
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={isExecuting}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all',
            'bg-primary text-primary-foreground hover:opacity-90',
            'disabled:opacity-50 disabled:pointer-events-none',
          )}
        >
          <Check className="h-3.5 w-3.5" />
          {isExecuting ? t('executing') : t('confirm')}
        </button>
        <button
          onClick={onReject}
          disabled={isExecuting}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all',
            'border text-muted-foreground hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30',
            'disabled:opacity-50 disabled:pointer-events-none',
          )}
        >
          <X className="h-3.5 w-3.5" />
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
