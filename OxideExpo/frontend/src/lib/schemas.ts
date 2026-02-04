import { z } from 'zod';

// Register schema
export const RegisterSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string(),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  apellidos: z.string().min(2, 'Los apellidos deben tener al menos 2 caracteres'),
  rut: z.string().regex(/^\d{7,8}-[\dkK]$/, 'Formato de RUT inválido (ej: 12345678-9)'),
  telefono: z.string().optional(),
  region_id: z.number().int().positive().optional(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  }
);

export type RegisterFormData = z.infer<typeof RegisterSchema>;

// Login schema
export const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export type LoginFormData = z.infer<typeof LoginSchema>;

// Application schema
export const ApplicationSchema = z.object({
  job_id: z.number().int().positive(),
  cover_letter: z.string()
    .min(50, 'La carta de presentación debe tener al menos 50 caracteres')
    .max(2000, 'La carta de presentación no puede exceder 2000 caracteres')
    .optional(),
});

export type ApplicationFormData = z.infer<typeof ApplicationSchema>;

// Job filters schema
export const JobFiltersSchema = z.object({
  page: z.number().int().positive().optional(),
  per_page: z.number().int().positive().max(100).optional(),
  category_id: z.number().int().positive().optional(),
  region_id: z.number().int().positive().optional(),
  search: z.string().optional(),
});

export type JobFiltersData = z.infer<typeof JobFiltersSchema>;
