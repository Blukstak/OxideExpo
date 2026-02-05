'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button, Input, Textarea, FileUpload } from '@/components/ui';
import { Breadcrumbs } from '@/components/dashboard';

const companySchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  rut: z.string().min(1, 'RUT es requerido'),
  industry: z.string().optional(),
  company_size: z.string().optional(),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  description: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
  mission: z.string().max(1000, 'Máximo 1000 caracteres').optional(),
  benefits: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  linkedin: z.string().url('URL inválida').optional().or(z.literal('')),
});

type CompanyFormData = z.infer<typeof companySchema>;

// Mock data
const mockCompany = {
  name: 'Tech Solutions SpA',
  rut: '76.123.456-7',
  industry: 'technology',
  company_size: '51-200',
  website: 'https://techsolutions.cl',
  description: 'Somos una empresa de tecnología enfocada en soluciones innovadoras para empresas de todos los tamaños.',
  mission: 'Transformar la manera en que las empresas usan la tecnología para mejorar sus procesos.',
  benefits: 'Seguro de salud, horario flexible, trabajo remoto, bonos por desempeño, capacitaciones.',
  address: 'Av. Providencia 1234, Santiago',
  phone: '+56 2 1234 5678',
  email: 'contacto@techsolutions.cl',
  linkedin: 'https://linkedin.com/company/techsolutions',
  logoUrl: null,
  coverUrl: null,
};

const industryOptions = [
  { value: 'technology', label: 'Tecnología' },
  { value: 'finance', label: 'Finanzas' },
  { value: 'healthcare', label: 'Salud' },
  { value: 'education', label: 'Educación' },
  { value: 'retail', label: 'Retail' },
  { value: 'manufacturing', label: 'Manufactura' },
  { value: 'services', label: 'Servicios' },
  { value: 'other', label: 'Otro' },
];

const sizeOptions = [
  { value: '1-10', label: '1-10 empleados' },
  { value: '11-50', label: '11-50 empleados' },
  { value: '51-200', label: '51-200 empleados' },
  { value: '201-500', label: '201-500 empleados' },
  { value: '501-1000', label: '501-1000 empleados' },
  { value: '1001+', label: 'Más de 1000 empleados' },
];

export default function CompanyProfilePage() {
  const [logoFiles, setLogoFiles] = useState<File[]>([]);
  const [coverFiles, setCoverFiles] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: mockCompany,
  });

  const onSubmit = async (data: CompanyFormData) => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // In production, this would call the API
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log('Company data:', data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      alert('Error al guardar. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/company' },
          { label: 'Perfil de Empresa' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Perfil de Empresa</h1>
        <p className="text-gray-500 mt-1">
          Actualiza la información de tu empresa para atraer candidatos.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-6">
          {/* Logo & Cover */}
          <Card>
            <CardHeader>
              <CardTitle>Imágenes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logo de la Empresa
                  </label>
                  {mockCompany.logoUrl ? (
                    <div className="mb-3">
                      <img
                        src={mockCompany.logoUrl}
                        alt="Logo actual"
                        className="w-24 h-24 rounded-lg object-cover"
                      />
                    </div>
                  ) : null}
                  <FileUpload
                    accept=".jpg,.jpeg,.png,.svg"
                    maxSize={2 * 1024 * 1024}
                    onChange={setLogoFiles}
                    value={logoFiles}
                    hint="JPG, PNG o SVG. Máximo 2MB."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Imagen de Portada
                  </label>
                  {mockCompany.coverUrl ? (
                    <div className="mb-3">
                      <img
                        src={mockCompany.coverUrl}
                        alt="Portada actual"
                        className="w-full h-24 rounded-lg object-cover"
                      />
                    </div>
                  ) : null}
                  <FileUpload
                    accept=".jpg,.jpeg,.png"
                    maxSize={5 * 1024 * 1024}
                    onChange={setCoverFiles}
                    value={coverFiles}
                    hint="JPG o PNG. Máximo 5MB. Recomendado: 1200x400px"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Información Básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Nombre de la Empresa"
                  error={errors.name?.message}
                  required
                  {...register('name')}
                />

                <Input
                  label="RUT"
                  placeholder="76.123.456-7"
                  error={errors.rut?.message}
                  required
                  {...register('rut')}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Industria
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                    {...register('industry')}
                  >
                    <option value="">Selecciona una industria</option>
                    {industryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tamaño de la Empresa
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                    {...register('company_size')}
                  >
                    <option value="">Selecciona el tamaño</option>
                    {sizeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Sitio Web"
                  type="url"
                  placeholder="https://tuempresa.cl"
                  error={errors.website?.message}
                  {...register('website')}
                />

                <Input
                  label="LinkedIn"
                  type="url"
                  placeholder="https://linkedin.com/company/..."
                  error={errors.linkedin?.message}
                  {...register('linkedin')}
                />
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle>Acerca de la Empresa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                label="Descripción"
                placeholder="Describe tu empresa, qué hacen y qué los hace únicos..."
                rows={4}
                hint="Máximo 2000 caracteres"
                error={errors.description?.message}
                {...register('description')}
              />

              <Textarea
                label="Misión y Visión"
                placeholder="¿Cuál es la misión y visión de tu empresa?"
                rows={3}
                hint="Máximo 1000 caracteres"
                error={errors.mission?.message}
                {...register('mission')}
              />

              <Textarea
                label="Beneficios para Empleados"
                placeholder="Lista los beneficios que ofreces a tus empleados..."
                rows={3}
                hint="Máximo 2000 caracteres"
                error={errors.benefits?.message}
                {...register('benefits')}
              />
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Información de Contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Teléfono"
                  type="tel"
                  placeholder="+56 2 1234 5678"
                  error={errors.phone?.message}
                  {...register('phone')}
                />

                <Input
                  label="Email de Contacto"
                  type="email"
                  placeholder="contacto@empresa.cl"
                  error={errors.email?.message}
                  {...register('email')}
                />
              </div>

              <Input
                label="Dirección"
                placeholder="Av. Principal 123, Santiago"
                error={errors.address?.message}
                {...register('address')}
              />
            </CardContent>
            <CardFooter>
              {saveSuccess && (
                <span className="text-green-600 mr-4">Cambios guardados</span>
              )}
              <Button type="submit" isLoading={isSaving}>
                Guardar Cambios
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </div>
  );
}
