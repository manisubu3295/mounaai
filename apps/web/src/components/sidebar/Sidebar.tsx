import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, MessageSquare, Settings, Database, ScrollText,
  ChevronRight, Archive, Trash2, Pencil, Zap, PanelLeft, LayoutDashboard, Lightbulb, ClipboardList, Workflow, Bell, GitBranch, Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn, groupChatsByDate } from '@/lib/utils';
import { listChats, createChat, updateChat, deleteChat } from '@/services/chat.service';
import { getUnreadCount } from '@/services/notification.service';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import type { Chat } from '@pocketcomputer/shared-types';

export function Sidebar() {
  const { id: activeChatId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { sidebarOpen, toggleSidebar, openUpgradeModal } = useUIStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

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
  const workspaceNav = [
    { icon: LayoutDashboard, label: 'Overview', to: '/dashboard' },
    { icon: Lightbulb, label: 'Insights', to: '/insights' },
    { icon: ClipboardList, label: 'Decisions', to: '/decisions' },
    { icon: MessageSquare, label: 'Chat', to: '/chat' },
    { icon: Bell, label: 'Notifications', to: '/notifications' },
  ];

  if (!sidebarOpen) {
    return (
      <div className="w-12 flex flex-col items-center py-3 border-r border-[hsl(var(--border))] bg-[hsl(var(--surface))]">
        <button onClick={toggleSidebar} className="p-2 rounded-lg hover:bg-[hsl(var(--surface-2))] text-[hsl(var(--text-secondary))]">
          <PanelLeft className="w-4 h-4" />
        </button>
        <button onClick={() => createMutation.mutate(undefined)} className="mt-2 p-2 rounded-lg hover:bg-[hsl(var(--surface-2))] text-[hsl(var(--text-secondary))]">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-64 flex flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[hsl(var(--accent)/0.15)] border border-[hsl(var(--accent)/0.3)] flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-[hsl(var(--accent-hover))]" />
          </div>
          <span className="text-sm font-semibold">PocketComputer</span>
        </div>
        <button onClick={toggleSidebar} className="p-1 rounded text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--text-secondary))]">
          <PanelLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-2 space-y-0.5 border-b border-[hsl(var(--border))]">
        {workspaceNav.map(({ icon: Icon, label, to }) => {
          const isActive = location.pathname === to || (to === '/chat' && location.pathname.startsWith('/chat'));
          return (
            <button
              key={to}
              onClick={() => navigate(to)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--text-primary))]'
                  : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-primary))]'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {to === '/notifications' && unreadCount > 0 && (
                <span className="ml-auto inline-flex items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* New Chat */}
      <div className="px-3 py-2">
        <Button
          variant="secondary"
          className="w-full justify-start gap-2"
          onClick={() => createMutation.mutate(undefined)}
          loading={createMutation.isPending}
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-3">
        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--text-disabled))]">
          Chats
        </p>
        {chats.length === 0 && (
          <div className="px-2 py-8 text-center">
            <MessageSquare className="w-8 h-8 text-[hsl(var(--text-disabled))] mx-auto mb-2" />
            <p className="text-xs text-[hsl(var(--text-disabled))]">No conversations yet</p>
          </div>
        )}

        {grouped.map(([label, items]) => (
          <div key={label}>
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--text-disabled))]">
              {label}
            </p>
            {(items as Chat[]).map((chat) => (
              <div key={chat.id} className="group relative">
                {editingId === chat.id ? (
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => { if (editTitle.trim()) renameMutation.mutate({ id: chat.id, title: editTitle.trim() }); else setEditingId(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && editTitle.trim()) renameMutation.mutate({ id: chat.id, title: editTitle.trim() }); if (e.key === 'Escape') setEditingId(null); }}
                    className="w-full px-3 py-1.5 text-sm bg-[hsl(var(--surface-2))] border border-[hsl(var(--accent))] rounded-lg outline-none text-[hsl(var(--text-primary))]"
                  />
                ) : (
                  <button
                    onClick={() => navigate(`/chat/${chat.id}`)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                      activeChatId === chat.id
                        ? 'bg-[hsl(var(--accent)/0.12)] border-l-2 border-[hsl(var(--accent))] text-[hsl(var(--text-primary))]'
                        : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-primary))]'
                    )}
                  >
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate flex-1">{chat.title}</span>

                    {/* Hover actions */}
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <span onClick={(e) => { e.stopPropagation(); setEditingId(chat.id); setEditTitle(chat.title); }} className="p-1 hover:bg-[hsl(var(--surface))] rounded">
                        <Pencil className="w-3 h-3" />
                      </span>
                      <span onClick={(e) => { e.stopPropagation(); archiveMutation.mutate({ id: chat.id, status: 'ARCHIVED' }); }} className="p-1 hover:bg-[hsl(var(--surface))] rounded">
                        <Archive className="w-3 h-3" />
                      </span>
                      <span onClick={(e) => { e.stopPropagation(); if (confirm('Delete this chat?')) deleteMutation.mutate(chat.id); }} className="p-1 hover:bg-[hsl(var(--surface))] rounded text-[hsl(var(--error))]">
                        <Trash2 className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <Separator />

      {/* Bottom nav */}
      <div className="p-2 space-y-0.5">
        {[
          { icon: Settings,    label: 'Configuration', to: '/settings/llm' },
          { icon: Target,     label: 'KPIs',           to: '/settings/kpis' },
          { icon: GitBranch,  label: 'Business Rules', to: '/settings/rules' },
          { icon: Workflow,   label: 'Automation',     to: '/settings/automation' },
          { icon: Database,   label: 'Connectors',     to: '/settings/connectors' },
          { icon: ScrollText, label: 'Audit Logs',     to: '/settings/audit' },
        ].map(({ icon: Icon, label, to }) => {
          const isActive = location.pathname.startsWith(to);
          return (
            <button
              key={to}
              onClick={() => navigate(to)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--text-primary))]'
                  : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-primary))]'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              <ChevronRight className="w-3 h-3 ml-auto opacity-30" />
            </button>
          );
        })}

        <Separator className="my-1" />

        {/* Plan badge + upgrade */}
        <button
          onClick={() => user?.plan === 'FREE' ? openUpgradeModal() : undefined}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[hsl(var(--surface-2))] transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[hsl(var(--surface-2))] border border-[hsl(var(--border))] flex items-center justify-center text-[10px] font-semibold text-[hsl(var(--text-primary))]">
              {user?.full_name?.[0]?.toUpperCase() ?? user?.email[0]?.toUpperCase()}
            </div>
            <span className="text-xs text-[hsl(var(--text-secondary))] truncate max-w-[100px]">{user?.email}</span>
          </div>
          <Badge variant={user?.plan === 'FREE' ? 'free' : 'pro'}>{user?.plan}</Badge>
        </button>
      </div>
    </aside>
  );
}
