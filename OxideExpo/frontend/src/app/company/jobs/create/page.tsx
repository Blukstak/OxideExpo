'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button, Input, Select, Textarea } from '@/components/ui';
import { Breadcrumbs } from '@/components/dashboard';

const jobSchema = z.object({
  title: z.string().min(1, 'Título es requerido').max(200, 'Máximo 200 caracteres'),
  description: z.string().min(50, 'La descripción debe tener al menos 50 caracteres').max(5000, 'Máximo 5000 caracteres'),
  requirements: z.string().max(3000, 'Máximo 3000 caracteres').optional(),
  benefits: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
  employment_type: z.string().min(1, 'Tipo de empleo es requerido'),
  salary_min: z.string().optional(),
  salary_max: z.string().optional(),
  vacancies: z.string().min(1, 'Número de vacantes es requerido'),
  application_deadline: z.string().optional(),
  region_id: z.string().optional(),
  category_id: z.string().optional(),
});

type JobFormData = z.infer<typeof jobSchema>;

const employmentTypeOptions = [
  { value: 'full_time', label: 'Tiempo Completo' },
  { value: 'part_time', label: 'Medio Tiempo' },
  { value: 'contract', label: 'Contrato' },
  { value: 'temporary', label: 'Temporal' },
  { value: 'internship', label: 'Práctica Profesional' },
  { value: 'volunteer', label: 'Voluntariado' },
];

const categoryOptions = [
  { value: 'technology', label: 'Tecnología' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'sales', label: 'Ventas' },
  { value: 'finance', label: 'Finanzas' },
  { value: 'hr', label: 'Recursos Humanos' },
  { value: 'operations', label: 'Operaciones' },
  { value: 'design', label: 'Diseño' },
  { value: 'customer_service', label: 'Atención al Cliente' },
  { value: 'administrative', label: 'Administrativo' },
  { value: 'other', label: 'Otro' },
];

export default function CreateJobPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      vacancies: '1',
    },
  });

  const onSubmit = async (data: JobFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // In production, this would call the API
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log('Job data:', data);
      router.push('/company/jobs');
    } catch {
      setSubmitError('Error al crear la oferta. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const salaryMin = watch('salary_min');

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/company' },
          { label: 'Mis Ofertas', href: '/company/jobs' },
          { label: 'Nueva Oferta' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Crear Nueva Oferta</h1>
        <p className="text-gray-500 mt-1">
          Completa la información para publicar una nueva oferta de empleo.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Información Básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Título del Cargo"
                placeholder="Ej: Desarrollador Full Stack Senior"
                error={errors.title?.message}
                required
                {...register('title')}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Tipo de Empleo"
                  options={employmentTypeOptions}
                  placeholder="Selecciona el tipo"
                  error={errors.employment_type?.message}
                  required
                  {...register('employment_type')}
                />

                <Select
                  label="Categoría"
                  options={categoryOptions}
                  placeholder="Selecciona la categoría"
                  error={errors.category_id?.message}
                  {...register('category_id')}
                />
              </div>

              <Textarea
                label="Descripción del Cargo"
                placeholder="Describe las responsabilidades y el día a día del cargo..."
                rows={6}
                hint="Mínimo 50 caracteres"
                error={errors.description?.message}
                required
                {...register('description')}
              />
            </CardContent>
          </Card>

          {/* Requirements & Benefits */}
          <Card>
            <CardHeader>
              <CardTitle>Requisitos y Beneficios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                label="Requisitos"
                placeholder="Lista los requisitos del cargo (experiencia, habilidades, educación)..."
                rows={4}
                hint="Sé específico para atraer candidatos calificados"
                error={errors.requirements?.message}
                {...register('requirements')}
              />

              <Textarea
                label="Beneficios"
                placeholder="Describe los beneficios que ofreces (salud, vacaciones, bonos, etc.)..."
                rows={4}
                hint="Los beneficios atractivos aumentan las postulaciones"
                error={errors.benefits?.message}
                {...register('benefits')}
              />
            </CardContent>
          </Card>

          {/* Compensation */}
          <Card>
            <CardHeader>
              <CardTitle>Compensación y Detalles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Salario Mínimo (CLP)"
                  type="number"
                  placeholder="Ej: 1000000"
                  error={errors.salary_min?.message}
                  {...register('salary_min')}
                />

                <Input
                  label="Salario Máximo (CLP)"
                  type="number"
                  placeholder="Ej: 1500000"
                  error={errors.salary_max?.message}
                  {...register('salary_max')}
                />

                <Input
                  label="Vacantes"
                  type="number"
                  min="1"
                  error={errors.vacancies?.message}
                  required
                  {...register('vacancies')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Fecha Límite de Postulación"
                  type="date"
                  error={errors.application_deadline?.message}
                  {...register('application_deadline')}
                />

                <Input
                  label="Región"
                  placeholder="Selecciona la región"
                  error={errors.region_id?.message}
                  {...register('region_id')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <Card>
            <CardContent>
              {submitError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                  {submitError}
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  La oferta será revisada antes de ser publicada.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.back()}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    isLoading={isSubmitting}
                  >
                    Publicar Oferta
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
