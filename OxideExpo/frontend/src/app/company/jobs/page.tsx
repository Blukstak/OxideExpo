'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, Button, StatusBadge, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { Breadcrumbs } from '@/components/dashboard';
import { formatDate } from '@/lib/utils';

// Mock data - in production this would come from the API
const mockJobs = [
  {
    id: '1',
    title: 'Desarrollador Full Stack',
    status: 'active',
    applications: 45,
    newApplications: 5,
    views: 320,
    createdAt: '2026-01-15',
    expiresAt: '2026-03-15',
  },
  {
    id: '2',
    title: 'Diseñador UX/UI',
    status: 'active',
    applications: 32,
    newApplications: 3,
    views: 215,
    createdAt: '2026-01-20',
    expiresAt: '2026-03-20',
  },
  {
    id: '3',
    title: 'Product Manager',
    status: 'pending',
    applications: 0,
    newApplications: 0,
    views: 0,
    createdAt: '2026-02-01',
    expiresAt: '2026-04-01',
  },
  {
    id: '4',
    title: 'Data Analyst',
    status: 'draft',
    applications: 0,
    newApplications: 0,
    views: 0,
    createdAt: '2026-02-04',
    expiresAt: null,
  },
  {
    id: '5',
    title: 'Marketing Specialist',
    status: 'closed',
    applications: 67,
    newApplications: 0,
    views: 890,
    createdAt: '2025-11-01',
    expiresAt: '2026-01-01',
  },
];

export default function CompanyJobsPage() {
  const [activeTab, setActiveTab] = useState('all');

  const filterJobs = (status: string) => {
    if (status === 'all') return mockJobs;
    return mockJobs.filter((job) => job.status === status);
  };

  const JobCard = ({ job }: { job: typeof mockJobs[0] }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <Link
                href={`/company/jobs/${job.id}`}
                className="text-lg font-semibold text-gray-900 hover:text-brand"
              >
                {job.title}
              </Link>
              <StatusBadge status={job.status} />
            </div>

            <div className="flex items-center gap-6 mt-3 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{job.applications} postulaciones</span>
                {job.newApplications > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-brand text-white text-xs rounded-full">
                    +{job.newApplications}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>{job.views} vistas</span>
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Publicado {formatDate(job.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {job.applications > 0 && (
              <Link
                href={`/company/jobs/${job.id}/applicants`}
                className="btn-secondary text-sm"
              >
                Ver Postulantes
              </Link>
            )}
            <Link href={`/company/jobs/${job.id}/edit`}>
              <Button variant="ghost" size="sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/company' },
          { label: 'Mis Ofertas' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Ofertas de Empleo</h1>
          <p className="text-gray-500 mt-1">
            Gestiona tus publicaciones de empleo y revisa las postulaciones.
          </p>
        </div>
        <Link href="/company/jobs/create" className="btn-primary">
          Nueva Oferta
        </Link>
      </div>

      <Tabs defaultValue="all" value={activeTab} onChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            Todas ({mockJobs.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Activas ({filterJobs('active').length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pendientes ({filterJobs('pending').length})
          </TabsTrigger>
          <TabsTrigger value="draft">
            Borradores ({filterJobs('draft').length})
          </TabsTrigger>
          <TabsTrigger value="closed">
            Cerradas ({filterJobs('closed').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {mockJobs.length > 0 ? (
            <div className="space-y-4">
              {mockJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </TabsContent>

        <TabsContent value="active">
          {filterJobs('active').length > 0 ? (
            <div className="space-y-4">
              {filterJobs('active').map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </TabsContent>

        <TabsContent value="pending">
          {filterJobs('pending').length > 0 ? (
            <div className="space-y-4">
              {filterJobs('pending').map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <EmptyState message="No tienes ofertas pendientes de aprobación." />
          )}
        </TabsContent>

        <TabsContent value="draft">
          {filterJobs('draft').length > 0 ? (
            <div className="space-y-4">
              {filterJobs('draft').map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <EmptyState message="No tienes borradores guardados." />
          )}
        </TabsContent>

        <TabsContent value="closed">
          {filterJobs('closed').length > 0 ? (
            <div className="space-y-4">
              {filterJobs('closed').map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <EmptyState message="No tienes ofertas cerradas." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ message = 'No tienes ofertas de empleo publicadas.' }: { message?: string }) {
  return (
    <Card>
      <CardContent className="text-center py-12">
        <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{message}</h3>
        <p className="text-gray-500 mb-4">
          Comienza a publicar empleos para atraer candidatos.
        </p>
        <Link href="/company/jobs/create" className="btn-primary">
          Crear Primera Oferta
        </Link>
      </CardContent>
    </Card>
  );
}
