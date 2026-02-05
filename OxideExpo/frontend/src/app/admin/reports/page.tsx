'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Select, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { Breadcrumbs, StatsCard, StatsGrid } from '@/components/dashboard';

// Mock data for reports
const mockOverviewStats = {
  totalUsers: 1247,
  totalCompanies: 89,
  totalJobs: 342,
  totalApplications: 4521,
  newUsersThisMonth: 234,
  newCompaniesThisMonth: 12,
  newJobsThisMonth: 87,
  newApplicationsThisMonth: 892,
};

const mockMonthlyData = [
  { month: 'Sep 2025', users: 890, companies: 52, jobs: 198, applications: 2340 },
  { month: 'Oct 2025', users: 945, companies: 61, jobs: 231, applications: 2890 },
  { month: 'Nov 2025', users: 1023, companies: 69, jobs: 267, applications: 3210 },
  { month: 'Dic 2025', users: 1089, companies: 74, jobs: 298, applications: 3650 },
  { month: 'Ene 2026', users: 1156, companies: 82, jobs: 324, applications: 4120 },
  { month: 'Feb 2026', users: 1247, companies: 89, jobs: 342, applications: 4521 },
];

const mockTopCompanies = [
  { name: 'Tech Solutions SpA', jobs: 15, applications: 456, hires: 12 },
  { name: 'Global Marketing SA', jobs: 12, applications: 312, hires: 8 },
  { name: 'Digital Innovations', jobs: 10, applications: 289, hires: 6 },
  { name: 'Creative Agency Ltda', jobs: 8, applications: 234, hires: 5 },
  { name: 'Data Systems SA', jobs: 7, applications: 198, hires: 4 },
];

const mockTopJobs = [
  { title: 'Desarrollador Full Stack', company: 'Tech Solutions SpA', applications: 89, views: 450 },
  { title: 'Product Designer', company: 'Creative Agency Ltda', applications: 67, views: 380 },
  { title: 'Marketing Manager', company: 'Global Marketing SA', applications: 54, views: 320 },
  { title: 'Data Analyst', company: 'Data Systems SA', applications: 48, views: 290 },
  { title: 'DevOps Engineer', company: 'Tech Solutions SpA', applications: 42, views: 265 },
];

const mockIndustryDistribution = [
  { industry: 'Tecnología', companies: 32, jobs: 145, percentage: 42 },
  { industry: 'Marketing', companies: 18, jobs: 67, percentage: 20 },
  { industry: 'Finanzas', companies: 15, jobs: 52, percentage: 15 },
  { industry: 'Salud', companies: 12, jobs: 43, percentage: 13 },
  { industry: 'Educación', companies: 8, jobs: 23, percentage: 7 },
  { industry: 'Otros', companies: 4, jobs: 12, percentage: 3 },
];

const periodOptions = [
  { value: 'week', label: 'Última semana' },
  { value: 'month', label: 'Último mes' },
  { value: 'quarter', label: 'Último trimestre' },
  { value: 'year', label: 'Último año' },
  { value: 'all', label: 'Todo el tiempo' },
];

export default function AdminReportsPage() {
  const [period, setPeriod] = useState('month');
  const [activeTab, setActiveTab] = useState('overview');

  const handleExport = (reportType: string) => {
    // In production, this would generate and download the report
    console.log('Exporting report:', reportType, 'Period:', period);
    alert(`Descargando reporte de ${reportType}...`);
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Reportes' },
        ]}
      />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes y Estadísticas</h1>
          <p className="text-gray-500 mt-1">
            Analiza el rendimiento y las métricas de la plataforma.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            options={periodOptions}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
          <Button variant="secondary" onClick={() => handleExport('completo')}>
            Exportar Todo
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" value={activeTab} onChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="jobs">Ofertas</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="space-y-6">
            {/* Main Stats */}
            <StatsGrid columns={4}>
              <StatsCard
                title="Usuarios Totales"
                value={mockOverviewStats.totalUsers.toLocaleString()}
                change={{ value: mockOverviewStats.newUsersThisMonth, type: 'increase' }}
                description="este mes"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                }
              />
              <StatsCard
                title="Empresas"
                value={mockOverviewStats.totalCompanies}
                change={{ value: mockOverviewStats.newCompaniesThisMonth, type: 'increase' }}
                description="este mes"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
              />
              <StatsCard
                title="Ofertas Publicadas"
                value={mockOverviewStats.totalJobs}
                change={{ value: mockOverviewStats.newJobsThisMonth, type: 'increase' }}
                description="este mes"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
              />
              <StatsCard
                title="Postulaciones"
                value={mockOverviewStats.totalApplications.toLocaleString()}
                change={{ value: mockOverviewStats.newApplicationsThisMonth, type: 'increase' }}
                description="este mes"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
              />
            </StatsGrid>

            {/* Growth Chart Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle>Crecimiento Mensual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-gray-500">Gráfico de crecimiento mensual</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Integrar librería de gráficos (Chart.js, Recharts, etc.)
                    </p>
                  </div>
                </div>
                {/* Data table fallback */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 text-gray-500">Mes</th>
                        <th className="text-right py-2 px-3 text-gray-500">Usuarios</th>
                        <th className="text-right py-2 px-3 text-gray-500">Empresas</th>
                        <th className="text-right py-2 px-3 text-gray-500">Ofertas</th>
                        <th className="text-right py-2 px-3 text-gray-500">Postulaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockMonthlyData.map((row) => (
                        <tr key={row.month} className="border-b border-gray-100">
                          <td className="py-2 px-3 font-medium">{row.month}</td>
                          <td className="py-2 px-3 text-right">{row.users}</td>
                          <td className="py-2 px-3 text-right">{row.companies}</td>
                          <td className="py-2 px-3 text-right">{row.jobs}</td>
                          <td className="py-2 px-3 text-right">{row.applications}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Top Performers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader
                  actions={
                    <Button variant="ghost" size="sm" onClick={() => handleExport('empresas')}>
                      Exportar
                    </Button>
                  }
                >
                  <CardTitle>Top Empresas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockTopCompanies.map((company, index) => (
                      <div
                        key={company.name}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </span>
                          <span className="font-medium text-gray-900">{company.name}</span>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-gray-900">{company.jobs} ofertas</p>
                          <p className="text-gray-500">{company.applications} postulaciones</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader
                  actions={
                    <Button variant="ghost" size="sm" onClick={() => handleExport('ofertas')}>
                      Exportar
                    </Button>
                  }
                >
                  <CardTitle>Ofertas Más Populares</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockTopJobs.map((job, index) => (
                      <div
                        key={job.title}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-medium text-gray-900">{job.title}</p>
                            <p className="text-sm text-gray-500">{job.company}</p>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-gray-900">{job.applications} postulaciones</p>
                          <p className="text-gray-500">{job.views} vistas</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <div className="space-y-6">
            <StatsGrid columns={3}>
              <StatsCard
                title="Usuarios Activos"
                value="892"
                description="últimos 30 días"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                }
              />
              <StatsCard
                title="Tasa de Conversión"
                value="23.5%"
                description="postulaciones/visitas"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                }
              />
              <StatsCard
                title="Perfiles Completos"
                value="67%"
                description="con >80% completitud"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
            </StatsGrid>

            <Card>
              <CardHeader
                actions={
                  <Button variant="secondary" onClick={() => handleExport('usuarios')}>
                    Exportar Usuarios
                  </Button>
                }
              >
                <CardTitle>Reporte de Usuarios</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>Reportes detallados de usuarios disponibles para exportar</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Industria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockIndustryDistribution.map((item) => (
                    <div key={item.industry}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{item.industry}</span>
                        <span className="text-sm text-gray-500">
                          {item.companies} empresas • {item.jobs} ofertas
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-brand h-2 rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                actions={
                  <Button variant="secondary" onClick={() => handleExport('empresas')}>
                    Exportar Empresas
                  </Button>
                }
              >
                <CardTitle>Reporte de Empresas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <p>Reportes detallados de empresas disponibles para exportar</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Jobs Tab */}
        <TabsContent value="jobs">
          <div className="space-y-6">
            <StatsGrid columns={3}>
              <StatsCard
                title="Tiempo Promedio Activa"
                value="21 días"
                description="antes de cerrar"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <StatsCard
                title="Postulaciones Promedio"
                value="13.2"
                description="por oferta"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
              />
              <StatsCard
                title="Tasa de Contratación"
                value="8.4%"
                description="ofertas con contratación"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
            </StatsGrid>

            <Card>
              <CardHeader
                actions={
                  <Button variant="secondary" onClick={() => handleExport('ofertas')}>
                    Exportar Ofertas
                  </Button>
                }
              >
                <CardTitle>Reporte de Ofertas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <p>Reportes detallados de ofertas disponibles para exportar</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
