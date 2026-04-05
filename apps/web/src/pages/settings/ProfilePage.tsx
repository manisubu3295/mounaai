import { useAuthStore } from '@/stores/auth.store';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Shield, CreditCard } from 'lucide-react';

export function ProfilePage() {
  const { user } = useAuthStore();

  const rows = [
    {
      icon: User,
      label: 'Full name',
      value: user?.full_name ?? '—',
    },
    {
      icon: Mail,
      label: 'Email',
      value: user?.email ?? '—',
    },
    {
      icon: Shield,
      label: 'Role',
      value: user?.role === 'TENANT_ADMIN' ? 'Admin' : 'Member',
    },
    {
      icon: CreditCard,
      label: 'Plan',
      value: (
        <Badge variant={user?.plan === 'FREE' ? 'free' : 'pro'}>
          {user?.plan}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[hsl(var(--background))]">
      <div className="max-w-lg">
        <h1 className="text-[17px] font-semibold text-[hsl(var(--text-primary))] mb-1">Profile</h1>
        <p className="text-[13px] text-[hsl(var(--text-secondary))] mb-6">Your account information.</p>

        {/* Avatar */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[hsl(var(--accent)/0.9)] to-[hsl(233,80%,72%)] flex items-center justify-center text-[20px] font-bold text-white flex-shrink-0">
            {(user?.full_name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
          </div>
          <div>
            <p className="text-[15px] font-semibold text-[hsl(var(--text-primary))]">
              {user?.full_name ?? user?.email?.split('@')[0]}
            </p>
            <p className="text-[12.5px] text-[hsl(var(--text-secondary))]">{user?.email}</p>
          </div>
        </div>

        {/* Info rows */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] overflow-hidden divide-y divide-[hsl(var(--border))]">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3.5">
              <Icon className="w-4 h-4 text-[hsl(var(--text-disabled))] flex-shrink-0" />
              <span className="w-24 text-[12.5px] text-[hsl(var(--text-secondary))] flex-shrink-0">{label}</span>
              <span className="text-[13px] text-[hsl(var(--text-primary))] font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
