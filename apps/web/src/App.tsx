import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useThemeStore } from '@/stores/theme.store';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth.store';
import { getMe, refreshToken } from '@/services/auth.service';
import { setAccessToken } from '@/lib/api-client';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ChatPage } from '@/pages/ChatPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { InsightsPage } from '@/pages/insights/InsightsPage';
import { DecisionCenterPage } from '@/pages/decisions/DecisionCenterPage';
import { LLMConfigPage } from '@/pages/settings/LLMConfigPage';
import { ConnectorsPage } from '@/pages/settings/ConnectorsPage';
import { AuditPage } from '@/pages/settings/AuditPage';
import { RulesPage } from '@/pages/settings/RulesPage';
import { KPIsPage } from '@/pages/settings/KPIsPage';
import { CommunicationPage } from '@/pages/settings/CommunicationPage';
import { DailyBriefingPage } from '@/pages/settings/DailyBriefingPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { SimulatePage } from '@/pages/SimulatePage';
import { AnalysisRunDetailPage } from '@/pages/analysis/AnalysisRunDetailPage';
import { Layout } from '@/components/shared/Layout';

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col items-center justify-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-[hsl(var(--border-strong))] border-t-[hsl(var(--accent))]" />
        <p className="text-[12px] text-[hsl(var(--text-disabled))] tracking-wide">Loading workspace…</p>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function PublicOnly() {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col items-center justify-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-[hsl(var(--border-strong))] border-t-[hsl(var(--accent))]" />
        <p className="text-[12px] text-[hsl(var(--text-disabled))] tracking-wide">Loading workspace…</p>
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export default function App() {
  const { setAuth, clearAuth, setLoading } = useAuthStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    let isActive = true;

    async function bootstrap() {
      setLoading(true);

      try {
        const token = await refreshToken();
        setAccessToken(token);
        const user = await getMe();

        if (isActive) {
          setAuth(user, token);
        }
      } catch {
        if (isActive) {
          clearAuth();
        }
      }
    }

    bootstrap();

    return () => {
      isActive = false;
    };
  }, [setAuth, clearAuth, setLoading]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route element={<PublicOnly />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Protected routes */}
          <Route element={<AuthGate />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/decisions" element={<DecisionCenterPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/chat/:id" element={<ChatPage />} />
              <Route path="/settings/llm" element={<LLMConfigPage />} />
              <Route path="/settings/connectors" element={<ConnectorsPage />} />
              <Route path="/settings/rules" element={<RulesPage />} />
              <Route path="/settings/kpis" element={<KPIsPage />} />
              <Route path="/settings/communication" element={<CommunicationPage />} />
              <Route path="/settings/daily-briefing" element={<DailyBriefingPage />} />
              <Route path="/settings/audit" element={<AuditPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/simulate" element={<SimulatePage />} />
              <Route path="/analysis-runs/:id" element={<AnalysisRunDetailPage />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
