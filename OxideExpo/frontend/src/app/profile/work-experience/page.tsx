'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi, type CreateExperienceData } from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button, Input, Select, Textarea, Modal, ModalFooter, StatusBadge } from '@/components/ui';
import { Breadcrumbs } from '@/components/dashboard';
import { formatDate } from '@/lib/utils';
import type { WorkExperience } from '@/types';

const experienceSchema = z.object({
  company_name: z.string().min(1, 'Empresa es requerida'),
  position_title: z.string().min(1, 'Cargo es requerido'),
  employment_type: z.string().optional(),
  is_current: z.boolean().default(false),
  start_date: z.string().min(1, 'Fecha de inicio es requerida'),
  end_date: z.string().optional(),
  description: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
  achievements: z.string().max(1000, 'Máximo 1000 caracteres').optional(),
});

type ExperienceFormData = z.infer<typeof experienceSchema>;

const employmentTypeOptions = [
  { value: 'full_time', label: 'Tiempo Completo' },
  { value: 'part_time', label: 'Medio Tiempo' },
  { value: 'contract', label: 'Contrato' },
  { value: 'temporary', label: 'Temporal' },
  { value: 'internship', label: 'Práctica' },
  { value: 'volunteer', label: 'Voluntariado' },
];

export default function WorkExperiencePage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExperience, setEditingExperience] = useState<WorkExperience | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: experiences, isLoading } = useQuery({
    queryKey: ['experience'],
    queryFn: profileApi.listExperience,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<ExperienceFormData>({
    resolver: zodResolver(experienceSchema),
    defaultValues: {
      is_current: false,
    },
  });

  const isCurrent = watch('is_current');

  const createMutation = useMutation({
    mutationFn: (data: CreateExperienceData) => profileApi.createExperience(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experience'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'full'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateExperienceData> }) =>
      profileApi.updateExperience(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experience'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'full'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => profileApi.deleteExperience(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experience'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'full'] });
      setDeleteConfirmId(null);
    },
  });

  const openModal = (experience?: WorkExperience) => {
    if (experience) {
      setEditingExperience(experience);
      reset({
        company_name: experience.company_name,
        position_title: experience.position_title,
        employment_type: experience.employment_type || '',
        is_current: experience.is_current,
        start_date: experience.start_date,
        end_date: experience.end_date || '',
        description: experience.description || '',
        achievements: experience.achievements || '',
      });
    } else {
      setEditingExperience(null);
      reset({
        company_name: '',
        position_title: '',
        employment_type: '',
        is_current: false,
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
    setEditingExperience(null);
    reset();
  };

  const onSubmit = (data: ExperienceFormData) => {
    const payload: CreateExperienceData = {
      ...data,
      end_date: data.is_current ? undefined : data.end_date,
    };

    if (editingExperience) {
      updateMutation.mutate({ id: editingExperience.id, data: payload });
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
          { label: 'Experiencia Laboral' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Experiencia Laboral</h1>
          <p className="text-gray-500 mt-1">
            Agrega tu historial laboral para destacar ante los empleadores.
          </p>
        </div>
        <Button onClick={() => openModal()}>
          Agregar Experiencia
        </Button>
      </div>

      {/* Experience List */}
      {(experiences?.length ?? 0) > 0 ? (
        <div className="space-y-4">
          {experiences?.map((exp) => (
            <Card key={exp.id}>
              <CardContent className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-brand-light flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{exp.position_title}</h3>
                      <p className="text-gray-600">{exp.company_name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatDate(exp.start_date)} - {exp.is_current ? 'Presente' : exp.end_date ? formatDate(exp.end_date) : ''}
                      </p>
                      {exp.employment_type && (
                        <p className="text-sm text-gray-500 mt-1">
                          {employmentTypeOptions.find(o => o.value === exp.employment_type)?.label}
                        </p>
                      )}
                    </div>
                    {exp.is_current && <StatusBadge status="active" />}
                  </div>

                  {exp.description && (
                    <p className="text-gray-600 mt-3 text-sm">{exp.description}</p>
                  )}

                  {exp.achievements && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700">Logros:</p>
                      <p className="text-sm text-gray-600">{exp.achievements}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={() => openModal(exp)}
                      className="text-sm text-brand hover:text-brand-hover font-medium"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(exp.id)}
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No tienes experiencia laboral registrada
            </h3>
            <p className="text-gray-500 mb-4">
              Agrega tu historial laboral para que los empleadores conozcan tu trayectoria.
            </p>
            <Button onClick={() => openModal()}>
              Agregar Primera Experiencia
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingExperience ? 'Editar Experiencia' : 'Agregar Experiencia'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Empresa"
                placeholder="Nombre de la empresa"
                error={errors.company_name?.message}
                required
                {...register('company_name')}
              />

              <Input
                label="Cargo"
                placeholder="Tu cargo en la empresa"
                error={errors.position_title?.message}
                required
                {...register('position_title')}
              />
            </div>

            <Select
              label="Tipo de Empleo"
              options={employmentTypeOptions}
              placeholder="Selecciona el tipo de empleo"
              error={errors.employment_type?.message}
              {...register('employment_type')}
            />

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_current"
                className="w-4 h-4 text-brand border-gray-300 rounded focus:ring-brand"
                {...register('is_current')}
              />
              <label htmlFor="is_current" className="text-sm text-gray-700">
                Actualmente trabajo aquí
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Fecha de Inicio"
                type="date"
                error={errors.start_date?.message}
                required
                {...register('start_date')}
              />

              {!isCurrent && (
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
              placeholder="Describe tus responsabilidades y funciones..."
              rows={3}
              hint="Máximo 2000 caracteres"
              error={errors.description?.message}
              {...register('description')}
            />

            <Textarea
              label="Logros"
              placeholder="Describe tus logros más destacados en este cargo..."
              rows={3}
              hint="Máximo 1000 caracteres"
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
              {editingExperience ? 'Guardar Cambios' : 'Agregar'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Eliminar Experiencia"
        size="sm"
      >
        <p className="text-gray-600">
          ¿Estás seguro de que deseas eliminar esta experiencia laboral? Esta acción no se puede deshacer.
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
