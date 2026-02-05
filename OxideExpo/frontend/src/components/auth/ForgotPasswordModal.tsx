'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const ForgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

type ForgotPasswordFormData = z.infer<typeof ForgotPasswordSchema>;

export function ForgotPasswordModal() {
  const { isOpen, modalType, closeModal, switchTo } = useAuthModal();
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const shouldShow = isOpen && modalType === 'forgot-password';

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(ForgotPasswordSchema),
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordFormData) => {
      const { authApi } = await import('@/lib/api');
      return authApi.forgotPassword(data.email);
    },
    onSuccess: (_, variables) => {
      setEmailSent(true);
      setSentEmail(variables.email);
    },
  });

  const onSubmit = (data: ForgotPasswordFormData) => {
    forgotPasswordMutation.mutate(data);
  };

  const handleClose = () => {
    closeModal();
    reset();
    setEmailSent(false);
    setSentEmail('');
    forgotPasswordMutation.reset();
  };

  const handleBackToLogin = () => {
    setEmailSent(false);
    setSentEmail('');
    reset();
    switchTo('login');
  };

  return (
    <Modal
      isOpen={shouldShow}
      onClose={handleClose}
      title={emailSent ? 'Revisa tu correo' : 'Recuperar contraseña'}
      size="sm"
    >
      {emailSent ? (
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>

          <div>
            <p className="text-gray-600">
              Hemos enviado un enlace de recuperación a:
            </p>
            <p className="font-medium text-gray-900 mt-1">{sentEmail}</p>
          </div>

          <p className="text-sm text-gray-500">
            Si no ves el correo, revisa tu carpeta de spam.
          </p>

          <div className="pt-4">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={handleBackToLogin}
            >
              Volver al inicio de sesión
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-sm text-gray-600">
            Ingresa tu correo electrónico y te enviaremos un enlace para
            restablecer tu contraseña.
          </p>

          <Input
            label="Correo electrónico"
            type="email"
            placeholder="tu@email.com"
            error={errors.email?.message}
            required
            {...register('email')}
          />

          {forgotPasswordMutation.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">
                Error al enviar el correo. Verifica tu email e intenta nuevamente.
              </p>
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            isLoading={forgotPasswordMutation.isPending}
          >
            Enviar enlace de recuperación
          </Button>

          <p className="text-center text-sm text-gray-600 pt-2">
            <button
              type="button"
              onClick={handleBackToLogin}
              className="text-brand hover:text-brand-hover font-medium transition-colors"
            >
              Volver al inicio de sesión
            </button>
          </p>
        </form>
      )}
    </Modal>
  );
}
