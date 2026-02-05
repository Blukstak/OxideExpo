import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'brand';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  brand: 'bg-brand-light text-brand',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
}

// Pre-configured badges for common statuses
export function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { variant: BadgeVariant; label: string }> = {
    pending: { variant: 'warning', label: 'Pendiente' },
    submitted: { variant: 'info', label: 'Enviada' },
    under_review: { variant: 'info', label: 'En Revisión' },
    reviewed: { variant: 'info', label: 'Revisada' },
    shortlisted: { variant: 'brand', label: 'Preseleccionado' },
    interview_scheduled: { variant: 'brand', label: 'Entrevista' },
    accepted: { variant: 'success', label: 'Aceptada' },
    hired: { variant: 'success', label: 'Contratado' },
    offer_extended: { variant: 'success', label: 'Oferta' },
    rejected: { variant: 'error', label: 'Rechazada' },
    withdrawn: { variant: 'default', label: 'Retirada' },
    active: { variant: 'success', label: 'Activo' },
    inactive: { variant: 'default', label: 'Inactivo' },
    approved: { variant: 'success', label: 'Aprobado' },
    draft: { variant: 'default', label: 'Borrador' },
    published: { variant: 'success', label: 'Publicado' },
    expired: { variant: 'error', label: 'Expirado' },
    closed: { variant: 'default', label: 'Cerrado' },
  };

  const config = statusConfig[status.toLowerCase()] || {
    variant: 'default' as BadgeVariant,
    label: status,
  };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
