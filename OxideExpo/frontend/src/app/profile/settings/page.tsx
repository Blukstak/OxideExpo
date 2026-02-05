'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button, Input } from '@/components/ui';
import { Breadcrumbs } from '@/components/dashboard';

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Contraseña actual es requerida'),
  new_password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'Las contraseñas no coinciden',
  path: ['confirm_password'],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

const emailSchema = z.object({
  new_email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña es requerida para cambiar el email'),
});

type EmailFormData = z.infer<typeof emailSchema>;

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  const handlePasswordChange = async (data: PasswordFormData) => {
    try {
      // In a real implementation, this would call the API
      await new Promise(resolve => setTimeout(resolve, 1000));
      setPasswordSuccess(true);
      passwordForm.reset();
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch {
      passwordForm.setError('current_password', {
        message: 'Contraseña actual incorrecta',
      });
    }
  };

  const handleEmailChange = async (data: EmailFormData) => {
    try {
      // In a real implementation, this would call the API
      await new Promise(resolve => setTimeout(resolve, 1000));
      setEmailSuccess(true);
      emailForm.reset();
      setTimeout(() => setEmailSuccess(false), 3000);
    } catch {
      emailForm.setError('password', {
        message: 'Contraseña incorrecta',
      });
    }
  };

  const handleDeleteAccount = async () => {
    try {
      // In a real implementation, this would call the API
      await new Promise(resolve => setTimeout(resolve, 1000));
      logout();
    } catch {
      alert('Error al eliminar la cuenta. Intenta de nuevo.');
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Perfil', href: '/profile' },
          { label: 'Configuración' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración de Cuenta</h1>
        <p className="text-gray-500 mt-1">
          Administra tu cuenta y preferencias de seguridad.
        </p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Información de la Cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500">Nombre</label>
              <p className="mt-1 text-gray-900">{user?.first_name} {user?.last_name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Email</label>
              <p className="mt-1 text-gray-900">{user?.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Tipo de Cuenta</label>
              <p className="mt-1 text-gray-900">
                {user?.user_type === 'job_seeker' ? 'Buscador de Empleo' : user?.user_type}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Estado de Verificación</label>
              <p className="mt-1">
                {user?.email_verified ? (
                  <span className="inline-flex items-center text-green-600">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verificado
                  </span>
                ) : (
                  <span className="inline-flex items-center text-yellow-600">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Pendiente
                  </span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Email */}
      <Card>
        <CardHeader>
          <CardTitle>Cambiar Email</CardTitle>
        </CardHeader>
        <form onSubmit={emailForm.handleSubmit(handleEmailChange)}>
          <CardContent className="space-y-4">
            <Input
              label="Nuevo Email"
              type="email"
              placeholder="nuevo@ejemplo.com"
              error={emailForm.formState.errors.new_email?.message}
              {...emailForm.register('new_email')}
            />

            <Input
              label="Contraseña Actual"
              type="password"
              placeholder="Ingresa tu contraseña para confirmar"
              error={emailForm.formState.errors.password?.message}
              {...emailForm.register('password')}
            />

            {emailSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
                Se ha enviado un enlace de verificación a tu nuevo email.
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" isLoading={emailForm.formState.isSubmitting}>
              Cambiar Email
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>Cambiar Contraseña</CardTitle>
        </CardHeader>
        <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)}>
          <CardContent className="space-y-4">
            <Input
              label="Contraseña Actual"
              type="password"
              placeholder="Ingresa tu contraseña actual"
              error={passwordForm.formState.errors.current_password?.message}
              {...passwordForm.register('current_password')}
            />

            <Input
              label="Nueva Contraseña"
              type="password"
              placeholder="Mínimo 8 caracteres"
              error={passwordForm.formState.errors.new_password?.message}
              {...passwordForm.register('new_password')}
            />

            <Input
              label="Confirmar Nueva Contraseña"
              type="password"
              placeholder="Repite la nueva contraseña"
              error={passwordForm.formState.errors.confirm_password?.message}
              {...passwordForm.register('confirm_password')}
            />

            {passwordSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
                Contraseña actualizada correctamente.
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" isLoading={passwordForm.formState.isSubmitting}>
              Cambiar Contraseña
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Zona de Peligro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Eliminar Cuenta</h4>
              <p className="text-sm text-gray-500 mt-1">
                Una vez que elimines tu cuenta, no hay vuelta atrás. Todos tus datos serán eliminados permanentemente.
              </p>
            </div>
            <Button
              variant="danger"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Eliminar Cuenta
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¿Estás seguro?
            </h3>
            <p className="text-gray-600 mb-4">
              Esta acción eliminará permanentemente tu cuenta y todos tus datos, incluyendo:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Tu perfil y toda tu información personal</li>
              <li>Tu historial de postulaciones</li>
              <li>Tu CV y documentos subidos</li>
            </ul>
            <p className="text-red-600 font-medium mb-6">
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteAccount}
              >
                Sí, Eliminar Mi Cuenta
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
