'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { userSchema, type UserInput } from '@cineticket/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient, ApiError } from '@/lib/api-client';

// NOTA (fechamento da tarefa): não existe POST /auth/register no backend hoje
// (só /auth/login) — userSchema em packages/shared já modela o payload de
// cadastro (comentário do próprio schema: "Espelha o CreateUserDto do backend
// (auth/registro)"), mas o endpoint correspondente nunca foi implementado.
// Este formulário fica funcional no frontend e reporta erro de forma
// controlada (ApiError) quando o submit falha — reportado como achado, não
// contornado aqui (fora do escopo desta sessão mexer em backend/src).
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/';
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserInput>({
    resolver: zodResolver(userSchema),
    defaultValues: { role: 'CUSTOMER' },
  });

  const loginHref =
    redirectTo === '/'
      ? '/login'
      : `/login?redirect=${encodeURIComponent(redirectTo)}`;

  const onSubmit = async (data: UserInput) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/register', { ...data, role: 'CUSTOMER' });
      router.replace(loginHref);
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? 'Cadastro indisponível no momento.'
          : 'Não foi possível concluir o cadastro.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='mx-auto max-w-sm'>
      <h1 className='font-display text-2xl font-bold'>Criar conta</h1>
      <form onSubmit={handleSubmit(onSubmit)} className='mt-6 space-y-4'>
        <div>
          <Input placeholder='Nome' {...register('name')} />
          {errors.name && (
            <p className='mt-1 text-xs text-destructive'>
              {errors.name.message}
            </p>
          )}
        </div>
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
          {isSubmitting ? 'Criando...' : 'Criar conta'}
        </Button>
      </form>
      <p className='mt-4 text-sm text-muted-foreground'>
        Já tem conta?{' '}
        <Link
          href={loginHref}
          className='text-primary underline-offset-4 hover:underline'
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
