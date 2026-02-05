'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi, type CreateSkillData } from '@/lib/api';
import { Card, CardContent, Button, Modal, ModalFooter, Input, Select } from '@/components/ui';
import { Breadcrumbs } from '@/components/dashboard';
import type { UserSkill } from '@/types';

const proficiencyLevels = [
  { value: '1', label: 'Principiante' },
  { value: '2', label: 'Básico' },
  { value: '3', label: 'Intermedio' },
  { value: '4', label: 'Avanzado' },
  { value: '5', label: 'Experto' },
];

// Mock skills for demonstration - in production these would come from the API
const availableSkills = [
  { id: 'javascript', name: 'JavaScript' },
  { id: 'typescript', name: 'TypeScript' },
  { id: 'react', name: 'React' },
  { id: 'nodejs', name: 'Node.js' },
  { id: 'python', name: 'Python' },
  { id: 'java', name: 'Java' },
  { id: 'sql', name: 'SQL' },
  { id: 'git', name: 'Git' },
  { id: 'docker', name: 'Docker' },
  { id: 'aws', name: 'AWS' },
  { id: 'excel', name: 'Microsoft Excel' },
  { id: 'word', name: 'Microsoft Word' },
  { id: 'powerpoint', name: 'Microsoft PowerPoint' },
  { id: 'communication', name: 'Comunicación' },
  { id: 'teamwork', name: 'Trabajo en Equipo' },
  { id: 'leadership', name: 'Liderazgo' },
  { id: 'problem_solving', name: 'Resolución de Problemas' },
  { id: 'time_management', name: 'Gestión del Tiempo' },
];

export default function SkillsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<UserSkill | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [proficiencyLevel, setProficiencyLevel] = useState('3');
  const [yearsOfExperience, setYearsOfExperience] = useState('');

  const { data: skills, isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: profileApi.listSkills,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateSkillData) => profileApi.createSkill(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'full'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateSkillData> }) =>
      profileApi.updateSkill(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'full'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => profileApi.deleteSkill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'full'] });
      setDeleteConfirmId(null);
    },
  });

  const openModal = (skill?: UserSkill) => {
    if (skill) {
      setEditingSkill(skill);
      setSelectedSkillId(skill.skill_id);
      setProficiencyLevel(String(skill.proficiency_level));
      setYearsOfExperience(skill.years_of_experience?.toString() || '');
    } else {
      setEditingSkill(null);
      setSelectedSkillId('');
      setProficiencyLevel('3');
      setYearsOfExperience('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSkill(null);
    setSelectedSkillId('');
    setProficiencyLevel('3');
    setYearsOfExperience('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: CreateSkillData = {
      skill_id: selectedSkillId,
      proficiency_level: parseInt(proficiencyLevel),
      years_of_experience: yearsOfExperience ? parseInt(yearsOfExperience) : undefined,
    };

    if (editingSkill) {
      updateMutation.mutate({ id: editingSkill.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getSkillName = (skillId: string) => {
    return availableSkills.find(s => s.id === skillId)?.name || skillId;
  };

  const getProficiencyLabel = (level: number) => {
    return proficiencyLevels.find(l => l.value === String(level))?.label || 'Desconocido';
  };

  const getProficiencyColor = (level: number) => {
    const colors = {
      1: 'bg-gray-200',
      2: 'bg-blue-200',
      3: 'bg-green-200',
      4: 'bg-yellow-200',
      5: 'bg-brand-light',
    };
    return colors[level as keyof typeof colors] || 'bg-gray-200';
  };

  // Filter out already added skills
  const addedSkillIds = new Set(skills?.map(s => s.skill_id) || []);
  const availableToAdd = availableSkills.filter(s => !addedSkillIds.has(s.id));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 w-32 bg-gray-200 rounded-full"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Perfil', href: '/profile' },
          { label: 'Habilidades' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Habilidades</h1>
          <p className="text-gray-500 mt-1">
            Agrega tus competencias técnicas y blandas.
          </p>
        </div>
        <Button onClick={() => openModal()} disabled={availableToAdd.length === 0}>
          Agregar Habilidad
        </Button>
      </div>

      {/* Skills Grid */}
      {(skills?.length ?? 0) > 0 ? (
        <Card>
          <CardContent>
            <div className="space-y-4">
              {skills?.map((skill) => (
                <div
                  key={skill.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full ${getProficiencyColor(skill.proficiency_level)} flex items-center justify-center font-bold text-gray-700`}>
                      {skill.proficiency_level}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{getSkillName(skill.skill_id)}</h4>
                      <p className="text-sm text-gray-500">
                        {getProficiencyLabel(skill.proficiency_level)}
                        {skill.years_of_experience && ` · ${skill.years_of_experience} años de experiencia`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openModal(skill)}
                      className="p-2 text-gray-400 hover:text-brand rounded-lg hover:bg-white transition-colors"
                      aria-label="Editar"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(skill.id)}
                      className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-white transition-colors"
                      aria-label="Eliminar"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Proficiency Legend */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500 mb-2">Niveles de competencia:</p>
              <div className="flex flex-wrap gap-3">
                {proficiencyLevels.map((level) => (
                  <div key={level.value} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full ${getProficiencyColor(parseInt(level.value))} flex items-center justify-center text-xs font-bold text-gray-700`}>
                      {level.value}
                    </div>
                    <span className="text-sm text-gray-600">{level.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No tienes habilidades registradas
            </h3>
            <p className="text-gray-500 mb-4">
              Agrega tus competencias para que los empleadores conozcan tus fortalezas.
            </p>
            <Button onClick={() => openModal()}>
              Agregar Primera Habilidad
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingSkill ? 'Editar Habilidad' : 'Agregar Habilidad'}
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {!editingSkill && (
              <Select
                label="Habilidad"
                options={availableToAdd.map(s => ({ value: s.id, label: s.name }))}
                placeholder="Selecciona una habilidad"
                value={selectedSkillId}
                onChange={(e) => setSelectedSkillId(e.target.value)}
                required
              />
            )}

            {editingSkill && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Habilidad</label>
                <p className="text-gray-900">{getSkillName(editingSkill.skill_id)}</p>
              </div>
            )}

            <Select
              label="Nivel de Competencia"
              options={proficiencyLevels}
              value={proficiencyLevel}
              onChange={(e) => setProficiencyLevel(e.target.value)}
              required
            />

            <Input
              label="Años de Experiencia"
              type="number"
              min="0"
              max="50"
              placeholder="Ej: 3"
              value={yearsOfExperience}
              onChange={(e) => setYearsOfExperience(e.target.value)}
            />
          </div>

          <ModalFooter>
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
              disabled={!editingSkill && !selectedSkillId}
            >
              {editingSkill ? 'Guardar Cambios' : 'Agregar'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Eliminar Habilidad"
        size="sm"
      >
        <p className="text-gray-600">
          ¿Estás seguro de que deseas eliminar esta habilidad? Esta acción no se puede deshacer.
        </p>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
            isLoading={deleteMutation.isPending}
          >
            Eliminar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
