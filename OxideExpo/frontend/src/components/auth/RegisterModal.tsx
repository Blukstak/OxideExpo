'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { RegisterSchema, type RegisterFormData } from '@/lib/schemas';
import { authApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function RegisterModal() {
  const { setUser } = useAuth();
  const { isOpen, modalType, closeModal, switchTo } = useAuthModal();

  const shouldShow = isOpen && modalType === 'register';

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(RegisterSchema),
  });

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.access_token);
      setUser(data.user);
      closeModal();
      reset();
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  const handleClose = () => {
    closeModal();
    reset();
    registerMutation.reset();
  };

  return (
    <Modal
      isOpen={shouldShow}
      onClose={handleClose}
      title="Registro de usuario"
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Nombre"
            placeholder="Juan"
            error={errors.nombre?.message}
            required
            {...register('nombre')}
          />

          <Input
            label="Apellidos"
            placeholder="Pérez González"
            error={errors.apellidos?.message}
            required
            {...register('apellidos')}
          />
        </div>

        <Input
          label="Email"
          type="email"
          placeholder="tu@email.com"
          error={errors.email?.message}
          required
          {...register('email')}
        />

        <Input
          label="RUT"
          placeholder="12345678-9"
          error={errors.rut?.message}
          hint="Formato: 12345678-9"
          required
          {...register('rut')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            required
            {...register('password')}
          />

          <Input
            label="Confirmar contraseña"
            type="password"
            placeholder="••••••••"
            error={errors.confirmPassword?.message}
            required
            {...register('confirmPassword')}
          />
        </div>

        <Input
          label="Teléfono"
          type="tel"
          placeholder="+56 9 1234 5678"
          error={errors.telefono?.message}
          {...register('telefono')}
        />

        {registerMutation.isError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              Error al registrarse. Verifica tus datos e intenta nuevamente.
            </p>
          </div>
        )}

        <div className="flex items-start gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            id="terms"
            className="mt-1 rounded border-gray-300 text-brand focus:ring-brand"
            required
          />
          <label htmlFor="terms">
            Acepto los{' '}
            <a href="/terms" className="text-brand hover:underline" target="_blank">
              términos y condiciones
            </a>{' '}
            y la{' '}
            <a href="/privacy" className="text-brand hover:underline" target="_blank">
              política de privacidad
            </a>
          </label>
        </div>

        <Button
          type="submit"
          fullWidth
          isLoading={registerMutation.isPending}
        >
          Crear cuenta
        </Button>

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">O regístrate con</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300
                       rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </button>

          <button
            type="button"
            className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300
                       rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            LinkedIn
          </button>
        </div>

        <p className="text-center text-sm text-gray-600 pt-2">
          ¿Ya tienes cuenta?{' '}
          <button
            type="button"
            onClick={() => switchTo('login')}
            className="text-brand hover:text-brand-hover font-medium transition-colors"
          >
            Inicia sesión
          </button>
        </p>

        <p className="text-center text-sm text-gray-500 pt-2 border-t border-gray-100 mt-4">
          ¿Eres empresa?{' '}
          <button
            type="button"
            onClick={() => switchTo('company-register')}
            className="text-brand hover:text-brand-hover transition-colors"
          >
            Regístrate como empresa
          </button>
        </p>
      </form>
    </Modal>
  );
}
