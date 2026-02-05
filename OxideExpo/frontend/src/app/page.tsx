'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import { jobsApi } from '@/lib/api';
import { Navbar } from '@/components/Navbar';
import { JobCard } from '@/components/JobCard';
import { Countdown } from '@/components/Countdown';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';

type JobTypeFilter = 'all' | 'full_time' | 'part_time' | 'internship' | 'volunteer';

const JOB_TYPE_TABS: { value: JobTypeFilter; label: string; icon: React.ReactNode }[] = [
  {
    value: 'all',
    label: 'Todos',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    value: 'full_time',
    label: 'Tiempo Completo',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    value: 'part_time',
    label: 'Medio Tiempo',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    value: 'internship',
    label: 'Prácticas',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      </svg>
    ),
  },
  {
    value: 'volunteer',
    label: 'Voluntariado',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
];

export default function HomePage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [jobType, setJobType] = useState<JobTypeFilter>('all');
  const [countdownComplete, setCountdownComplete] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Calculate target date based on environment
  const targetDate = useMemo(() => {
    if (process.env.NODE_ENV === 'development') {
      return new Date(Date.now() + 5000);
    }
    const targetStr = process.env.NEXT_PUBLIC_COUNTDOWN_TARGET_DATE;
    if (targetStr) {
      return new Date(targetStr);
    }
    return new Date(0);
  }, []);

  const handleCountdownComplete = useCallback(() => {
    setCountdownComplete(true);
  }, []);

  const shouldShowCountdown = targetDate.getTime() > Date.now() && !countdownComplete;

  const { data, isLoading, error } = useQuery({
    queryKey: ['jobs', page, search, jobType],
    queryFn: () =>
      jobsApi.list({
        page,
        per_page: 12,
        search: search || undefined,
        // Note: Backend would need to support job_type filter
      }),
    enabled: !shouldShowCountdown,
  });

  const handleJobTypeChange = (value: string) => {
    setJobType(value as JobTypeFilter);
    setPage(1);
  };

  if (shouldShowCountdown) {
    return (
      <>
        <Navbar />
        <Countdown targetDate={targetDate} onComplete={handleCountdownComplete} />
      </>
    );
  }

  return (
    <>
      <Navbar />

      {/* Hero Section */}
      <section className="bg-brand-light border-b border-gray-200">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Ofertas Laborales Inclusivas
          </h1>
          <p className="text-xl text-gray-700 mb-8 max-w-2xl">
            Encuentra oportunidades de empleo diseñadas para todos.
            Tu talento es lo que importa.
          </p>

          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-4 max-w-2xl">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Buscar ofertas por título, empresa o ubicación..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-12 pr-4 py-3 text-lg border border-gray-300 rounded-lg
                           bg-white text-gray-900 placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent
                           transition-shadow duration-200"
                aria-label="Buscar ofertas"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors',
                showFilters
                  ? 'bg-brand text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="hidden sm:inline">Filtros</span>
            </button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Región
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-brand focus:border-transparent">
                    <option value="">Todas las regiones</option>
                    <option value="13">Metropolitana</option>
                    <option value="5">Valparaíso</option>
                    <option value="8">Biobío</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rango Salarial
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-brand focus:border-transparent">
                    <option value="">Cualquier salario</option>
                    <option value="0-500000">Hasta $500.000</option>
                    <option value="500000-1000000">$500.000 - $1.000.000</option>
                    <option value="1000000-2000000">$1.000.000 - $2.000.000</option>
                    <option value="2000000+">Más de $2.000.000</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modalidad
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-brand focus:border-transparent">
                    <option value="">Cualquier modalidad</option>
                    <option value="on_site">Presencial</option>
                    <option value="remote">Remoto</option>
                    <option value="hybrid">Híbrido</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Industria
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-brand focus:border-transparent">
                    <option value="">Todas las industrias</option>
                    <option value="tech">Tecnología</option>
                    <option value="retail">Retail</option>
                    <option value="services">Servicios</option>
                    <option value="manufacturing">Manufactura</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowFilters(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors">
                  Aplicar Filtros
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Job Type Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <Tabs defaultValue="all" value={jobType} onChange={handleJobTypeChange}>
            <TabsList className="flex overflow-x-auto gap-1 py-2 -mb-px">
              {JOB_TYPE_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  {tab.icon}
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Job Listings */}
      <main className="container mx-auto px-4 py-8">
        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse"
              >
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/5"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700 font-medium">Error al cargar ofertas</p>
            <p className="text-red-600 text-sm mt-1">
              Por favor, intenta nuevamente más tarde.
            </p>
          </div>
        )}

        {/* Job Grid */}
        {data && (
          <>
            {data.jobs.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <svg
                  className="w-12 h-12 text-gray-400 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <p className="text-gray-700 font-medium text-lg">
                  No se encontraron ofertas
                </p>
                <p className="text-gray-600 mt-1">
                  Intenta con otros términos de búsqueda o filtros.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <p className="text-gray-700">
                    <span className="font-semibold">{data.total}</span>{' '}
                    {data.total === 1 ? 'oferta encontrada' : 'ofertas encontradas'}
                  </p>
                  <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-brand focus:border-transparent">
                    <option>Más recientes</option>
                    <option>Salario: Mayor a menor</option>
                    <option>Salario: Menor a mayor</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.jobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>

                {/* Pagination */}
                {data.total_pages > 1 && (
                  <nav
                    className="mt-10 flex justify-center items-center gap-2"
                    aria-label="Paginación"
                  >
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 rounded-lg font-medium
                                 bg-white border border-gray-300 text-gray-700
                                 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed
                                 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2
                                 transition-colors duration-200"
                      aria-label="Página anterior"
                    >
                      ← Anterior
                    </button>

                    <span className="px-4 py-2 text-gray-700 font-medium">
                      Página {page} de {data.total_pages}
                    </span>

                    <button
                      onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                      disabled={page === data.total_pages}
                      className="px-4 py-2 rounded-lg font-medium
                                 bg-white border border-gray-300 text-gray-700
                                 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed
                                 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2
                                 transition-colors duration-200"
                      aria-label="Página siguiente"
                    >
                      Siguiente →
                    </button>
                  </nav>
                )}
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
