'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { applicationsApi } from '@/lib/api';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { formatDate } from '@/lib/utils';

export default function MyApplicationsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  const { data: applications, isLoading, error } = useQuery({
    queryKey: ['my-applications'],
    queryFn: applicationsApi.myApplications,
    enabled: isAuthenticated,
  });

  if (authLoading || isLoading) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 py-8">Cargando...</div>
      </>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-gray-900">Mis Postulaciones</h1>

        {error && (
          <p className="text-red-600">Error al cargar postulaciones</p>
        )}

        {applications && applications.length === 0 && (
          <p className="text-gray-600">No tienes postulaciones todavía.</p>
        )}

        {applications && applications.length > 0 && (
          <div className="space-y-4">
            {applications.map((app) => (
              <div key={app.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      Postulado el: {formatDate(app.applied_at)}
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      Oferta ID: {app.job_id}
                    </p>
                    {app.cover_letter && (
                      <p className="text-sm text-gray-700 mt-2">
                        {app.cover_letter.substring(0, 150)}...
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      app.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : app.status === 'reviewed'
                        ? 'bg-blue-100 text-blue-800'
                        : app.status === 'accepted'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {app.status === 'pending' && 'Pendiente'}
                    {app.status === 'reviewed' && 'Revisado'}
                    {app.status === 'accepted' && 'Aceptado'}
                    {app.status === 'rejected' && 'Rechazado'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
