import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, MessageSquare, Settings, Database, ScrollText, Mail,
  Archive, Trash2, Pencil, PanelLeft, LayoutDashboard,
  Lightbulb, ClipboardList, Bell, GitBranch, Target,
  ChevronDown, FlaskConical, Sun, Moon, CalendarClock,
  User, LogOut,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, groupChatsByDate } from '@/lib/utils';
import { listChats, createChat, updateChat, deleteChat } from '@/services/chat.service';
import { logout } from '@/services/auth.service';
import { getUnreadCount } from '@/services/notification.service';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { useThemeStore } from '@/stores/theme.store';
import type { Chat } from '@pocketcomputer/shared-types';

const WORKSPACE_NAV = [
  { icon: LayoutDashboard, label: 'Home',            to: '/dashboard' },
  { icon: Lightbulb,       label: 'What AI Found',   to: '/insights' },
  { icon: ClipboardList,   label: 'Actions to Take', to: '/decisions' },
  { icon: FlaskConical,    label: 'Simulate',        to: '/simulate' },
  { icon: MessageSquare,   label: 'Ask AI',          to: '/chat' },
  { icon: Bell,            label: 'Alerts',          to: '/notifications' },
];

const ADMIN_NAV = [
  { icon: Settings,   label: 'Configuration',  to: '/settings/llm' },
  { icon: Mail,       label: 'Communication',  to: '/settings/communication' },
  { icon: Target,     label: 'KPIs',           to: '/settings/kpis' },
  { icon: GitBranch,  label: 'Business Rules', to: '/settings/rules' },
  { icon: CalendarClock, label: 'Daily Briefing', to: '/settings/daily-briefing' },
  { icon: Database,   label: 'Connectors',     to: '/settings/connectors' },
  { icon: ScrollText, label: 'Audit Logs',     to: '/settings/audit' },
];

// ── Reusable nav item ─────────────────────────────────────────────────────────

function NavItem({
  icon: Icon,
  label,
  isActive,
  onClick,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full flex items-center gap-3 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 relative',
        isActive
          ? 'bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent-hover))]'
          : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-primary))]'
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[hsl(var(--accent))] rounded-r-full" />
      )}
      <Icon className={cn(
        'w-[15px] h-[15px] flex-shrink-0 transition-colors',
        isActive
          ? 'text-[hsl(var(--accent-hover))]'
          : 'text-[hsl(var(--text-disabled))] group-hover:text-[hsl(var(--text-secondary))]'
      )} />
      <span className="flex-1 text-left leading-none">{label}</span>
      {badge}
    </button>
  );
}

// ── Collapsible section wrapper ───────────────────────────────────────────────

function Section({
  title,
  expanded,
  onToggle,
  isActive,
  action,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  isActive?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-[hsl(var(--border))] first:border-t-0">
      {/* Section header */}
      <div className="flex items-center px-2 py-1.5">
        <button
          onClick={onToggle}
          className={cn(
            'flex-1 flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-left',
            isActive
              ? 'text-[hsl(var(--text-secondary))]'
              : 'text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))]'
          )}
        >
          <span className="label-eyebrow flex-1">{title}</span>
          <ChevronDown
            className={cn(
              'w-3 h-3 transition-transform duration-200 flex-shrink-0',
              expanded && 'rotate-180'
            )}
          />
        </button>
        {action && <div className="ml-1">{action}</div>}
      </div>

      {/* Section content */}
      {expanded && (
        <div className="px-2 pb-2 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function Sidebar() {
  const { id: activeChatId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, clearAuth } = useAuthStore();
  const { sidebarOpen, toggleSidebar, openUpgradeModal } = useUIStore();
  const { theme, toggleTheme } = useThemeStore();

  const isWorkspaceActive = WORKSPACE_NAV.some(
    (item) => location.pathname === item.to || (item.to === '/chat' && location.pathname.startsWith('/chat'))
  );
  const isAdminActive = ADMIN_NAV.some((item) => location.pathname.startsWith(item.to));

  const [workspaceOpen, setWorkspaceOpen]   = useState(true);
  const [conversationsOpen, setConversationsOpen] = useState(true);
  const [adminOpen, setAdminOpen]           = useState(() => isAdminActive);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [userMenuOpen]);

  const handleLogout = async () => {
    try { await logout(); } catch { /* ignore – clear locally regardless */ }
    clearAuth();
    navigate('/login');
    setUserMenuOpen(false);
  };

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

  /* ── Collapsed rail ─────────────────────────────────────── */
  if (!sidebarOpen) {
    return (
      <div className="w-[52px] flex flex-col items-center py-2 gap-0.5 border-r border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex-shrink-0">
        <button
          onClick={toggleSidebar}
          title="Expand sidebar"
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[hsl(var(--surface-2))] text-[hsl(var(--text-secondary))] transition-colors"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => createMutation.mutate(undefined)}
          title="New Chat"
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[hsl(var(--surface-2))] text-[hsl(var(--text-secondary))] transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>

        <div className="w-6 h-px bg-[hsl(var(--border))] my-1" />

        {WORKSPACE_NAV.map(({ icon: Icon, label, to }) => {
          const isActive = location.pathname === to || (to === '/chat' && location.pathname.startsWith('/chat'));
          return (
            <button
              key={to}
              onClick={() => navigate(to)}
              title={label}
              className={cn(
                'relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors',
                isActive
                  ? 'bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent-hover))]'
                  : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-primary))]'
              )}
            >
              <Icon className="w-[15px] h-[15px]" />
              {to === '/notifications' && unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[hsl(var(--surface))]" />
              )}
            </button>
          );
        })}

        <div className="flex-1" />

        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[hsl(var(--surface-2))] text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--text-secondary))] transition-colors mb-1"
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[hsl(var(--accent)/0.8)] to-[hsl(233,80%,72%)] flex items-center justify-center text-[10px] font-bold text-white mb-2">
          {userInitial}
        </div>
      </div>
    );
  }

  /* ── Expanded sidebar ───────────────────────────────────── */
  return (
    <aside className="w-[240px] flex flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex-shrink-0 select-none overflow-hidden">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 h-[52px] border-b border-[hsl(var(--border))] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <img
            src="/favicon.svg"
            alt="Mouna AI logo"
            className="w-[30px] h-[30px] object-contain shrink-0"
          />
          <div>
            <p className="text-[13px] font-semibold text-[hsl(var(--text-primary))] leading-none tracking-tight">Mouna AI</p>
            <p className="text-[10px] text-[hsl(var(--text-disabled))] leading-none mt-0.5 tracking-wide">Decision Intelligence Platform</p>
          </div>
        </div>
        <button
          onClick={toggleSidebar}
          title="Collapse sidebar"
          className="w-7 h-7 flex items-center justify-center rounded-md text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] transition-colors"
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Three collapsible sections ───────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* ── 1. Workspace ──────────────────────────────────── */}
        <Section
          title="Workspace"
          expanded={workspaceOpen}
          onToggle={() => setWorkspaceOpen((v) => !v)}
          isActive={isWorkspaceActive}
        >
          {WORKSPACE_NAV.map(({ icon: Icon, label, to }) => {
            const isActive =
              location.pathname === to ||
              (to === '/chat' && location.pathname.startsWith('/chat'));
            return (
              <NavItem
                key={to}
                icon={Icon}
                label={label}
                isActive={isActive}
                onClick={() => navigate(to)}
                badge={
                  to === '/notifications' && unreadCount > 0 ? (
                    <span className="ml-auto min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  ) : undefined
                }
              />
            );
          })}
        </Section>

        {/* ── 2. Conversations ──────────────────────────────── */}
        <Section
          title="Conversations"
          expanded={conversationsOpen}
          onToggle={() => setConversationsOpen((v) => !v)}
          isActive={!!activeChatId}
          action={
            <button
              onClick={() => createMutation.mutate(undefined)}
              disabled={createMutation.isPending}
              title="New chat"
              className="w-6 h-6 flex items-center justify-center rounded-md text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--accent-hover))] hover:bg-[hsl(var(--accent)/0.1)] transition-colors"
            >
              {createMutation.isPending
                ? <span className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                : <Plus className="w-3.5 h-3.5" />
              }
            </button>
          }
        >
          {chats.length === 0 ? (
            <div className="mx-1 rounded-lg border border-dashed border-[hsl(var(--border))] px-3 py-4 text-center">
              <MessageSquare className="w-4 h-4 text-[hsl(var(--text-disabled))] mx-auto mb-1.5" />
              <p className="text-[11px] text-[hsl(var(--text-disabled))] leading-relaxed">
                No conversations yet
              </p>
            </div>
          ) : (
            grouped.map(([groupLabel, items]) => (
              <div key={groupLabel} className="mb-2">
                <p className="label-eyebrow px-3 mb-0.5">{groupLabel}</p>
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
                        className="w-full px-2.5 py-1.5 text-[12.5px] bg-[hsl(var(--surface-2))] border border-[hsl(var(--accent)/0.5)] rounded-md outline-none text-[hsl(var(--text-primary))]"
                      />
                    ) : (
                      <button
                        onClick={() => navigate(`/chat/${chat.id}`)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-[6px] rounded-lg text-left text-[12.5px] transition-all duration-100 relative',
                          activeChatId === chat.id
                            ? 'bg-[hsl(var(--accent)/0.10)] text-[hsl(var(--text-primary))] font-medium'
                            : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-primary))]'
                        )}
                      >
                        {activeChatId === chat.id && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[hsl(var(--accent))] rounded-r-full" />
                        )}
                        <MessageSquare className="w-3 h-3 flex-shrink-0 opacity-40" />
                        <span className="truncate flex-1">{chat.title}</span>
                        <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                          <span
                            onClick={(e) => { e.stopPropagation(); setEditingId(chat.id); setEditTitle(chat.title); }}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[hsl(var(--surface-3))] text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--text-secondary))] transition-colors"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                          </span>
                          <span
                            onClick={(e) => { e.stopPropagation(); archiveMutation.mutate({ id: chat.id, status: 'ARCHIVED' }); }}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[hsl(var(--surface-3))] text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--text-secondary))] transition-colors"
                          >
                            <Archive className="w-2.5 h-2.5" />
                          </span>
                          <span
                            onClick={(e) => { e.stopPropagation(); if (confirm('Delete this conversation?')) deleteMutation.mutate(chat.id); }}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[hsl(var(--error)/0.12)] text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--error))] transition-colors"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </Section>

        {/* ── 3. Administration (admin only) ────────────────── */}
        {user?.role === 'TENANT_ADMIN' && (
          <Section
            title="Administration"
            expanded={adminOpen}
            onToggle={() => setAdminOpen((v) => !v)}
            isActive={isAdminActive}
          >
            {ADMIN_NAV.map(({ icon: Icon, label, to }) => (
              <NavItem
                key={to}
                icon={Icon}
                label={label}
                isActive={location.pathname.startsWith(to)}
                onClick={() => navigate(to)}
              />
            ))}
          </Section>
        )}

      </div>

      {/* ── Footer ──────────────────────────────────────────── */}
      <div className="border-t border-[hsl(var(--border))] p-2 flex-shrink-0 relative" ref={userMenuRef}>

        {/* User dropdown menu */}
        {userMenuOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-lg shadow-lg overflow-hidden z-50">
            {/* User info header */}
            <div className="px-3 py-2.5 border-b border-[hsl(var(--border))]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[hsl(var(--accent)/0.9)] to-[hsl(233,80%,72%)] flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
                  {userInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[hsl(var(--text-primary))] truncate leading-tight">
                    {user?.full_name ?? user?.email?.split('@')[0]}
                  </p>
                  <p className="text-[10.5px] text-[hsl(var(--text-disabled))] truncate leading-tight">{user?.email}</p>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Badge
                  variant={user?.plan === 'FREE' ? 'free' : 'pro'}
                  className="cursor-default"
                  onClick={() => user?.plan === 'FREE' ? openUpgradeModal() : undefined}
                >
                  {user?.plan}
                </Badge>
                <span className="text-[10.5px] text-[hsl(var(--text-disabled))]">
                  {user?.role === 'TENANT_ADMIN' ? 'admin' : 'member'}
                </span>
              </div>
            </div>

            {/* Profile */}
            <button
              onClick={() => { navigate('/settings/profile'); setUserMenuOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-primary))] transition-colors"
            >
              <User className="w-3.5 h-3.5 flex-shrink-0" />
              Profile
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-[hsl(var(--error))] hover:bg-[hsl(var(--error)/0.08)] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
              Log out
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 px-1">

          {/* User info — click opens menu */}
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 flex-1 min-w-0 py-1 px-1.5 rounded-lg hover:bg-[hsl(var(--surface-2))] transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[hsl(var(--accent)/0.9)] to-[hsl(233,80%,72%)] flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[hsl(var(--text-primary))] truncate leading-tight">
                {user?.full_name ?? user?.email?.split('@')[0]}
              </p>
              <p className="text-[10.5px] text-[hsl(var(--text-disabled))] truncate leading-tight">
                {user?.email}
              </p>
            </div>
          </button>

          {/* Plan badge */}
          <Badge
            variant={user?.plan === 'FREE' ? 'free' : 'pro'}
            className="flex-shrink-0 cursor-pointer"
            onClick={() => user?.plan === 'FREE' ? openUpgradeModal() : undefined}
          >
            {user?.plan}
          </Badge>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] transition-colors flex-shrink-0"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

        </div>
      </div>
    </aside>
  );
}
