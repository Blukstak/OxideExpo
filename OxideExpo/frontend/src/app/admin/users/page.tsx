'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Modal, ModalFooter, StatusBadge, Select } from '@/components/ui';
import { Breadcrumbs } from '@/components/dashboard';
import { Pagination } from '@/components/ui/Table';

// Mock data
const mockUsers = [
  {
    id: '1',
    email: 'maria.gonzalez@email.com',
    firstName: 'María',
    lastName: 'González',
    userType: 'job_seeker',
    accountStatus: 'active',
    emailVerified: true,
    createdAt: '2025-06-15',
    lastLogin: '2026-02-04',
  },
  {
    id: '2',
    email: 'juan.perez@empresa.cl',
    firstName: 'Juan',
    lastName: 'Pérez',
    userType: 'company',
    accountStatus: 'active',
    emailVerified: true,
    createdAt: '2025-08-20',
    lastLogin: '2026-02-03',
  },
  {
    id: '3',
    email: 'ana.silva@email.com',
    firstName: 'Ana',
    lastName: 'Silva',
    userType: 'job_seeker',
    accountStatus: 'suspended',
    emailVerified: true,
    createdAt: '2025-10-01',
    lastLogin: '2026-01-15',
  },
  {
    id: '4',
    email: 'carlos.ruiz@omil.cl',
    firstName: 'Carlos',
    lastName: 'Ruiz',
    userType: 'omil',
    accountStatus: 'active',
    emailVerified: true,
    createdAt: '2025-11-10',
    lastLogin: '2026-02-01',
  },
  {
    id: '5',
    email: 'pedro.martinez@email.com',
    firstName: 'Pedro',
    lastName: 'Martínez',
    userType: 'job_seeker',
    accountStatus: 'pending',
    emailVerified: false,
    createdAt: '2026-02-01',
    lastLogin: null,
  },
];

const userTypeLabels: Record<string, string> = {
  job_seeker: 'Postulante',
  company: 'Empresa',
  omil: 'OMIL',
  admin: 'Admin',
};

const userTypeOptions = [
  { value: '', label: 'Todos los tipos' },
  { value: 'job_seeker', label: 'Postulante' },
  { value: 'company', label: 'Empresa' },
  { value: 'omil', label: 'OMIL' },
  { value: 'admin', label: 'Admin' },
];

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'active', label: 'Activo' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'suspended', label: 'Suspendido' },
];

type User = typeof mockUsers[0];

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [userToSuspend, setUserToSuspend] = useState<User | null>(null);

  const filteredUsers = mockUsers.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !typeFilter || user.userType === typeFilter;
    const matchesStatus = !statusFilter || user.accountStatus === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleSuspend = () => {
    // In production, this would call the API
    console.log('Suspending user:', userToSuspend?.email);
    setShowSuspendModal(false);
    setUserToSuspend(null);
  };

  const handleActivate = (user: User) => {
    // In production, this would call the API
    console.log('Activating user:', user.email);
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Usuarios' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
        <p className="text-gray-500 mt-1">
          Administra todos los usuarios registrados en la plataforma.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Buscar por nombre o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
            <Select
              options={userTypeOptions}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
            <Button variant="secondary">
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Usuario</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Tipo</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Estado</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Email Verificado</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Registro</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Último Acceso</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.userType === 'job_seeker' ? 'bg-blue-100 text-blue-700' :
                        user.userType === 'company' ? 'bg-purple-100 text-purple-700' :
                        user.userType === 'omil' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {userTypeLabels[user.userType]}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={user.accountStatus} />
                    </td>
                    <td className="py-3 px-4">
                      {user.emailVerified ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Verificado
                        </span>
                      ) : (
                        <span className="text-yellow-600 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString('es-CL')}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString('es-CL')
                        : 'Nunca'
                      }
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="p-2 text-gray-400 hover:text-brand rounded-lg hover:bg-gray-100 transition-colors"
                          aria-label="Ver detalles"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {user.accountStatus === 'suspended' ? (
                          <button
                            onClick={() => handleActivate(user)}
                            className="p-2 text-gray-400 hover:text-green-500 rounded-lg hover:bg-gray-100 transition-colors"
                            aria-label="Activar"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setUserToSuspend(user);
                              setShowSuspendModal(true);
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 transition-colors"
                            aria-label="Suspender"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredUsers.length / 10)}
              onPageChange={setCurrentPage}
            />
          </div>
        </CardContent>
      </Card>

      {/* User Details Modal */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="Detalles del Usuario"
        size="md"
      >
        {selectedUser && (
          <>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-brand-light flex items-center justify-center">
                  <span className="text-brand text-xl font-semibold">
                    {selectedUser.firstName[0]}{selectedUser.lastName[0]}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </h3>
                  <p className="text-gray-500">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-gray-500">Tipo de Usuario</p>
                  <p className="font-medium">{userTypeLabels[selectedUser.userType]}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Estado</p>
                  <StatusBadge status={selectedUser.accountStatus} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email Verificado</p>
                  <p className="font-medium">{selectedUser.emailVerified ? 'Sí' : 'No'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fecha de Registro</p>
                  <p className="font-medium">
                    {new Date(selectedUser.createdAt).toLocaleDateString('es-CL')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Último Acceso</p>
                  <p className="font-medium">
                    {selectedUser.lastLogin
                      ? new Date(selectedUser.lastLogin).toLocaleDateString('es-CL')
                      : 'Nunca'
                    }
                  </p>
                </div>
              </div>
            </div>

            <ModalFooter>
              <Button variant="secondary" onClick={() => setSelectedUser(null)}>
                Cerrar
              </Button>
              {selectedUser.userType === 'company' && (
                <Button onClick={() => window.open(`/admin/companies/${selectedUser.id}`, '_blank')}>
                  Ver Empresa
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </Modal>

      {/* Suspend Confirmation Modal */}
      <Modal
        isOpen={showSuspendModal}
        onClose={() => {
          setShowSuspendModal(false);
          setUserToSuspend(null);
        }}
        title="Suspender Usuario"
        size="sm"
      >
        {userToSuspend && (
          <>
            <p className="text-gray-600">
              ¿Estás seguro de que deseas suspender a <strong>{userToSuspend.firstName} {userToSuspend.lastName}</strong>?
              El usuario no podrá acceder a la plataforma hasta que sea reactivado.
            </p>

            <ModalFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowSuspendModal(false);
                  setUserToSuspend(null);
                }}
              >
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleSuspend}>
                Suspender
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
