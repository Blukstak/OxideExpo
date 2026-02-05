'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { jobsApi, applicationsApi } from '@/lib/api';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { openLogin } = useAuthModal();
  const [coverLetter, setCoverLetter] = useState('');
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const jobId = params.id as string;

  const { data: job, isLoading, error } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => jobsApi.get(jobId),
    enabled: !!jobId,
  });

  const applyMutation = useMutation({
    mutationFn: applicationsApi.create,
    onSuccess: () => {
      setShowApplicationForm(false);
      setCoverLetter('');
    },
  });

  const handleApply = () => {
    if (!isAuthenticated) {
      openLogin();
      return;
    }
    setShowApplicationForm(true);
  };

  const handleSubmitApplication = () => {
    applyMutation.mutate({
      job_id: jobId,
      cover_letter: coverLetter || undefined,
    });
  };

  const handleSave = () => {
    if (!isAuthenticated) {
      openLogin();
      return;
    }
    setIsSaved(!isSaved);
  };

  const handleShare = (platform: string) => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = job?.title || 'Oferta de trabajo';
    const text = `${title} en ${job?.company_name}`;

    switch (platform) {
      case 'linkedin':
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
          '_blank'
        );
        break;
      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
          '_blank'
        );
        break;
      case 'whatsapp':
        window.open(
          `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
          '_blank'
        );
        break;
      case 'email':
        window.open(
          `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
          '_blank'
        );
        break;
      case 'copy':
        navigator.clipboard.writeText(url);
        break;
    }
    setShowShareMenu(false);
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="bg-white rounded-lg border border-gray-200 p-8 animate-pulse">
            <div className="h-10 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/5"></div>
            </div>
            <div className="mt-8 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <p className="text-red-700 font-medium text-lg">Error al cargar la oferta</p>
            <p className="text-red-600 mt-2">Por favor, intenta nuevamente más tarde.</p>
            <Link
              href="/"
              className="inline-block mt-4 px-6 py-2 bg-brand text-white font-medium rounded-lg
                         hover:bg-brand-hover transition-colors"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (!job) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-700 font-medium text-lg">Oferta no encontrada</p>
            <Link
              href="/"
              className="inline-block mt-4 px-6 py-2 bg-brand text-white font-medium rounded-lg
                         hover:bg-brand-hover transition-colors"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-700 hover:text-brand
                     transition-colors mb-6 font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a ofertas
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <article className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <header className="bg-brand-light border-b border-gray-200 p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {job.employment_type && (
                      <Badge variant="brand" size="sm">
                        {job.employment_type === 'full_time' ? 'Tiempo Completo' :
                         job.employment_type === 'part_time' ? 'Medio Tiempo' :
                         job.employment_type === 'internship' ? 'Práctica' :
                         job.employment_type === 'volunteer' ? 'Voluntariado' :
                         job.employment_type}
                      </Badge>
                    )}
                    <span className="text-sm text-gray-500">
                      Publicado {formatDate(job.created_at)}
                    </span>
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{job.title}</h1>
                  <p className="text-xl text-gray-700 font-medium">{job.company_name}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    className={cn(
                      'p-2 rounded-lg border transition-colors',
                      isSaved
                        ? 'bg-brand text-white border-brand'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-brand hover:text-brand'
                    )}
                    aria-label={isSaved ? 'Quitar de guardados' : 'Guardar oferta'}
                  >
                    <svg
                      className="w-5 h-5"
                      fill={isSaved ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                      />
                    </svg>
                  </button>

                  {/* Share Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowShareMenu(!showShareMenu)}
                      className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600
                                 hover:border-brand hover:text-brand transition-colors"
                      aria-label="Compartir"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                        />
                      </svg>
                    </button>

                    {showShareMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowShareMenu(false)}
                        />
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                          <button
                            onClick={() => handleShare('linkedin')}
                            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <svg className="w-4 h-4 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                            </svg>
                            LinkedIn
                          </button>
                          <button
                            onClick={() => handleShare('twitter')}
                            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <svg className="w-4 h-4 text-[#1DA1F2]" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                            </svg>
                            Twitter
                          </button>
                          <button
                            onClick={() => handleShare('whatsapp')}
                            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <svg className="w-4 h-4 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            WhatsApp
                          </button>
                          <button
                            onClick={() => handleShare('email')}
                            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Email
                          </button>
                          <hr className="my-1" />
                          <button
                            onClick={() => handleShare('copy')}
                            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            Copiar enlace
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mt-4">
                {job.region_name && (
                  <span className="inline-flex items-center gap-1 text-gray-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {job.region_name}
                  </span>
                )}
                {job.category_name && (
                  <span className="inline-flex items-center gap-1 text-gray-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    {job.category_name}
                  </span>
                )}
                {job.salary_min && job.salary_max && (
                  <span className="inline-flex items-center gap-1 font-semibold text-green-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatCurrency(job.salary_min)} - {formatCurrency(job.salary_max)}
                  </span>
                )}
              </div>
            </header>

            {/* Content */}
            <div className="p-8 space-y-8">
              {/* Description */}
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Descripción</h2>
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {job.description}
                </p>
              </section>

              {/* Requirements */}
              {job.requirements && (
                <section>
                  <h2 className="text-xl font-semibold text-gray-900 mb-3">Requisitos</h2>
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {job.requirements}
                  </p>
                </section>
              )}

              {/* Benefits */}
              {job.benefits && (
                <section>
                  <h2 className="text-xl font-semibold text-gray-900 mb-3">Beneficios</h2>
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {job.benefits}
                  </p>
                </section>
              )}

              {/* Meta Info */}
              <div className="flex flex-wrap gap-6 text-sm text-gray-600 pt-4 border-t border-gray-200">
                <p>
                  <span className="font-medium">{job.vacancies}</span>{' '}
                  {job.vacancies === 1 ? 'vacante disponible' : 'vacantes disponibles'}
                </p>
                {job.application_deadline && (
                  <p>
                    Fecha límite:{' '}
                    <span className="font-medium">{formatDate(job.application_deadline)}</span>
                  </p>
                )}
                <p>{job.views_count} visualizaciones</p>
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Apply Card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              {!showApplicationForm ? (
                <>
                  <button
                    onClick={handleApply}
                    className="w-full px-6 py-3 bg-brand text-white rounded-lg
                               font-semibold text-lg
                               hover:bg-brand-hover transition-colors"
                  >
                    Postular ahora
                  </button>
                  <p className="text-sm text-gray-500 text-center mt-3">
                    {isAuthenticated ? 'Postula en segundos' : 'Inicia sesión para postular'}
                  </p>
                </>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Carta de Presentación
                  </h3>
                  <p className="text-sm text-gray-600">Opcional pero recomendada</p>
                  <textarea
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg
                               text-gray-900 placeholder-gray-500
                               focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent
                               transition-shadow duration-200 resize-none"
                    rows={6}
                    placeholder="¿Por qué te interesa esta posición?"
                  />
                  <p className="text-xs text-gray-500">
                    {coverLetter.length}/2000 caracteres
                  </p>

                  <button
                    onClick={handleSubmitApplication}
                    disabled={applyMutation.isPending}
                    className="w-full px-6 py-3 bg-brand text-white font-medium rounded-lg
                               hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed
                               transition-colors"
                  >
                    {applyMutation.isPending ? 'Enviando...' : 'Enviar Postulación'}
                  </button>
                  <button
                    onClick={() => setShowApplicationForm(false)}
                    className="w-full px-6 py-2 text-gray-600 font-medium hover:text-gray-800"
                  >
                    Cancelar
                  </button>

                  {applyMutation.isError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-700 text-sm">
                        Error al enviar. Puede que ya hayas postulado.
                      </p>
                    </div>
                  )}

                  {applyMutation.isSuccess && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-700 text-sm font-medium">
                        ¡Postulación enviada con éxito!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Company Card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sobre la empresa</h3>
              <div className="flex items-center gap-4 mb-4">
                {job.company_logo ? (
                  <img
                    src={job.company_logo}
                    alt={job.company_name}
                    className="w-16 h-16 rounded-lg object-contain bg-gray-100"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-brand-light flex items-center justify-center">
                    <span className="text-2xl font-bold text-brand">
                      {job.company_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900">{job.company_name}</p>
                  <Link
                    href={`/company/${job.company_id}`}
                    className="text-sm text-brand hover:text-brand-hover transition-colors"
                  >
                    Ver perfil de empresa →
                  </Link>
                </div>
              </div>
              <Link
                href={`/?company=${job.company_id}`}
                className="block w-full text-center px-4 py-2 border border-gray-300 rounded-lg
                           text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Ver más ofertas de esta empresa
              </Link>
            </div>

            {/* Similar Jobs placeholder */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ofertas similares</h3>
              <p className="text-sm text-gray-500">
                Explora otras oportunidades que podrían interesarte.
              </p>
              <Link
                href="/"
                className="block mt-4 text-brand hover:text-brand-hover text-sm font-medium transition-colors"
              >
                Ver todas las ofertas →
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
