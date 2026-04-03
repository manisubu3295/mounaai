import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth.store';
import { register as registerUser } from '@/services/auth.service';

interface RegisterForm {
  full_name: string;
  company_name: string;
  email: string;
  password: string;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<RegisterForm>();

  const onSubmit = async (data: RegisterForm) => {
    try {
      setError(null);
      const result = await registerUser(data);
      setAuth(result.user, result.access_token);
      navigate('/settings/llm?onboarding=true');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-xl bg-[hsl(var(--accent)/0.15)] border border-[hsl(var(--accent)/0.3)] flex items-center justify-center">
            <Zap className="w-4 h-4 text-[hsl(var(--accent-hover))]" />
          </div>
          <span className="text-lg font-semibold">PocketComputer</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create your workspace</CardTitle>
            <CardDescription>Set up your enterprise AI assistant in 30 seconds</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Full name</Label>
                  <Input placeholder="Jane Smith" {...register('full_name', { required: true })} />
                  {errors.full_name && <p className="text-xs text-[hsl(var(--error))]">Required</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Company</Label>
                  <Input placeholder="Acme Corp" {...register('company_name', { required: true })} />
                  {errors.company_name && <p className="text-xs text-[hsl(var(--error))]">Required</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Work email</Label>
                <Input type="email" placeholder="you@company.com" {...register('email', { required: true })} />
                {errors.email && <p className="text-xs text-[hsl(var(--error))]">Required</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  {...register('password', {
                    required: true,
                    minLength: { value: 8, message: 'Min 8 characters' },
                    pattern: { value: /(?=.*[A-Z])(?=.*[0-9])/, message: 'Must contain uppercase and number' },
                  })}
                />
                {errors.password && <p className="text-xs text-[hsl(var(--error))]">{errors.password.message}</p>}
              </div>

              {error && (
                <div className="rounded-lg bg-[hsl(var(--error)/0.1)] border border-[hsl(var(--error)/0.3)] px-3 py-2 text-xs text-[hsl(var(--error))]">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" loading={isSubmitting}>
                Create workspace
              </Button>
            </form>

            <p className="text-center text-xs text-[hsl(var(--text-secondary))] mt-4">
              Already have an account?{' '}
              <Link to="/login" className="text-[hsl(var(--accent-hover))] hover:underline">Sign in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
