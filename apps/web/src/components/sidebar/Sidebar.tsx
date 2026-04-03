import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, MessageSquare, Settings, Database, ScrollText, Mail,
  Archive, Trash2, Pencil, Zap, PanelLeft, LayoutDashboard,
  Lightbulb, ClipboardList, Workflow, Bell, GitBranch, Target,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, groupChatsByDate } from '@/lib/utils';
import { listChats, createChat, updateChat, deleteChat } from '@/services/chat.service';
import { getUnreadCount } from '@/services/notification.service';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import type { Chat } from '@pocketcomputer/shared-types';

const WORKSPACE_NAV = [
  { icon: LayoutDashboard, label: 'Overview',      to: '/dashboard' },
  { icon: Lightbulb,       label: 'Insights',      to: '/insights' },
  { icon: ClipboardList,   label: 'Decisions',     to: '/decisions' },
  { icon: MessageSquare,   label: 'Chat',          to: '/chat' },
  { icon: Bell,            label: 'Notifications', to: '/notifications' },
];

const ADMIN_NAV = [
  { icon: Settings,    label: 'Configuration',  to: '/settings/llm' },
  { icon: Mail,        label: 'Communication',  to: '/settings/communication' },
  { icon: Target,      label: 'KPIs',           to: '/settings/kpis' },
  { icon: GitBranch,   label: 'Business Rules', to: '/settings/rules' },
  { icon: Workflow,    label: 'Automation',      to: '/settings/automation' },
  { icon: Database,    label: 'Connectors',      to: '/settings/connectors' },
  { icon: ScrollText,  label: 'Audit Logs',      to: '/settings/audit' },
];

export function Sidebar() {
  const { id: activeChatId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { sidebarOpen, toggleSidebar, openUpgradeModal } = useUIStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [adminExpanded, setAdminExpanded] = useState(() =>
    ADMIN_NAV.some((item) => location.pathname.startsWith(item.to))
  );

  const { data } = useQuery({
    queryKey: ['chats'],
    queryFn: () => listChats(1, 50),
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notification-unread-count'],
    queryFn: getUnreadCount,
    refetchInterval: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: createChat,
    onSuccess: (chat) => {
      qc.invalidateQueries({ queryKey: ['chats'] });
      navigate(`/chat/${chat.id}`);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'ARCHIVED' }) =>
      updateChat(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chats'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteChat,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chats'] });
      navigate('/chat');
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => updateChat(id, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chats'] });
      setEditingId(null);
    },
  });

  const chats = data?.items ?? [];
  const grouped = groupChatsByDate(chats);

  const userInitial = (user?.full_name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();
  const isAdminActive = ADMIN_NAV.some((item) => location.pathname.startsWith(item.to));

  /* ── Collapsed rail ─────────────────────────────────────── */
  if (!sidebarOpen) {
    return (
      <div className="w-[52px] flex flex-col items-center py-3 gap-1 border-r border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex-shrink-0">
        <button
          onClick={toggleSidebar}
          title="Expand sidebar"
          className="p-2.5 rounded-md hover:bg-[hsl(var(--surface-2))] text-[hsl(var(--text-secondary))] transition-colors"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => createMutation.mutate(undefined)}
          title="New Chat"
          className="p-2.5 rounded-md hover:bg-[hsl(var(--surface-2))] text-[hsl(var(--text-secondary))] transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
        <div className="w-5 h-px bg-[hsl(var(--border))] my-1" />
        {WORKSPACE_NAV.map(({ icon: Icon, label, to }) => {
          const isActive = location.pathname === to || (to === '/chat' && location.pathname.startsWith('/chat'));
          return (
            <button
              key={to}
              onClick={() => navigate(to)}
              title={label}
              className={cn(
                'relative p-2.5 rounded-md transition-colors',
                isActive
                  ? 'bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent-hover))]'
                  : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-primary))]'
              )}
            >
              <Icon className="w-4 h-4" />
              {to === '/notifications' && unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  /* ── Expanded sidebar ───────────────────────────────────── */
  return (
    <aside className="w-[232px] flex flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex-shrink-0 select-none">

      {/* ── Wordmark ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[hsl(var(--border))] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-[hsl(var(--accent)/0.14)] border border-[hsl(var(--accent)/0.28)] flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-[hsl(var(--accent-hover))]" />
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-[hsl(var(--text-primary))]">
            Mouna AI
          </span>
        </div>
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] transition-colors"
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Workspace navigation ──────────────────────────── */}
      <div className="px-2 pt-3 pb-1 flex-shrink-0">
        <p className="label-eyebrow px-2 mb-1.5">Workspace</p>
        <div className="space-y-0.5">
          {WORKSPACE_NAV.map(({ icon: Icon, label, to }) => {
            const isActive =
              location.pathname === to ||
              (to === '/chat' && location.pathname.startsWith('/chat'));
            return (
              <button
                key={to}
                onClick={() => navigate(to)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] transition-colors',
                  isActive
                    ? 'bg-[hsl(var(--accent)/0.11)] text-[hsl(var(--text-primary))] font-medium'
                    : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-primary))]'
                )}
              >
                <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-[hsl(var(--accent-hover))]')} />
                {label}
                {to === '/notifications' && unreadCount > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center rounded-full bg-red-500 min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── New chat ──────────────────────────────────────── */}
      <div className="px-2 pb-2 flex-shrink-0">
        <button
          onClick={() => createMutation.mutate(undefined)}
          disabled={createMutation.isPending}
          className="w-full flex items-center gap-2 px-2.5 py-[7px] rounded-md text-[13px] border border-dashed border-[hsl(var(--border-strong))] text-[hsl(var(--text-secondary))] hover:border-[hsl(var(--accent)/0.5)] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--accent)/0.05)] transition-colors"
        >
          {createMutation.isPending
            ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            : <Plus className="w-4 h-4" />
          }
          New Chat
        </button>
      </div>

      {/* ── Chat history ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 pb-1 min-h-0">
        {chats.length === 0 ? (
          <div className="px-2 py-6 text-center">
            <MessageSquare className="w-7 h-7 text-[hsl(var(--text-disabled))] mx-auto mb-2" />
            <p className="text-xs text-[hsl(var(--text-disabled))]">No conversations yet</p>
          </div>
        ) : (
          grouped.map(([label, items]) => (
            <div key={label} className="mb-2">
              <p className="label-eyebrow px-2 py-1.5">{label}</p>
              {(items as Chat[]).map((chat) => (
                <div key={chat.id} className="group relative">
                  {editingId === chat.id ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => {
                        if (editTitle.trim()) renameMutation.mutate({ id: chat.id, title: editTitle.trim() });
                        else setEditingId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editTitle.trim()) renameMutation.mutate({ id: chat.id, title: editTitle.trim() });
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full px-2.5 py-1.5 text-[13px] bg-[hsl(var(--surface-2))] border border-[hsl(var(--accent))] rounded-md outline-none text-[hsl(var(--text-primary))]"
                    />
                  ) : (
                    <button
                      onClick={() => navigate(`/chat/${chat.id}`)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2.5 py-[7px] rounded-md text-left text-[13px] transition-colors',
                        activeChatId === chat.id
                          ? 'bg-[hsl(var(--accent)/0.11)] text-[hsl(var(--text-primary))] font-medium border-l-2 border-[hsl(var(--accent))]'
                          : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-primary))]'
                      )}
                    >
                      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                      <span className="truncate flex-1">{chat.title}</span>
                      <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                        <span
                          onClick={(e) => { e.stopPropagation(); setEditingId(chat.id); setEditTitle(chat.title); }}
                          className="p-1 hover:bg-[hsl(var(--surface-3))] rounded text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--text-secondary))]"
                        >
                          <Pencil className="w-3 h-3" />
                        </span>
                        <span
                          onClick={(e) => { e.stopPropagation(); archiveMutation.mutate({ id: chat.id, status: 'ARCHIVED' }); }}
                          className="p-1 hover:bg-[hsl(var(--surface-3))] rounded text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--text-secondary))]"
                        >
                          <Archive className="w-3 h-3" />
                        </span>
                        <span
                          onClick={(e) => { e.stopPropagation(); if (confirm('Delete this conversation?')) deleteMutation.mutate(chat.id); }}
                          className="p-1 hover:bg-[hsl(var(--error)/0.12)] rounded text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--error))]"
                        >
                          <Trash2 className="w-3 h-3" />
                        </span>
                      </div>
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* ── Administration section ────────────────────────── */}
      <div className="border-t border-[hsl(var(--border))] px-2 pt-2 pb-1 flex-shrink-0">
        <button
          onClick={() => setAdminExpanded((v) => !v)}
          className={cn(
            'w-full flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors',
            isAdminActive
              ? 'text-[hsl(var(--text-secondary))]'
              : 'text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--text-secondary))]'
          )}
        >
          <span className="label-eyebrow flex-1 text-left">Administration</span>
          <ChevronDown className={cn('w-3 h-3 transition-transform duration-200', adminExpanded && 'rotate-180')} />
        </button>

        {adminExpanded && (
          <div className="mt-0.5 space-y-0.5">
            {ADMIN_NAV.map(({ icon: Icon, label, to }) => {
              const isActive = location.pathname.startsWith(to);
              return (
                <button
                  key={to}
                  onClick={() => navigate(to)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] transition-colors',
                    isActive
                      ? 'bg-[hsl(var(--accent)/0.11)] text-[hsl(var(--text-primary))] font-medium'
                      : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-primary))]'
                  )}
                >
                  <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-[hsl(var(--accent-hover))]')} />
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── User profile ──────────────────────────────────── */}
      <div className="border-t border-[hsl(var(--border))] p-2 flex-shrink-0">
        <button
          onClick={() => user?.plan === 'FREE' ? openUpgradeModal() : undefined}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-[hsl(var(--surface-2))] transition-colors text-left"
        >
          <div className="w-7 h-7 rounded-full bg-[hsl(var(--accent)/0.18)] border border-[hsl(var(--accent)/0.3)] flex items-center justify-center text-[11px] font-bold text-[hsl(var(--accent-hover))] flex-shrink-0">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-medium text-[hsl(var(--text-primary))] truncate leading-tight">
              {user?.full_name ?? user?.email?.split('@')[0]}
            </p>
            <p className="text-[11px] text-[hsl(var(--text-disabled))] truncate leading-tight">
              {user?.email}
            </p>
          </div>
          <Badge variant={user?.plan === 'FREE' ? 'free' : 'pro'} className="flex-shrink-0">
            {user?.plan}
          </Badge>
        </button>
      </div>
    </aside>
  );
}
