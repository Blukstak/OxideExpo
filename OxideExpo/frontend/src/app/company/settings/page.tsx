'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button, Input, Textarea } from '@/components/ui';
import { Breadcrumbs } from '@/components/dashboard';

export default function CompanySettingsPage() {
  const { logout } = useAuth();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    setIsChangingPassword(true);
    try {
      // In production, this would call the API
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert('Contraseña actualizada');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      alert('Error al cambiar la contraseña');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/company' },
          { label: 'Configuración' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 mt-1">
          Administra la configuración de tu cuenta de empresa.
        </p>
      </div>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notificaciones por Email</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 text-brand border-gray-300 rounded focus:ring-brand"
              />
              <div>
                <p className="text-gray-900">Nuevas postulaciones</p>
                <p className="text-sm text-gray-500">
                  Recibe un email cuando alguien postule a tus ofertas
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 text-brand border-gray-300 rounded focus:ring-brand"
              />
              <div>
                <p className="text-gray-900">Resumen semanal</p>
                <p className="text-sm text-gray-500">
                  Recibe un resumen semanal de la actividad de tus ofertas
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="w-4 h-4 text-brand border-gray-300 rounded focus:ring-brand"
              />
              <div>
                <p className="text-gray-900">Ofertas por vencer</p>
                <p className="text-sm text-gray-500">
                  Notificación cuando una oferta esté próxima a expirar
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 text-brand border-gray-300 rounded focus:ring-brand"
              />
              <div>
                <p className="text-gray-900">Actualizaciones del sistema</p>
                <p className="text-sm text-gray-500">
                  Información sobre nuevas funcionalidades y mejoras
                </p>
              </div>
            </label>
          </div>
        </CardContent>
        <CardFooter>
          <Button>Guardar Preferencias</Button>
        </CardFooter>
      </Card>

      {/* Auto-replies */}
      <Card>
        <CardHeader>
          <CardTitle>Respuestas Automáticas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 text-brand border-gray-300 rounded focus:ring-brand"
              />
              <span className="text-gray-900">
                Enviar confirmación automática al recibir postulaciones
              </span>
            </label>
            <Textarea
              placeholder="Mensaje de confirmación..."
              rows={3}
              defaultValue="Gracias por tu interés en formar parte de nuestro equipo. Hemos recibido tu postulación y la revisaremos a la brevedad."
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button>Guardar Mensajes</Button>
        </CardFooter>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>Cambiar Contraseña</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Contraseña Actual"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Input
            label="Nueva Contraseña"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label="Confirmar Nueva Contraseña"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </CardContent>
        <CardFooter>
          <Button
            onClick={handlePasswordChange}
            isLoading={isChangingPassword}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          >
            Cambiar Contraseña
          </Button>
        </CardFooter>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Zona de Peligro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Eliminar Cuenta de Empresa</h4>
              <p className="text-sm text-gray-500 mt-1">
                Esta acción eliminará permanentemente la cuenta de empresa, todas las ofertas y datos asociados.
              </p>
            </div>
            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              Eliminar Cuenta
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¿Eliminar cuenta de empresa?
            </h3>
            <p className="text-gray-600 mb-4">
              Esta acción es irreversible. Se eliminarán:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>Todas las ofertas de empleo</li>
              <li>Historial de postulantes</li>
              <li>Información de la empresa</li>
              <li>Todos los miembros del equipo</li>
            </ul>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={logout}>
                Sí, Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
