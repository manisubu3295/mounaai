import { MessageCircle, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/ui.store';
import { useMutation } from '@tanstack/react-query';
import { requestUpgrade } from '@/services/connector.service';

const FREE_FEATURES = ['1 connector', '1 user', 'Gemini AI', '7-day history'];
const PRO_FEATURES = ['Unlimited connectors', 'Up to 10 users', 'Any LLM provider', '90-day history', 'Advanced masking rules', 'Full audit logs', 'Priority support'];

export function UpgradeModal() {
  const { upgradeModalOpen, upgradeFeature, closeUpgradeModal } = useUIStore();

  const upgradeMutation = useMutation({
    mutationFn: () => requestUpgrade(upgradeFeature ?? undefined),
    onSuccess: (data: { whatsapp_url: string }) => {
      window.open(data.whatsapp_url, '_blank', 'noopener,noreferrer');
    },
  });

  if (!upgradeModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeUpgradeModal}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] shadow-2xl animate-fade-in">
        <button
          onClick={closeUpgradeModal}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-primary))] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[hsl(var(--accent)/0.15)] border border-[hsl(var(--accent)/0.3)] text-[11px] font-semibold text-[hsl(var(--accent-hover))] mb-3">
              PRO
            </div>
            <h2 className="text-xl font-semibold text-[hsl(var(--text-primary))] mb-1">
              Unlock Pro Capabilities
            </h2>
            <p className="text-sm text-[hsl(var(--text-secondary))]">
              {upgradeFeature
                ? `This feature requires Pro. Contact us to get started.`
                : 'Scale your AI assistant with unlimited connectors and advanced controls.'}
            </p>
          </div>

          {/* Plans */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* Free */}
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-4">
              <p className="text-xs font-semibold text-[hsl(var(--text-secondary))] mb-3">Free</p>
              <ul className="space-y-2">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-[hsl(var(--text-secondary))]">
                    <Check className="w-3 h-3 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro */}
            <div className="rounded-xl border border-[hsl(var(--accent)/0.4)] bg-[hsl(var(--accent)/0.06)] p-4">
              <p className="text-xs font-semibold text-[hsl(var(--accent-hover))] mb-3">Pro</p>
              <ul className="space-y-2">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-[hsl(var(--text-primary))]">
                    <Check className="w-3 h-3 flex-shrink-0 text-[hsl(var(--accent-hover))]" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* CTA */}
          <Button
            variant="whatsapp"
            className="w-full h-11 text-sm font-semibold gap-2"
            onClick={() => upgradeMutation.mutate()}
            loading={upgradeMutation.isPending}
          >
            <MessageCircle className="w-4 h-4" />
            Talk to Us on WhatsApp
          </Button>
          <p className="text-center text-[11px] text-[hsl(var(--text-disabled))] mt-2">
            Custom pricing for your team size
          </p>
        </div>
      </div>
    </div>
  );
}
