'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient, ApiError } from '@/lib/api-client';
import { loginSchema, type LoginInput } from '@/lib/auth-validation';
import { useAuth } from '@/hooks/useAuth';
import type { LoginResponse } from '@/types/auth';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/';
  const { isAuthenticated, login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (isAuthenticated) router.replace(redirectTo);
  }, [isAuthenticated, redirectTo, router]);

  const onSubmit = async (data: LoginInput) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const response = await apiClient.post<LoginResponse>('/auth/login', data);
      login(response.accessToken, response.user);
      router.replace(redirectTo);
    } catch (error) {
      setServerError(
        error instanceof ApiError && error.status === 401
          ? 'E-mail ou senha inválidos.'
          : 'Não foi possível entrar. Tente novamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const registerHref =
    redirectTo === '/'
      ? '/register'
      : `/register?redirect=${encodeURIComponent(redirectTo)}`;

  return (
    <div className='mx-auto max-w-sm'>
      <h1 className='font-display text-2xl font-bold'>Entrar</h1>
      <p className='mt-1 text-sm text-muted-foreground'>
        Entre para confirmar sua reserva.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className='mt-6 space-y-4'>
        <div>
          <Input type='email' placeholder='E-mail' {...register('email')} />
          {errors.email && (
            <p className='mt-1 text-xs text-destructive'>
              {errors.email.message}
            </p>
          )}
        </div>
        <div>
          <Input
            type='password'
            placeholder='Senha'
            {...register('password')}
          />
          {errors.password && (
            <p className='mt-1 text-xs text-destructive'>
              {errors.password.message}
            </p>
          )}
        </div>
        {serverError && (
          <p className='text-sm text-destructive'>{serverError}</p>
        )}
        <Button type='submit' disabled={isSubmitting} className='w-full'>
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
      <p className='mt-4 text-sm text-muted-foreground'>
        Não tem conta?{' '}
        <Link
          href={registerHref}
          className='text-primary underline-offset-4 hover:underline'
        >
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}
