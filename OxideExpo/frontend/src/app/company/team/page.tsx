'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Modal, ModalFooter, Input, Select, StatusBadge } from '@/components/ui';
import { Breadcrumbs } from '@/components/dashboard';

// Mock data
const mockTeamMembers = [
  {
    id: '1',
    name: 'Carlos Mendoza',
    email: 'carlos@techsolutions.cl',
    role: 'admin',
    status: 'active',
    invitedAt: '2025-06-15',
  },
  {
    id: '2',
    name: 'María López',
    email: 'maria@techsolutions.cl',
    role: 'recruiter',
    status: 'active',
    invitedAt: '2025-08-20',
  },
  {
    id: '3',
    name: 'Pedro Silva',
    email: 'pedro@techsolutions.cl',
    role: 'viewer',
    status: 'pending',
    invitedAt: '2026-02-01',
  },
];

const roleOptions = [
  { value: 'admin', label: 'Administrador' },
  { value: 'recruiter', label: 'Reclutador' },
  { value: 'viewer', label: 'Solo Lectura' },
];

const roleDescriptions: Record<string, string> = {
  admin: 'Acceso completo: puede gestionar ofertas, postulantes, equipo y configuración.',
  recruiter: 'Puede crear y gestionar ofertas, y revisar postulantes.',
  viewer: 'Solo puede ver ofertas y postulantes, sin poder modificar.',
};

type TeamMember = typeof mockTeamMembers[0];

export default function TeamPage() {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TeamMember | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('recruiter');

  const handleInvite = () => {
    // In production, this would call the API
    console.log('Inviting:', inviteEmail, 'as', inviteRole);
    setIsInviteModalOpen(false);
    setInviteEmail('');
    setInviteRole('recruiter');
  };

  const handleRoleChange = () => {
    // In production, this would call the API
    console.log('Changing role for:', editingMember?.email);
    setEditingMember(null);
  };

  const handleRemove = () => {
    // In production, this would call the API
    console.log('Removing:', deleteConfirm?.email);
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/company' },
          { label: 'Equipo' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Equipo</h1>
          <p className="text-gray-500 mt-1">
            Administra los miembros de tu equipo y sus permisos.
          </p>
        </div>
        <Button onClick={() => setIsInviteModalOpen(true)}>
          Invitar Miembro
        </Button>
      </div>

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Miembros del Equipo ({mockTeamMembers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockTeamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center">
                    <span className="text-brand font-semibold">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{member.name}</h4>
                      {member.status === 'pending' && (
                        <StatusBadge status="pending" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-medium">
                    {roleOptions.find(r => r.value === member.role)?.label}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingMember(member)}
                      className="p-2 text-gray-400 hover:text-brand rounded-lg hover:bg-white transition-colors"
                      aria-label="Editar rol"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(member)}
                      className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-white transition-colors"
                      aria-label="Eliminar"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Roles Explanation */}
      <Card>
        <CardHeader>
          <CardTitle>Roles y Permisos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {roleOptions.map((role) => (
              <div key={role.value} className="flex items-start gap-3">
                <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-medium">
                  {role.label}
                </span>
                <p className="text-sm text-gray-600">{roleDescriptions[role.value]}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invitar Miembro"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="correo@empresa.cl"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />

          <Select
            label="Rol"
            options={roleOptions}
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
          />

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">
              {roleDescriptions[inviteRole]}
            </p>
          </div>
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsInviteModalOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleInvite} disabled={!inviteEmail}>
            Enviar Invitación
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Role Modal */}
      <Modal
        isOpen={!!editingMember}
        onClose={() => setEditingMember(null)}
        title="Cambiar Rol"
        size="md"
      >
        {editingMember && (
          <>
            <div className="space-y-4">
              <p className="text-gray-600">
                Cambiar rol de <strong>{editingMember.name}</strong>
              </p>

              <Select
                label="Nuevo Rol"
                options={roleOptions}
                defaultValue={editingMember.role}
              />
            </div>

            <ModalFooter>
              <Button variant="secondary" onClick={() => setEditingMember(null)}>
                Cancelar
              </Button>
              <Button onClick={handleRoleChange}>
                Guardar Cambio
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Eliminar Miembro"
        size="sm"
      >
        {deleteConfirm && (
          <>
            <p className="text-gray-600">
              ¿Estás seguro de que deseas eliminar a <strong>{deleteConfirm.name}</strong> del equipo?
              Ya no tendrá acceso a la cuenta de empresa.
            </p>

            <ModalFooter>
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleRemove}>
                Eliminar
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
