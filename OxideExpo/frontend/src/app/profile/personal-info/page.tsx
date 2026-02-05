'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi, type UpdateProfileData } from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button, Input, Select, Textarea } from '@/components/ui';
import { Breadcrumbs } from '@/components/dashboard';

const profileSchema = z.object({
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  marital_status: z.string().optional(),
  nationality: z.string().optional(),
  national_id: z.string().optional(),
  region_id: z.string().optional(),
  municipality_id: z.string().optional(),
  address: z.string().optional(),
  bio: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
  professional_headline: z.string().max(200, 'Máximo 200 caracteres').optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const genderOptions = [
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Femenino' },
  { value: 'other', label: 'Otro' },
  { value: 'prefer_not_to_say', label: 'Prefiero no decir' },
];

const maritalStatusOptions = [
  { value: 'single', label: 'Soltero/a' },
  { value: 'married', label: 'Casado/a' },
  { value: 'divorced', label: 'Divorciado/a' },
  { value: 'widowed', label: 'Viudo/a' },
  { value: 'domestic_partnership', label: 'Unión civil' },
];

export default function PersonalInfoPage() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: profileApi.getProfile,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: profile ? {
      phone: profile.phone || '',
      date_of_birth: profile.date_of_birth || '',
      gender: profile.gender || '',
      marital_status: profile.marital_status || '',
      nationality: profile.nationality || '',
      national_id: profile.national_id || '',
      region_id: profile.region_id || '',
      municipality_id: profile.municipality_id || '',
      address: profile.address || '',
      bio: profile.bio || '',
      professional_headline: profile.professional_headline || '',
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateProfileData) => profileApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Perfil', href: '/profile' },
          { label: 'Información Personal' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Información Personal</h1>
          <p className="text-gray-500 mt-1">
            Actualiza tu información personal y de contacto.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-6">
          {/* Presentación Profesional */}
          <Card>
            <CardHeader>
              <CardTitle>Presentación Profesional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Título Profesional"
                placeholder="Ej: Desarrollador Full Stack con 5 años de experiencia"
                hint="Este título aparecerá en tu perfil público"
                error={errors.professional_headline?.message}
                {...register('professional_headline')}
              />

              <Textarea
                label="Sobre Mí"
                placeholder="Describe tu experiencia, habilidades y lo que te hace único como profesional..."
                rows={5}
                hint="Máximo 2000 caracteres"
                error={errors.bio?.message}
                {...register('bio')}
              />
            </CardContent>
          </Card>

          {/* Datos Personales */}
          <Card>
            <CardHeader>
              <CardTitle>Datos Personales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Teléfono"
                  type="tel"
                  placeholder="+56 9 1234 5678"
                  error={errors.phone?.message}
                  {...register('phone')}
                />

                <Input
                  label="Fecha de Nacimiento"
                  type="date"
                  error={errors.date_of_birth?.message}
                  {...register('date_of_birth')}
                />

                <Select
                  label="Género"
                  options={genderOptions}
                  placeholder="Selecciona una opción"
                  error={errors.gender?.message}
                  {...register('gender')}
                />

                <Select
                  label="Estado Civil"
                  options={maritalStatusOptions}
                  placeholder="Selecciona una opción"
                  error={errors.marital_status?.message}
                  {...register('marital_status')}
                />

                <Input
                  label="Nacionalidad"
                  placeholder="Ej: Chilena"
                  error={errors.nationality?.message}
                  {...register('nationality')}
                />

                <Input
                  label="RUT / Documento de Identidad"
                  placeholder="Ej: 12.345.678-9"
                  error={errors.national_id?.message}
                  {...register('national_id')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Dirección */}
          <Card>
            <CardHeader>
              <CardTitle>Dirección</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Región"
                  placeholder="Selecciona tu región"
                  error={errors.region_id?.message}
                  {...register('region_id')}
                />

                <Input
                  label="Comuna"
                  placeholder="Selecciona tu comuna"
                  error={errors.municipality_id?.message}
                  {...register('municipality_id')}
                />

                <div className="md:col-span-2">
                  <Input
                    label="Dirección"
                    placeholder="Calle, número, depto/casa"
                    error={errors.address?.message}
                    {...register('address')}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => reset()}
                disabled={!isDirty}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                isLoading={updateMutation.isPending}
                disabled={!isDirty}
              >
                Guardar Cambios
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>

      {updateMutation.isSuccess && (
        <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg shadow-lg">
          Perfil actualizado correctamente
        </div>
      )}

      {updateMutation.isError && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg shadow-lg">
          Error al actualizar el perfil
        </div>
      )}
    </div>
  );
}
