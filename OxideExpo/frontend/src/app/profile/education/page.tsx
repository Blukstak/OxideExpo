'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi, type CreateEducationData } from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, Button, Input, Select, Textarea, Modal, ModalFooter, StatusBadge } from '@/components/ui';
import { Breadcrumbs } from '@/components/dashboard';
import { formatDate } from '@/lib/utils';
import type { EducationRecord } from '@/types';

const educationSchema = z.object({
  institution_name: z.string().min(1, 'Institución es requerida'),
  level: z.string().min(1, 'Nivel educacional es requerido'),
  field_of_study_name: z.string().optional(),
  degree_title: z.string().optional(),
  status: z.string().min(1, 'Estado es requerido'),
  start_date: z.string().min(1, 'Fecha de inicio es requerida'),
  end_date: z.string().optional(),
  description: z.string().max(1000, 'Máximo 1000 caracteres').optional(),
  achievements: z.string().max(500, 'Máximo 500 caracteres').optional(),
});

type EducationFormData = z.infer<typeof educationSchema>;

const levelOptions = [
  { value: 'basic', label: 'Educación Básica' },
  { value: 'secondary', label: 'Educación Media' },
  { value: 'technical', label: 'Técnico Superior' },
  { value: 'university', label: 'Universitario' },
  { value: 'postgraduate', label: 'Postgrado' },
];

const statusOptions = [
  { value: 'completed', label: 'Completado' },
  { value: 'in_progress', label: 'En Curso' },
  { value: 'incomplete', label: 'Incompleto' },
];

export default function EducationPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEducation, setEditingEducation] = useState<EducationRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: education, isLoading } = useQuery({
    queryKey: ['education'],
    queryFn: profileApi.listEducation,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<EducationFormData>({
    resolver: zodResolver(educationSchema),
  });

  const status = watch('status');

  const createMutation = useMutation({
    mutationFn: (data: CreateEducationData) => profileApi.createEducation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'full'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateEducationData> }) =>
      profileApi.updateEducation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'full'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => profileApi.deleteEducation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['education'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'full'] });
      setDeleteConfirmId(null);
    },
  });

  const openModal = (edu?: EducationRecord) => {
    if (edu) {
      setEditingEducation(edu);
      reset({
        institution_name: edu.institution_name,
        level: edu.level,
        field_of_study_name: edu.field_of_study_name || '',
        degree_title: edu.degree_title || '',
        status: edu.status,
        start_date: edu.start_date,
        end_date: edu.end_date || '',
        description: edu.description || '',
        achievements: edu.achievements || '',
      });
    } else {
      setEditingEducation(null);
      reset({
        institution_name: '',
        level: '',
        field_of_study_name: '',
        degree_title: '',
        status: '',
        start_date: '',
        end_date: '',
        description: '',
        achievements: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEducation(null);
    reset();
  };

  const onSubmit = (data: EducationFormData) => {
    const payload: CreateEducationData = {
      ...data,
      end_date: data.status === 'in_progress' ? undefined : data.end_date,
    };

    if (editingEducation) {
      updateMutation.mutate({ id: editingEducation.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
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
          { label: 'Educación' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Educación</h1>
          <p className="text-gray-500 mt-1">
            Agrega tu formación académica y certificaciones.
          </p>
        </div>
        <Button onClick={() => openModal()}>
          Agregar Educación
        </Button>
      </div>

      {/* Education List */}
      {(education?.length ?? 0) > 0 ? (
        <div className="space-y-4">
          {education?.map((edu) => (
            <Card key={edu.id}>
              <CardContent className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {edu.degree_title || edu.field_of_study_name || levelOptions.find(l => l.value === edu.level)?.label}
                      </h3>
                      <p className="text-gray-600">{edu.institution_name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {levelOptions.find(l => l.value === edu.level)?.label}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(edu.start_date)} - {edu.status === 'in_progress' ? 'En Curso' : edu.end_date ? formatDate(edu.end_date) : ''}
                      </p>
                    </div>
                    <StatusBadge status={edu.status} />
                  </div>

                  {edu.field_of_study_name && (
                    <p className="text-gray-600 mt-2 text-sm">
                      Área: {edu.field_of_study_name}
                    </p>
                  )}

                  {edu.description && (
                    <p className="text-gray-600 mt-2 text-sm">{edu.description}</p>
                  )}

                  {edu.achievements && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-700">Logros:</p>
                      <p className="text-sm text-gray-600">{edu.achievements}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={() => openModal(edu)}
                      className="text-sm text-brand hover:text-brand-hover font-medium"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(edu.id)}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No tienes educación registrada
            </h3>
            <p className="text-gray-500 mb-4">
              Agrega tu formación académica para destacar tu preparación.
            </p>
            <Button onClick={() => openModal()}>
              Agregar Primera Educación
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingEducation ? 'Editar Educación' : 'Agregar Educación'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <Input
              label="Institución"
              placeholder="Nombre de la institución educativa"
              error={errors.institution_name?.message}
              required
              {...register('institution_name')}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Nivel Educacional"
                options={levelOptions}
                placeholder="Selecciona el nivel"
                error={errors.level?.message}
                required
                {...register('level')}
              />

              <Select
                label="Estado"
                options={statusOptions}
                placeholder="Selecciona el estado"
                error={errors.status?.message}
                required
                {...register('status')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Área de Estudio"
                placeholder="Ej: Ingeniería en Informática"
                error={errors.field_of_study_name?.message}
                {...register('field_of_study_name')}
              />

              <Input
                label="Título Obtenido"
                placeholder="Ej: Ingeniero Civil en Informática"
                error={errors.degree_title?.message}
                {...register('degree_title')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Fecha de Inicio"
                type="date"
                error={errors.start_date?.message}
                required
                {...register('start_date')}
              />

              {status !== 'in_progress' && (
                <Input
                  label="Fecha de Término"
                  type="date"
                  error={errors.end_date?.message}
                  {...register('end_date')}
                />
              )}
            </div>

            <Textarea
              label="Descripción"
              placeholder="Describe brevemente tus estudios..."
              rows={2}
              hint="Máximo 1000 caracteres"
              error={errors.description?.message}
              {...register('description')}
            />

            <Textarea
              label="Logros"
              placeholder="Menciona logros destacados (becas, premios, etc.)..."
              rows={2}
              hint="Máximo 500 caracteres"
              error={errors.achievements?.message}
              {...register('achievements')}
            />
          </div>

          <ModalFooter>
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingEducation ? 'Guardar Cambios' : 'Agregar'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Eliminar Educación"
        size="sm"
      >
        <p className="text-gray-600">
          ¿Estás seguro de que deseas eliminar este registro educacional? Esta acción no se puede deshacer.
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
