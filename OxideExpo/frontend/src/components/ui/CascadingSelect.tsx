'use client';

import { cn } from '@/lib/utils';
import { useEffect, useState, type ReactNode } from 'react';

interface Option {
  value: string;
  label: string;
}

interface CascadingSelectProps {
  // Parent select
  parentLabel: string;
  parentPlaceholder?: string;
  parentOptions: Option[];
  parentValue: string;
  onParentChange: (value: string) => void;
  parentError?: string;
  parentRequired?: boolean;

  // Child select
  childLabel: string;
  childPlaceholder?: string;
  childOptions: Option[];
  childValue: string;
  onChildChange: (value: string) => void;
  childError?: string;
  childRequired?: boolean;
  childDisabled?: boolean;

  // Loading state for async child options
  isLoadingChild?: boolean;

  // Layout
  direction?: 'horizontal' | 'vertical';
  className?: string;
}

export function CascadingSelect({
  parentLabel,
  parentPlaceholder = 'Seleccione...',
  parentOptions,
  parentValue,
  onParentChange,
  parentError,
  parentRequired = false,

  childLabel,
  childPlaceholder = 'Seleccione...',
  childOptions,
  childValue,
  onChildChange,
  childError,
  childRequired = false,
  childDisabled = false,

  isLoadingChild = false,

  direction = 'horizontal',
  className,
}: CascadingSelectProps) {
  // Reset child when parent changes
  const handleParentChange = (value: string) => {
    onParentChange(value);
    onChildChange('');
  };

  const isChildDisabled = childDisabled || !parentValue || isLoadingChild;

  return (
    <div
      className={cn(
        direction === 'horizontal' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4',
        className
      )}
    >
      {/* Parent Select */}
      <SelectField
        label={parentLabel}
        placeholder={parentPlaceholder}
        options={parentOptions}
        value={parentValue}
        onChange={handleParentChange}
        error={parentError}
        required={parentRequired}
      />

      {/* Child Select */}
      <SelectField
        label={childLabel}
        placeholder={isLoadingChild ? 'Cargando...' : childPlaceholder}
        options={childOptions}
        value={childValue}
        onChange={onChildChange}
        error={childError}
        required={childRequired}
        disabled={isChildDisabled}
      />
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  placeholder: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

function SelectField({
  label,
  placeholder,
  options,
  value,
  onChange,
  error,
  required,
  disabled,
}: SelectFieldProps) {
  const id = label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="w-full">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            'block w-full rounded-lg border shadow-sm appearance-none',
            'transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand',
            'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
            error
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
              : 'border-gray-300',
            'pl-4 pr-10 py-2'
          )}
          aria-invalid={error ? 'true' : 'false'}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <svg
            className="h-5 w-5 text-gray-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

// Pre-built Chilean Region → Comuna selector
interface ChileanLocationSelectProps {
  regionValue: string;
  onRegionChange: (value: string) => void;
  comunaValue: string;
  onComunaChange: (value: string) => void;
  regionError?: string;
  comunaError?: string;
  required?: boolean;
  direction?: 'horizontal' | 'vertical';
  className?: string;
}

// Chilean regions data
const REGIONES = [
  { value: '1', label: 'Tarapacá' },
  { value: '2', label: 'Antofagasta' },
  { value: '3', label: 'Atacama' },
  { value: '4', label: 'Coquimbo' },
  { value: '5', label: 'Valparaíso' },
  { value: '6', label: "O'Higgins" },
  { value: '7', label: 'Maule' },
  { value: '8', label: 'Biobío' },
  { value: '9', label: 'La Araucanía' },
  { value: '10', label: 'Los Lagos' },
  { value: '11', label: 'Aysén' },
  { value: '12', label: 'Magallanes' },
  { value: '13', label: 'Metropolitana' },
  { value: '14', label: 'Los Ríos' },
  { value: '15', label: 'Arica y Parinacota' },
  { value: '16', label: 'Ñuble' },
];

// Sample comunas by region (abbreviated - in production, fetch from API)
const COMUNAS_BY_REGION: Record<string, Option[]> = {
  '13': [
    { value: 'santiago', label: 'Santiago' },
    { value: 'providencia', label: 'Providencia' },
    { value: 'las-condes', label: 'Las Condes' },
    { value: 'nunoa', label: 'Ñuñoa' },
    { value: 'vitacura', label: 'Vitacura' },
    { value: 'la-florida', label: 'La Florida' },
    { value: 'maipu', label: 'Maipú' },
    { value: 'pudahuel', label: 'Pudahuel' },
    { value: 'san-bernardo', label: 'San Bernardo' },
    { value: 'puente-alto', label: 'Puente Alto' },
  ],
  '5': [
    { value: 'valparaiso', label: 'Valparaíso' },
    { value: 'vina-del-mar', label: 'Viña del Mar' },
    { value: 'quilpue', label: 'Quilpué' },
    { value: 'villa-alemana', label: 'Villa Alemana' },
    { value: 'concon', label: 'Concón' },
  ],
  '8': [
    { value: 'concepcion', label: 'Concepción' },
    { value: 'talcahuano', label: 'Talcahuano' },
    { value: 'hualpen', label: 'Hualpén' },
    { value: 'san-pedro', label: 'San Pedro de la Paz' },
    { value: 'coronel', label: 'Coronel' },
  ],
};

export function ChileanLocationSelect({
  regionValue,
  onRegionChange,
  comunaValue,
  onComunaChange,
  regionError,
  comunaError,
  required = false,
  direction = 'horizontal',
  className,
}: ChileanLocationSelectProps) {
  const [comunas, setComunas] = useState<Option[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (regionValue) {
      setIsLoading(true);
      // Simulate API call - in production, fetch from backend
      setTimeout(() => {
        setComunas(COMUNAS_BY_REGION[regionValue] || []);
        setIsLoading(false);
      }, 300);
    } else {
      setComunas([]);
    }
  }, [regionValue]);

  return (
    <CascadingSelect
      parentLabel="Región"
      parentPlaceholder="Seleccione región"
      parentOptions={REGIONES}
      parentValue={regionValue}
      onParentChange={onRegionChange}
      parentError={regionError}
      parentRequired={required}
      childLabel="Comuna"
      childPlaceholder="Seleccione comuna"
      childOptions={comunas}
      childValue={comunaValue}
      onChildChange={onComunaChange}
      childError={comunaError}
      childRequired={required}
      isLoadingChild={isLoading}
      direction={direction}
      className={className}
    />
  );
}

// Generic async cascading select that fetches child options
interface AsyncCascadingSelectProps {
  parentLabel: string;
  parentPlaceholder?: string;
  parentOptions: Option[];
  parentValue: string;
  onParentChange: (value: string) => void;
  parentError?: string;
  parentRequired?: boolean;

  childLabel: string;
  childPlaceholder?: string;
  childValue: string;
  onChildChange: (value: string) => void;
  childError?: string;
  childRequired?: boolean;

  fetchChildOptions: (parentValue: string) => Promise<Option[]>;

  direction?: 'horizontal' | 'vertical';
  className?: string;
}

export function AsyncCascadingSelect({
  fetchChildOptions,
  ...props
}: AsyncCascadingSelectProps) {
  const [childOptions, setChildOptions] = useState<Option[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (props.parentValue) {
      setIsLoading(true);
      fetchChildOptions(props.parentValue)
        .then(setChildOptions)
        .catch(() => setChildOptions([]))
        .finally(() => setIsLoading(false));
    } else {
      setChildOptions([]);
    }
  }, [props.parentValue, fetchChildOptions]);

  return (
    <CascadingSelect
      {...props}
      childOptions={childOptions}
      isLoadingChild={isLoading}
    />
  );
}
