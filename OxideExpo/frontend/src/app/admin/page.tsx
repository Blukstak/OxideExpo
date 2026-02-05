'use client';

import { Card, CardHeader, CardTitle, CardContent, StatusBadge } from '@/components/ui';
import { StatsCard, StatsGrid } from '@/components/dashboard';
import Link from 'next/link';

// Mock data - in production this would come from the API
const mockStats = {
  totalUsers: 1247,
  totalCompanies: 89,
  totalJobs: 342,
  activeJobs: 156,
  pendingCompanies: 12,
  pendingJobs: 28,
  applicationsThisMonth: 1893,
  newUsersThisMonth: 234,
};

const mockPendingCompanies = [
  {
    id: '1',
    name: 'Innovatech SpA',
    rut: '76.543.210-1',
    email: 'contacto@innovatech.cl',
    submittedAt: '2026-02-04',
  },
  {
    id: '2',
    name: 'Green Solutions Ltda',
    rut: '76.987.654-3',
    email: 'info@greensolutions.cl',
    submittedAt: '2026-02-03',
  },
  {
    id: '3',
    name: 'Digital Masters SA',
    rut: '76.111.222-K',
    email: 'admin@digitalmasters.cl',
    submittedAt: '2026-02-02',
  },
];

const mockPendingJobs = [
  {
    id: '1',
    title: 'Senior Software Engineer',
    company: 'Tech Solutions SpA',
    submittedAt: '2026-02-04',
  },
  {
    id: '2',
    title: 'Product Designer',
    company: 'Creative Agency Ltda',
    submittedAt: '2026-02-04',
  },
  {
    id: '3',
    title: 'Marketing Manager',
    company: 'Global Marketing SA',
    submittedAt: '2026-02-03',
  },
];

const mockRecentActivity = [
  { id: '1', action: 'Nueva empresa registrada', entity: 'Innovatech SpA', time: 'Hace 2 horas', type: 'company' },
  { id: '2', action: 'Oferta aprobada', entity: 'Desarrollador Backend', time: 'Hace 3 horas', type: 'job' },
  { id: '3', action: 'Usuario verificado', entity: 'maria.gonzalez@email.com', time: 'Hace 4 horas', type: 'user' },
  { id: '4', action: 'Empresa rechazada', entity: 'Fake Corp', time: 'Hace 5 horas', type: 'company' },
  { id: '5', action: 'Nueva oferta creada', entity: 'Diseñador UX Senior', time: 'Hace 6 horas', type: 'job' },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Panel de Administración
        </h1>
        <p className="text-gray-500 mt-1">
          Resumen general del sistema y tareas pendientes.
        </p>
      </div>

      {/* Primary Stats */}
      <StatsGrid columns={4}>
        <StatsCard
          title="Usuarios Totales"
          value={mockStats.totalUsers.toLocaleString()}
          change={{ value: mockStats.newUsersThisMonth, type: 'increase' }}
          description="este mes"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
        <StatsCard
          title="Empresas"
          value={mockStats.totalCompanies}
          description={`${mockStats.pendingCompanies} pendientes`}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
        <StatsCard
          title="Ofertas Activas"
          value={mockStats.activeJobs}
          description={`${mockStats.pendingJobs} pendientes`}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatsCard
          title="Postulaciones"
          value={mockStats.applicationsThisMonth.toLocaleString()}
          change={{ value: 15, type: 'increase' }}
          description="este mes"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
      </StatsGrid>

      {/* Pending Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Companies */}
        <Card>
          <CardHeader
            actions={
              <Link href="/admin/companies?status=pending" className="text-sm text-brand hover:text-brand-hover">
                Ver todas
              </Link>
            }
          >
            <CardTitle>Empresas Pendientes ({mockStats.pendingCompanies})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockPendingCompanies.map((company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-100 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{company.name}</p>
                    <p className="text-sm text-gray-500">{company.rut}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-lg hover:bg-green-200 transition-colors">
                      Aprobar
                    </button>
                    <button className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors">
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
              {mockPendingCompanies.length === 0 && (
                <p className="text-gray-500 text-center py-4">No hay empresas pendientes</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Jobs */}
        <Card>
          <CardHeader
            actions={
              <Link href="/admin/jobs?status=pending" className="text-sm text-brand hover:text-brand-hover">
                Ver todas
              </Link>
            }
          >
            <CardTitle>Ofertas Pendientes ({mockStats.pendingJobs})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockPendingJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-100 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{job.title}</p>
                    <p className="text-sm text-gray-500">{job.company}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-lg hover:bg-green-200 transition-colors">
                      Aprobar
                    </button>
                    <button className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors">
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
              {mockPendingJobs.length === 0 && (
                <p className="text-gray-500 text-center py-4">No hay ofertas pendientes</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockRecentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    activity.type === 'company' ? 'bg-blue-100 text-blue-600' :
                    activity.type === 'job' ? 'bg-green-100 text-green-600' :
                    'bg-purple-100 text-purple-600'
                  }`}>
                    {activity.type === 'company' && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    )}
                    {activity.type === 'job' && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    )}
                    {activity.type === 'user' && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{activity.action}</p>
                    <p className="text-sm text-gray-500">{activity.entity}</p>
                  </div>
                </div>
                <span className="text-sm text-gray-400">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              href="/admin/users"
              className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Gestionar Usuarios</h4>
                <p className="text-sm text-gray-500">Ver y editar usuarios</p>
              </div>
            </Link>

            <Link
              href="/admin/companies"
              className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Gestionar Empresas</h4>
                <p className="text-sm text-gray-500">Aprobar y administrar</p>
              </div>
            </Link>

            <Link
              href="/admin/jobs"
              className="flex items-center gap-3 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Gestionar Ofertas</h4>
                <p className="text-sm text-gray-500">Aprobar y moderar</p>
              </div>
            </Link>

            <Link
              href="/admin/reports"
              className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Ver Reportes</h4>
                <p className="text-sm text-gray-500">Estadísticas y análisis</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
