'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LoginSchema, type LoginFormData } from '@/lib/schemas';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface LoginModalProps {
  variant?: 'jobseeker' | 'company';
}

export function LoginModal({ variant = 'jobseeker' }: LoginModalProps) {
  const { setUser } = useAuth();
  const { isOpen, modalType, closeModal, switchTo } = useAuthModal();

  const isJobseeker = variant === 'jobseeker';
  const expectedModalType = isJobseeker ? 'login' : 'company-login';
  const shouldShow = isOpen && modalType === expectedModalType;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema),
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const { authApi } = await import('@/lib/api');
      return isJobseeker ? authApi.login(data) : authApi.loginCompany(data);
    },
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.access_token);
      setUser(data.user);
      closeModal();
      reset();
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const handleClose = () => {
    closeModal();
    reset();
    loginMutation.reset();
  };

  return (
    <Modal
      isOpen={shouldShow}
      onClose={handleClose}
      title={isJobseeker ? 'Ingreso postulante registrado' : 'Ingreso empresa registrada'}
      size="sm"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Correo electrónico"
          type="email"
          placeholder="tu@email.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Contraseña"
          type="password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />

        {loginMutation.isError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              Error al iniciar sesión. Verifica tus credenciales.
            </p>
          </div>
        )}

        <Button
          type="submit"
          fullWidth
          isLoading={loginMutation.isPending}
        >
          Iniciar sesión
        </Button>

        <div className="text-center space-y-2 pt-2">
          <button
            type="button"
            onClick={() => switchTo('forgot-password')}
            className="text-sm text-brand hover:text-brand-hover transition-colors"
          >
            ¿Olvidaste tu contraseña?
          </button>

          <p className="text-sm text-gray-600">
            ¿Aún no tienes cuenta?{' '}
            <button
              type="button"
              onClick={() => switchTo(isJobseeker ? 'register' : 'company-register')}
              className="text-brand hover:text-brand-hover font-medium transition-colors"
            >
              Regístrate aquí
            </button>
          </p>

          {isJobseeker && (
            <p className="text-sm text-gray-500 pt-2 border-t border-gray-100 mt-4">
              ¿Eres empresa?{' '}
              <button
                type="button"
                onClick={() => switchTo('company-login')}
                className="text-brand hover:text-brand-hover transition-colors"
              >
                Ingresa aquí
              </button>
            </p>
          )}

          {!isJobseeker && (
            <p className="text-sm text-gray-500 pt-2 border-t border-gray-100 mt-4">
              ¿Eres postulante?{' '}
              <button
                type="button"
                onClick={() => switchTo('login')}
                className="text-brand hover:text-brand-hover transition-colors"
              >
                Ingresa aquí
              </button>
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
