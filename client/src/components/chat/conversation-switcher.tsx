import { MessageSquarePlus, Trash2, ChevronDown, Pencil } from 'lucide-react';
import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import type { ChatConversation } from '@vibe/shared';

interface ConversationSwitcherProps {
  conversations: ChatConversation[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
  onRename?: (id: number, title: string) => void;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ConversationSwitcher({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
}: ConversationSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [focusIndex, setFocusIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const active = conversations.find((c) => c.id === activeId);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDeleteId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset focus and confirm state when dropdown closes
  useEffect(() => {
    if (!open) {
      setFocusIndex(-1);
      setConfirmDeleteId(null);
      setEditingId(null);
    }
  }, [open]);

  // Focus the edit input when editing starts
  useEffect(() => {
    if (editingId !== null) {
      setTimeout(() => editInputRef.current?.focus(), 50);
    }
  }, [editingId]);

  const startRename = useCallback((conv: ChatConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
    setConfirmDeleteId(null);
  }, []);

  const commitRename = useCallback(() => {
    if (editingId && editTitle.trim() && onRename) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
  }, [editingId, editTitle, onRename]);

  const handleDeleteClick = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDeleteId === id) {
      onDelete(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  }, [confirmDeleteId, onDelete]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
        setFocusIndex(0);
      }
      return;
    }

    const totalItems = conversations.length + 1; // +1 for "New Chat"
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusIndex((prev) => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusIndex((prev) => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusIndex === 0) {
          onNew();
          setOpen(false);
        } else if (focusIndex > 0) {
          const conv = conversations[focusIndex - 1];
          if (conv) {
            onSelect(conv.id);
            setOpen(false);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  }, [open, focusIndex, conversations, onNew, onSelect]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        onKeyDown={handleKeyDown}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm
          font-medium hover:bg-muted transition-colors min-w-0 max-w-[200px]"
      >
        <span className="truncate">
          {active?.title || 'New Chat'}
        </span>
        <ChevronDown className={cn(
          'h-3.5 w-3.5 shrink-0 transition-transform',
          open && 'rotate-180',
        )} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Conversations"
          onKeyDown={handleKeyDown}
          className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border
            bg-popover shadow-lg"
        >
          <div className="max-h-72 overflow-y-auto p-1">
            <button
              role="option"
              aria-selected={focusIndex === 0}
              onClick={() => { onNew(); setOpen(false); }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                focusIndex === 0 ? 'bg-muted' : 'hover:bg-muted',
              )}
            >
              <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
              <span>New Chat</span>
            </button>

            {conversations.length > 0 && (
              <div className="my-1 border-t" />
            )}

            {conversations.map((conv, idx) => (
              <div
                key={conv.id}
                role="option"
                aria-selected={focusIndex === idx + 1}
                className={cn(
                  'group flex items-center justify-between rounded-md px-2 py-1.5 transition-colors',
                  conv.id === activeId
                    ? 'bg-muted'
                    : focusIndex === idx + 1 ? 'bg-muted/70' : 'hover:bg-muted/50',
                )}
              >
                {editingId === conv.id ? (
                  <input
                    ref={editInputRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setEditingId(null);
                      e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 rounded border bg-background px-1.5 py-0.5 text-sm
                      outline-none focus:ring-1 focus:ring-ring min-w-0"
                    maxLength={60}
                  />
                ) : (
                  <button
                    className="flex flex-1 flex-col items-start text-left min-w-0"
                    onClick={() => { onSelect(conv.id); setOpen(false); }}
                    onDoubleClick={(e) => onRename && startRename(conv, e)}
                  >
                    <span className="truncate text-sm w-full">{conv.title}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelativeDate(conv.updatedAt)}
                    </span>
                  </button>
                )}
                <div className="ml-1 flex items-center gap-0.5 shrink-0">
                {onRename && editingId !== conv.id && (
                  <button
                    onClick={(e) => startRename(conv, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Rename "${conv.title}"`}
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
                <button
                  onClick={(e) => handleDeleteClick(conv.id, e)}
                  className={cn(
                    'shrink-0 transition-opacity',
                    confirmDeleteId === conv.id
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100',
                  )}
                  aria-label={
                    confirmDeleteId === conv.id
                      ? `Confirm delete "${conv.title}"`
                      : `Delete "${conv.title}"`
                  }
                >
                  <Trash2 className={cn(
                    'h-3.5 w-3.5',
                    confirmDeleteId === conv.id
                      ? 'text-destructive'
                      : 'text-muted-foreground hover:text-destructive',
                  )} />
                </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
