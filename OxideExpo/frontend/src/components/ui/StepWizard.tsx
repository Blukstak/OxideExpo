'use client';

import { cn } from '@/lib/utils';
import { createContext, useContext, useState, type ReactNode } from 'react';

interface Step {
  id: string;
  title: string;
  description?: string;
}

interface StepWizardContextValue {
  steps: Step[];
  currentStep: number;
  setCurrentStep: (step: number) => void;
  canGoNext: boolean;
  canGoPrev: boolean;
  goNext: () => void;
  goPrev: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

const StepWizardContext = createContext<StepWizardContextValue | null>(null);

export function useStepWizard() {
  const context = useContext(StepWizardContext);
  if (!context) {
    throw new Error('useStepWizard must be used within a StepWizardProvider');
  }
  return context;
}

interface StepWizardProps {
  steps: Step[];
  initialStep?: number;
  onStepChange?: (step: number) => void;
  children: ReactNode;
  className?: string;
}

export function StepWizard({
  steps,
  initialStep = 0,
  onStepChange,
  children,
  className,
}: StepWizardProps) {
  const [currentStep, setCurrentStepInternal] = useState(initialStep);

  const setCurrentStep = (step: number) => {
    if (step >= 0 && step < steps.length) {
      setCurrentStepInternal(step);
      onStepChange?.(step);
    }
  };

  const value: StepWizardContextValue = {
    steps,
    currentStep,
    setCurrentStep,
    canGoNext: currentStep < steps.length - 1,
    canGoPrev: currentStep > 0,
    goNext: () => setCurrentStep(currentStep + 1),
    goPrev: () => setCurrentStep(currentStep - 1),
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === steps.length - 1,
  };

  return (
    <StepWizardContext.Provider value={value}>
      <div className={className}>{children}</div>
    </StepWizardContext.Provider>
  );
}

// Step indicator component
interface StepIndicatorProps {
  variant?: 'default' | 'compact' | 'minimal';
  className?: string;
}

export function StepIndicator({ variant = 'default', className }: StepIndicatorProps) {
  const { steps, currentStep, setCurrentStep } = useStepWizard();

  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center justify-center gap-2', className)}>
        {steps.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentStep(index)}
            className={cn(
              'w-2 h-2 rounded-full transition-all',
              index === currentStep
                ? 'w-6 bg-brand'
                : index < currentStep
                ? 'bg-brand/50'
                : 'bg-gray-300'
            )}
            aria-label={`Ir al paso ${index + 1}`}
          />
        ))}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center', className)}>
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => setCurrentStep(index)}
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium',
                'transition-colors',
                index === currentStep
                  ? 'bg-brand text-white'
                  : index < currentStep
                  ? 'bg-brand/20 text-brand'
                  : 'bg-gray-200 text-gray-500'
              )}
            >
              {index < currentStep ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                index + 1
              )}
            </button>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-8 h-0.5 mx-1',
                  index < currentStep ? 'bg-brand' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  // Default variant - full with titles
  return (
    <nav aria-label="Progreso" className={className}>
      <ol className="flex items-center">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={cn(
              'relative',
              index !== steps.length - 1 && 'pr-8 sm:pr-20 flex-1'
            )}
          >
            {/* Connector line */}
            {index !== steps.length - 1 && (
              <div
                className="absolute top-4 left-0 -right-4 sm:-right-10"
                aria-hidden="true"
              >
                <div className="h-0.5 w-full bg-gray-200">
                  <div
                    className={cn(
                      'h-0.5 transition-all duration-300',
                      index < currentStep ? 'bg-brand w-full' : 'bg-transparent w-0'
                    )}
                  />
                </div>
              </div>
            )}

            <button
              onClick={() => setCurrentStep(index)}
              className="group relative flex flex-col items-start"
            >
              {/* Step circle */}
              <span className="flex h-8 items-center" aria-hidden="true">
                <span
                  className={cn(
                    'relative z-10 flex h-8 w-8 items-center justify-center rounded-full',
                    'transition-colors duration-200',
                    index === currentStep
                      ? 'bg-brand text-white'
                      : index < currentStep
                      ? 'bg-brand text-white'
                      : 'border-2 border-gray-300 bg-white text-gray-500'
                  )}
                >
                  {index < currentStep ? (
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </span>
              </span>

              {/* Step title */}
              <span className="mt-2 text-left">
                <span
                  className={cn(
                    'text-sm font-medium',
                    index === currentStep
                      ? 'text-brand'
                      : index < currentStep
                      ? 'text-gray-900'
                      : 'text-gray-500'
                  )}
                >
                  {step.title}
                </span>
                {step.description && (
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {step.description}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Step content wrapper
interface StepContentProps {
  stepId: string;
  children: ReactNode;
  className?: string;
}

export function StepContent({ stepId, children, className }: StepContentProps) {
  const { steps, currentStep } = useStepWizard();
  const stepIndex = steps.findIndex((s) => s.id === stepId);

  if (stepIndex !== currentStep) return null;

  return <div className={cn('animate-in fade-in duration-300', className)}>{children}</div>;
}

// Navigation buttons
interface StepNavigationProps {
  onSubmit?: () => void;
  submitLabel?: string;
  nextLabel?: string;
  prevLabel?: string;
  showSkip?: boolean;
  onSkip?: () => void;
  isSubmitting?: boolean;
  className?: string;
}

export function StepNavigation({
  onSubmit,
  submitLabel = 'Enviar',
  nextLabel = 'Siguiente',
  prevLabel = 'Anterior',
  showSkip = false,
  onSkip,
  isSubmitting = false,
  className,
}: StepNavigationProps) {
  const { canGoPrev, canGoNext, goPrev, goNext, isLastStep } = useStepWizard();

  return (
    <div className={cn('flex items-center justify-between pt-6', className)}>
      <div>
        {canGoPrev && (
          <button
            type="button"
            onClick={goPrev}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700
                       hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {prevLabel}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {showSkip && !isLastStep && (
          <button
            type="button"
            onClick={onSkip}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700
                       transition-colors disabled:opacity-50"
          >
            Omitir
          </button>
        )}

        {isLastStep ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2 bg-brand text-white rounded-lg
                       font-medium hover:bg-brand-hover transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Enviando...
              </>
            ) : (
              submitLabel
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext || isSubmitting}
            className="flex items-center gap-2 px-6 py-2 bg-brand text-white rounded-lg
                       font-medium hover:bg-brand-hover transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {nextLabel}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// Summary display for review step
interface StepSummaryProps {
  data: Record<string, { label: string; value: ReactNode }>;
  onEdit?: (stepId: string) => void;
  className?: string;
}

export function StepSummary({ data, onEdit, className }: StepSummaryProps) {
  return (
    <dl className={cn('divide-y divide-gray-200', className)}>
      {Object.entries(data).map(([key, { label, value }]) => (
        <div
          key={key}
          className="py-3 flex items-center justify-between gap-4"
        >
          <dt className="text-sm font-medium text-gray-500">{label}</dt>
          <dd className="text-sm text-gray-900 text-right flex items-center gap-2">
            {value}
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(key)}
                className="text-brand hover:text-brand-hover text-xs"
              >
                Editar
              </button>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
