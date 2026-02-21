import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useGenerateInvoice } from '@/hooks/use-ai';
import type { AiGenerateInvoiceResponse } from '@vibe/shared';

export interface AiGenerateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onResult: (result: AiGenerateInvoiceResponse) => void;
}

export function AiGenerateDialog({
  isOpen,
  onClose,
  onResult,
}: AiGenerateDialogProps) {
  const [prompt, setPrompt] = useState('');
  const generateInvoice = useGenerateInvoice();

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    try {
      const result = await generateInvoice.mutateAsync(prompt);
      onResult(result);
      setPrompt('');
    } catch {
      // error handled by mutation
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Invoice Generator">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-primary-50 p-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary-500" />
          <p className="text-sm text-primary-700">
            Describe the invoice you want to create in natural language.
            Include details like the client name, services provided,
            amounts, and due date.
          </p>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Create an invoice for Acme Corp for 10 hours of web development at $150/hr, due in 30 days"
          rows={5}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          maxLength={2000}
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {prompt.length}/2000 characters
          </span>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={generateInvoice.isPending}
              disabled={!prompt.trim()}
            >
              <Sparkles className="h-4 w-4" />
              Generate
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
