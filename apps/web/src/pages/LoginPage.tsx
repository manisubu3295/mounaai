import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth.store';
import { login } from '@/services/auth.service';

interface LoginForm {
  email: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    try {
      setError(null);
      const result = await login(data.email, data.password);
      setAuth(result.user, result.access_token);
      navigate('/chat');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? 'Login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-80 xl:w-96 bg-[hsl(var(--surface))] border-r border-[hsl(var(--border))] p-10 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <img
            src="/favicon.svg"
            alt="Mouna AI logo"
            className="w-7 h-7 object-contain shrink-0"
          />
          <span className="text-[14px] font-semibold tracking-tight">Mouna AI</span>
        </div>

        <div>
          <p className="text-[22px] font-semibold text-[hsl(var(--text-primary))] leading-snug tracking-tight">
            Your enterprise AI,<br />always in your pocket.
          </p>
          <p className="text-[13px] text-[hsl(var(--text-secondary))] mt-3 leading-relaxed">
            Real-time insights, automated decisions, and AI-driven analysis — built for operational teams.
          </p>
        </div>

        <p className="text-[11px] text-[hsl(var(--text-disabled))]">
          &copy; {new Date().getFullYear()} Aadhirai Innovations
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[360px] animate-fade-in">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden justify-center">
            <img
              src="/favicon.svg"
              alt="Mouna AI logo"
              className="w-7 h-7 object-contain shrink-0"
            />
            <span className="text-[14px] font-semibold tracking-tight">Mouna AI</span>
          </div>

          <h2 className="text-[20px] font-semibold text-[hsl(var(--text-primary))] tracking-tight mb-1">
            Sign in to your workspace
          </h2>
          <p className="text-[13px] text-[hsl(var(--text-secondary))] mb-7">
            Enter your credentials to continue.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                {...register('email', { required: 'Email is required' })}
              />
              {errors.email && (
                <p className="text-[11.5px] text-[hsl(var(--error))]">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pr-10"
                  autoComplete="current-password"
                  {...register('password', { required: 'Password is required' })}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--text-secondary))] transition-colors"
                >
                  {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11.5px] text-[hsl(var(--error))]">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-[hsl(var(--error)/0.08)] border border-[hsl(var(--error)/0.25)] px-3 py-2.5 text-[12px] text-[hsl(var(--error))]">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Sign in
            </Button>
          </form>

          <div className="mt-5 pt-5 border-t border-[hsl(var(--border))]">
            <p className="text-center text-[12px] text-[hsl(var(--text-secondary))]">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-[hsl(var(--accent-hover))] hover:underline font-medium">
                Request access
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
