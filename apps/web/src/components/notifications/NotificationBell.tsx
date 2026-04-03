import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { getUnreadCount } from '@/services/notification.service';

export function NotificationBell() {
  const navigate = useNavigate();

  const { data: count = 0 } = useQuery({
    queryKey: ['notification-unread-count'],
    queryFn: getUnreadCount,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  return (
    <button
      onClick={() => navigate('/notifications')}
      className="relative p-2 rounded-lg hover:bg-[hsl(var(--surface-2))] text-[hsl(var(--text-secondary))] transition-colors"
      aria-label={count > 0 ? `${count} unread notifications` : 'Notifications'}
    >
      <Bell className="w-4 h-4" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
