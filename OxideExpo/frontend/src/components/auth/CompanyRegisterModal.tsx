'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import {
  StepWizard,
  StepIndicator,
  StepContent,
  StepNavigation,
  useStepWizard,
} from '@/components/ui/StepWizard';

const CompanyRegisterSchema = z.object({
  // Company info
  company_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  legal_name: z.string().min(2, 'La razón social debe tener al menos 2 caracteres'),
  tax_id: z.string().regex(/^\d{7,8}-[\dkK]$/, 'Formato de RUT inválido (ej: 12345678-9)'),
  industry_id: z.string().optional(),
  company_size: z.string().optional(),

  // Contact info
  phone: z.string().optional(),
  website_url: z.string().url('URL inválida').optional().or(z.literal('')),
  region_id: z.string().optional(),
  municipality_id: z.string().optional(),
  address: z.string().optional(),

  // User account
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string(),
  first_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  last_name: z.string().min(2, 'Los apellidos deben tener al menos 2 caracteres'),
  job_title: z.string().optional(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  }
);

type CompanyRegisterFormData = z.infer<typeof CompanyRegisterSchema>;

const STEPS = [
  { id: 'company', title: 'Empresa', description: 'Información básica' },
  { id: 'contact', title: 'Contacto', description: 'Datos de contacto' },
  { id: 'account', title: 'Cuenta', description: 'Usuario administrador' },
];

const COMPANY_SIZES = [
  { value: 'micro', label: '1-9 empleados' },
  { value: 'small', label: '10-49 empleados' },
  { value: 'medium', label: '50-249 empleados' },
  { value: 'large', label: '250+ empleados' },
];

export function CompanyRegisterModal() {
  const { setUser } = useAuth();
  const { isOpen, modalType, closeModal, switchTo } = useAuthModal();

  const shouldShow = isOpen && modalType === 'company-register';

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    trigger,
  } = useForm<CompanyRegisterFormData>({
    resolver: zodResolver(CompanyRegisterSchema),
    mode: 'onBlur',
  });

  const registerMutation = useMutation({
    mutationFn: async (data: CompanyRegisterFormData) => {
      const { authApi } = await import('@/lib/api');
      // Company registration would be a different endpoint
      // For now, simulate with regular register
      return authApi.register({
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
        nombre: data.first_name,
        apellidos: data.last_name,
        rut: data.tax_id,
      });
    },
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.access_token);
      setUser(data.user);
      closeModal();
      reset();
    },
  });

  const onSubmit = (data: CompanyRegisterFormData) => {
    registerMutation.mutate(data);
  };

  const handleClose = () => {
    closeModal();
    reset();
    registerMutation.reset();
  };

  return (
    <Modal
      isOpen={shouldShow}
      onClose={handleClose}
      title="Registro de empresa"
      size="lg"
    >
      <StepWizard steps={STEPS}>
        <StepIndicator variant="compact" className="mb-6" />

        <form onSubmit={handleSubmit(onSubmit)}>
          <StepContent stepId="company" className="space-y-4">
            <Input
              label="Nombre comercial"
              placeholder="Mi Empresa S.A."
              error={errors.company_name?.message}
              required
              {...register('company_name')}
            />

            <Input
              label="Razón social"
              placeholder="Mi Empresa Sociedad Anónima"
              error={errors.legal_name?.message}
              required
              {...register('legal_name')}
            />

            <Input
              label="RUT empresa"
              placeholder="12345678-9"
              error={errors.tax_id?.message}
              hint="Formato: 12345678-9"
              required
              {...register('tax_id')}
            />

            <Select
              label="Tamaño de empresa"
              placeholder="Seleccione..."
              options={COMPANY_SIZES}
              error={errors.company_size?.message}
              {...register('company_size')}
            />
          </StepContent>

          <StepContent stepId="contact" className="space-y-4">
            <Input
              label="Teléfono"
              type="tel"
              placeholder="+56 2 1234 5678"
              error={errors.phone?.message}
              {...register('phone')}
            />

            <Input
              label="Sitio web"
              type="url"
              placeholder="https://www.miempresa.cl"
              error={errors.website_url?.message}
              {...register('website_url')}
            />

            <Input
              label="Dirección"
              placeholder="Av. Principal 123, Santiago"
              error={errors.address?.message}
              {...register('address')}
            />
          </StepContent>

          <StepContent stepId="account" className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Crea la cuenta del administrador principal de la empresa.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nombre"
                placeholder="Juan"
                error={errors.first_name?.message}
                required
                {...register('first_name')}
              />

              <Input
                label="Apellidos"
                placeholder="Pérez González"
                error={errors.last_name?.message}
                required
                {...register('last_name')}
              />
            </div>

            <Input
              label="Cargo"
              placeholder="Gerente de RRHH"
              error={errors.job_title?.message}
              {...register('job_title')}
            />

            <Input
              label="Email corporativo"
              type="email"
              placeholder="contacto@empresa.cl"
              error={errors.email?.message}
              hint="Este será el email de acceso"
              required
              {...register('email')}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Contraseña"
                type="password"
                placeholder="••••••••"
                error={errors.password?.message}
                required
                {...register('password')}
              />

              <Input
                label="Confirmar contraseña"
                type="password"
                placeholder="••••••••"
                error={errors.confirmPassword?.message}
                required
                {...register('confirmPassword')}
              />
            </div>

            {registerMutation.isError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">
                  Error al registrar la empresa. Verifica los datos e intenta nuevamente.
                </p>
              </div>
            )}

            <div className="flex items-start gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                id="company-terms"
                className="mt-1 rounded border-gray-300 text-brand focus:ring-brand"
                required
              />
              <label htmlFor="company-terms">
                Acepto los{' '}
                <a href="/terms" className="text-brand hover:underline" target="_blank">
                  términos y condiciones
                </a>{' '}
                y la{' '}
                <a href="/privacy" className="text-brand hover:underline" target="_blank">
                  política de privacidad
                </a>
              </label>
            </div>
          </StepContent>

          <StepNavigationWrapper
            isSubmitting={registerMutation.isPending}
            trigger={trigger}
          />
        </form>

        <p className="text-center text-sm text-gray-600 pt-4 mt-4 border-t border-gray-100">
          ¿Ya tienes cuenta de empresa?{' '}
          <button
            type="button"
            onClick={() => switchTo('company-login')}
            className="text-brand hover:text-brand-hover font-medium transition-colors"
          >
            Inicia sesión
          </button>
        </p>
      </StepWizard>
    </Modal>
  );
}

function StepNavigationWrapper({
  isSubmitting,
  trigger,
}: {
  isSubmitting: boolean;
  trigger: (name?: keyof CompanyRegisterFormData | (keyof CompanyRegisterFormData)[]) => Promise<boolean>;
}) {
  const { currentStep, goNext, steps } = useStepWizard();

  const validateCurrentStep = async () => {
    const stepId = steps[currentStep].id;
    let fieldsToValidate: (keyof CompanyRegisterFormData)[] = [];

    switch (stepId) {
      case 'company':
        fieldsToValidate = ['company_name', 'legal_name', 'tax_id'];
        break;
      case 'contact':
        fieldsToValidate = ['phone', 'website_url', 'address'];
        break;
      case 'account':
        fieldsToValidate = ['first_name', 'last_name', 'email', 'password', 'confirmPassword'];
        break;
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      goNext();
    }
  };

  return (
    <StepNavigation
      isSubmitting={isSubmitting}
      submitLabel="Registrar empresa"
    />
  );
}
