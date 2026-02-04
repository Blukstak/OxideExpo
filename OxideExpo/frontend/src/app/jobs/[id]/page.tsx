'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { jobsApi, applicationsApi } from '@/lib/api';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useState } from 'react';

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [coverLetter, setCoverLetter] = useState('');
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  const jobId = Number(params.id);

  const { data: job, isLoading, error } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => jobsApi.get(jobId),
  });

  const applyMutation = useMutation({
    mutationFn: applicationsApi.create,
    onSuccess: () => {
      alert('¡Postulación enviada con éxito!');
      setShowApplicationForm(false);
      setCoverLetter('');
    },
  });

  const handleApply = () => {
    if (!isAuthenticated) {
      router.push('/login');
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

  if (isLoading) return <><Navbar /><div className="container mx-auto px-4 py-8">Cargando...</div></>;
  if (error) return <><Navbar /><div className="container mx-auto px-4 py-8 text-red-600">Error al cargar la oferta</div></>;
  if (!job) return <><Navbar /><div className="container mx-auto px-4 py-8">Oferta no encontrada</div></>;

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold mb-4 text-gray-900">{job.title}</h1>
          <p className="text-xl text-gray-600 mb-4">{job.company_name}</p>

          {job.region_name && (
            <p className="text-gray-600 mb-2">📍 {job.region_name}</p>
          )}

          {job.category_name && (
            <p className="text-gray-600 mb-4">🏷️ {job.category_name}</p>
          )}

          {job.salary_min && job.salary_max && (
            <p className="text-xl font-semibold text-green-600 mb-4">
              {formatCurrency(job.salary_min)} - {formatCurrency(job.salary_max)}
            </p>
          )}

          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-2 text-gray-900">Descripción</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
          </div>

          {job.requirements && (
            <div className="mb-6">
              <h2 className="text-2xl font-semibold mb-2 text-gray-900">Requisitos</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{job.requirements}</p>
            </div>
          )}

          {job.benefits && (
            <div className="mb-6">
              <h2 className="text-2xl font-semibold mb-2 text-gray-900">Beneficios</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{job.benefits}</p>
            </div>
          )}

          <div className="flex gap-4 items-center">
            <p className="text-sm text-gray-600">
              {job.vacancies} {job.vacancies === 1 ? 'vacante' : 'vacantes'}
            </p>
            {job.application_deadline && (
              <p className="text-sm text-gray-600">
                Fecha límite: {formatDate(job.application_deadline)}
              </p>
            )}
          </div>

          {!showApplicationForm ? (
            <button
              onClick={handleApply}
              className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-lg font-semibold"
            >
              Postular a esta oferta
            </button>
          ) : (
            <div className="mt-6 p-6 bg-gray-50 rounded-lg">
              <h3 className="text-xl font-semibold mb-4 text-gray-900">Carta de Presentación (Opcional)</h3>
              <textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg h-40 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="Escribe tu carta de presentación aquí..."
              />
              <div className="flex gap-4 mt-4">
                <button
                  onClick={handleSubmitApplication}
                  disabled={applyMutation.isPending}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {applyMutation.isPending ? 'Enviando...' : 'Enviar Postulación'}
                </button>
                <button
                  onClick={() => setShowApplicationForm(false)}
                  className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition"
                >
                  Cancelar
                </button>
              </div>
              {applyMutation.isError && (
                <p className="text-red-500 text-sm mt-2">
                  Error al enviar postulación. Puede que ya hayas postulado a esta oferta.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
