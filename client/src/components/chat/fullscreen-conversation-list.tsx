import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MessageSquarePlus, Trash2, Pencil, Search, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { ChatConversation } from '@vibe/shared';

interface FullscreenConversationListProps {
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

export function FullscreenConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
}: FullscreenConversationListProps) {
  const { t } = useTranslation('chat');
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  useEffect(() => {
    if (editingId !== null) {
      setTimeout(() => editInputRef.current?.focus(), 50);
    }
  }, [editingId]);

  // Reset confirm-delete when clicking elsewhere
  useEffect(() => {
    if (confirmDeleteId === null) return;
    const timer = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(timer);
  }, [confirmDeleteId]);

  const startRename = useCallback((conv: ChatConversation, e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  // Collapse toggle button for mobile
  const toggleButton = (
    <button
      onClick={() => setCollapsed((prev) => !prev)}
      className="flex h-8 w-8 items-center justify-center rounded-lg
        text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={t('toggleSidebar')}
    >
      {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </button>
  );

  // Collapsed state — just show the toggle button
  if (collapsed) {
    return (
      <div className="flex w-12 flex-col items-center border-e bg-muted/30 pt-3">
        {toggleButton}
        <button
          onClick={onNew}
          className="mt-2 flex h-8 w-8 items-center justify-center rounded-lg
            text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t('newChat')}
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="flex w-64 flex-col border-e bg-muted/30">
      {/* Header */}
      <div className="flex h-14 items-center justify-between px-3">
        <button
          onClick={onNew}
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm
            font-medium transition-colors hover:bg-muted"
        >
          <MessageSquarePlus className="h-4 w-4 text-muted-foreground/60" />
          <span>{t('newChat')}</span>
        </button>
        {toggleButton}
      </div>

      {/* Search */}
      {conversations.length > 3 && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 h-3 w-3 -translate-y-1/2
              text-muted-foreground/40" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search')}
              className="w-full rounded-lg border bg-background py-1.5 ps-8 pe-2 text-xs
                outline-none placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filteredConversations.map((conv) => (
          <div
            key={conv.id}
            className={cn(
              'group flex items-center justify-between rounded-lg px-2.5 py-2',
              'transition-colors cursor-pointer',
              conv.id === activeId
                ? 'bg-muted'
                : 'hover:bg-muted/50',
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
                className="flex-1 rounded-md border bg-background px-2 py-0.5 text-sm
                  outline-none focus:ring-1 focus:ring-ring min-w-0"
                maxLength={60}
              />
            ) : (
              <button
                className="flex flex-1 flex-col items-start text-start min-w-0"
                onClick={() => onSelect(conv.id)}
                onDoubleClick={(e) => onRename && startRename(conv, e)}
              >
                <span className="w-full truncate text-sm">{conv.title}</span>
                <span className="text-[10px] text-muted-foreground/50">
                  {formatRelativeDate(conv.updatedAt)}
                </span>
              </button>
            )}
            <div className="ms-1 flex items-center gap-0.5 shrink-0">
              {onRename && editingId !== conv.id && (
                <button
                  onClick={(e) => startRename(conv, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={t('rename')}
                >
                  <Pencil className="h-3 w-3 text-muted-foreground/50 hover:text-foreground" />
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
                aria-label={t('deleteConversation')}
              >
                <Trash2 className={cn(
                  'h-3.5 w-3.5',
                  confirmDeleteId === conv.id
                    ? 'text-destructive'
                    : 'text-muted-foreground/50 hover:text-destructive',
                )} />
              </button>
            </div>
          </div>
        ))}

        {searchQuery && filteredConversations.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground/50">
            {t('noMatches', { query: searchQuery })}
          </p>
        )}
      </div>
    </aside>
  );
}
