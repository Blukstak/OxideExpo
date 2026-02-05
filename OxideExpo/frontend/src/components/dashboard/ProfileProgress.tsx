'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';

interface ProfileSection {
  id: string;
  name: string;
  href: string;
  completed: boolean;
  weight: number; // Percentage weight of this section
}

interface ProfileProgressProps {
  sections: ProfileSection[];
  className?: string;
}

export function ProfileProgress({ sections, className }: ProfileProgressProps) {
  const completedWeight = sections
    .filter((s) => s.completed)
    .reduce((sum, s) => sum + s.weight, 0);

  const totalWeight = sections.reduce((sum, s) => sum + s.weight, 0);
  const percentage = Math.round((completedWeight / totalWeight) * 100);

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Completitud del Perfil
        </h3>
        <span
          className={cn(
            'text-2xl font-bold',
            percentage >= 80
              ? 'text-green-600'
              : percentage >= 50
              ? 'text-yellow-600'
              : 'text-red-600'
          )}
        >
          {percentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 bg-gray-200 rounded-full mb-6 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            percentage >= 80
              ? 'bg-green-500'
              : percentage >= 50
              ? 'bg-yellow-500'
              : 'bg-red-500'
          )}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Section checklist */}
      <ul className="space-y-2">
        {sections.map((section) => (
          <li key={section.id}>
            <Link
              href={section.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                'hover:bg-gray-50'
              )}
            >
              <span
                className={cn(
                  'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center',
                  section.completed
                    ? 'bg-green-100 text-green-600'
                    : 'bg-gray-100 text-gray-400'
                )}
              >
                {section.completed ? (
                  <svg
                    className="w-3.5 h-3.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-3.5 h-3.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </span>
              <span
                className={cn(
                  'flex-1 text-sm',
                  section.completed ? 'text-gray-700' : 'text-gray-900 font-medium'
                )}
              >
                {section.name}
              </span>
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </li>
        ))}
      </ul>

      {percentage < 100 && (
        <p className="mt-4 text-sm text-gray-500">
          Completa tu perfil para aumentar tus posibilidades de ser contactado.
        </p>
      )}
    </div>
  );
}
