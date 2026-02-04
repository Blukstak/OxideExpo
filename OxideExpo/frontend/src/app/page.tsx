'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { jobsApi } from '@/lib/api';
import { Navbar } from '@/components/Navbar';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

export default function HomePage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['jobs', page, search],
    queryFn: () => jobsApi.list({ page, per_page: 20, search: search || undefined }),
  });

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Ofertas Laborales Inclusivas</h1>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Buscar ofertas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-96 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {isLoading && <p>Cargando ofertas...</p>}
        {error && <p className="text-red-600">Error al cargar ofertas</p>}

        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="border rounded-lg p-6 hover:shadow-lg transition cursor-pointer bg-white"
                >
                  <h2 className="text-xl font-semibold mb-2 text-gray-900">{job.title}</h2>
                  <p className="text-gray-600 mb-2">{job.company_name}</p>
                  {job.region_name && (
                    <p className="text-sm text-gray-500 mb-2">📍 {job.region_name}</p>
                  )}
                  {job.salary_min && job.salary_max && (
                    <p className="text-sm font-medium text-green-600">
                      {formatCurrency(job.salary_min)} - {formatCurrency(job.salary_max)}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mt-2">
                    {job.vacancies} {job.vacancies === 1 ? 'vacante' : 'vacantes'}
                  </p>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {data.total_pages > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                {Array.from({ length: data.total_pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-4 py-2 rounded ${
                      p === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
