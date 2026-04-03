import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const secs = Math.floor(diff / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (secs < 60) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function groupChatsByDate(chats: Array<{ created_at: string; id: string }>) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const lastWeek = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, typeof chats> = {
    Today: [],
    Yesterday: [],
    'Last 7 Days': [],
    Older: [],
  };

  for (const chat of chats) {
    const d = new Date(chat.created_at);
    if (d >= today) groups['Today']!.push(chat);
    else if (d >= yesterday) groups['Yesterday']!.push(chat);
    else if (d >= lastWeek) groups['Last 7 Days']!.push(chat);
    else groups['Older']!.push(chat);
  }

  return Object.entries(groups).filter(([, items]) => items.length > 0);
}
