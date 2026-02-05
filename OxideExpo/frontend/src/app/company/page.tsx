'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, StatusBadge } from '@/components/ui';
import { StatsCard, StatsGrid } from '@/components/dashboard';
import Link from 'next/link';

// Mock data - in production this would come from the API
const mockStats = {
  activeJobs: 5,
  totalApplications: 127,
  newApplications: 23,
  viewsThisMonth: 1543,
};

const mockRecentJobs = [
  {
    id: '1',
    title: 'Desarrollador Full Stack',
    status: 'active',
    applications: 45,
    views: 320,
    postedAt: '2026-01-15',
  },
  {
    id: '2',
    title: 'Diseñador UX/UI',
    status: 'active',
    applications: 32,
    views: 215,
    postedAt: '2026-01-20',
  },
  {
    id: '3',
    title: 'Product Manager',
    status: 'pending',
    applications: 0,
    views: 0,
    postedAt: '2026-02-01',
  },
];

const mockRecentApplications = [
  {
    id: '1',
    applicantName: 'María González',
    jobTitle: 'Desarrollador Full Stack',
    appliedAt: '2026-02-04',
    status: 'pending',
  },
  {
    id: '2',
    applicantName: 'Juan Pérez',
    jobTitle: 'Diseñador UX/UI',
    appliedAt: '2026-02-03',
    status: 'reviewed',
  },
  {
    id: '3',
    applicantName: 'Ana Silva',
    jobTitle: 'Desarrollador Full Stack',
    appliedAt: '2026-02-03',
    status: 'shortlisted',
  },
];

export default function CompanyDashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard de Empresa
          </h1>
          <p className="text-gray-500 mt-1">
            Bienvenido de vuelta. Aquí tienes un resumen de tu actividad.
          </p>
        </div>
        <Link href="/company/jobs/create" className="btn-primary">
          Crear Nueva Oferta
        </Link>
      </div>

      {/* Stats Grid */}
      <StatsGrid columns={4}>
        <StatsCard
          title="Ofertas Activas"
          value={mockStats.activeJobs}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatsCard
          title="Total Postulaciones"
          value={mockStats.totalApplications}
          change={{ value: 12, type: 'increase' }}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatsCard
          title="Nuevas Postulaciones"
          value={mockStats.newApplications}
          description="Esta semana"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
        <StatsCard
          title="Vistas Este Mes"
          value={mockStats.viewsThisMonth.toLocaleString()}
          change={{ value: 8, type: 'increase' }}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        />
      </StatsGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Jobs */}
        <Card>
          <CardHeader
            actions={
              <Link href="/company/jobs" className="text-sm text-brand hover:text-brand-hover">
                Ver todas
              </Link>
            }
          >
            <CardTitle>Ofertas Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockRecentJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/company/jobs/${job.id}`}
                      className="font-medium text-gray-900 hover:text-brand"
                    >
                      {job.title}
                    </Link>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span>{job.applications} postulaciones</span>
                      <span>{job.views} vistas</span>
                    </div>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Applications */}
        <Card>
          <CardHeader
            actions={
              <Link href="/company/jobs" className="text-sm text-brand hover:text-brand-hover">
                Ver todas
              </Link>
            }
          >
            <CardTitle>Postulaciones Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockRecentApplications.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{app.applicantName}</p>
                    <p className="text-sm text-gray-500">{app.jobTitle}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={app.status} />
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(app.appliedAt).toLocaleDateString('es-CL')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/company/jobs/create"
              className="flex items-center gap-4 p-4 bg-brand-light rounded-lg hover:bg-red-100 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-brand/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Nueva Oferta</h4>
                <p className="text-sm text-gray-500">Publica un empleo</p>
              </div>
            </Link>

            <Link
              href="/company/profile"
              className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Editar Perfil</h4>
                <p className="text-sm text-gray-500">Actualiza tu empresa</p>
              </div>
            </Link>

            <Link
              href="/company/team"
              className="flex items-center gap-4 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Gestionar Equipo</h4>
                <p className="text-sm text-gray-500">Invita colaboradores</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
