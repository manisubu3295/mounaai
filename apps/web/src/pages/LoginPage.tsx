import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Zap, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-xl bg-[hsl(var(--accent)/0.15)] border border-[hsl(var(--accent)/0.3)] flex items-center justify-center">
            <Zap className="w-4 h-4 text-[hsl(var(--accent-hover))]" />
          </div>
          <span className="text-lg font-semibold">PocketComputer</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Enter your credentials to access your workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  {...register('email', { required: 'Email is required' })}
                />
                {errors.email && <p className="text-xs text-[hsl(var(--error))]">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pr-10"
                    {...register('password', { required: 'Password is required' })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--text-secondary))]"
                  >
                    {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-[hsl(var(--error))]">{errors.password.message}</p>}
              </div>

              {error && (
                <div className="rounded-lg bg-[hsl(var(--error)/0.1)] border border-[hsl(var(--error)/0.3)] px-3 py-2 text-xs text-[hsl(var(--error))]">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" loading={isSubmitting}>
                Sign in
              </Button>
            </form>

            <p className="text-center text-xs text-[hsl(var(--text-secondary))] mt-4">
              No account?{' '}
              <Link to="/register" className="text-[hsl(var(--accent-hover))] hover:underline">
                Create one
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
