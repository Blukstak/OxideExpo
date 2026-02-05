'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Modal, ModalFooter, StatusBadge, Select, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { Breadcrumbs } from '@/components/dashboard';
import { Pagination } from '@/components/ui/Table';
import Link from 'next/link';

// Mock data
const mockJobs = [
  {
    id: '1',
    title: 'Desarrollador Full Stack',
    companyId: '1',
    companyName: 'Tech Solutions SpA',
    employmentType: 'full_time',
    salaryMin: 1500000,
    salaryMax: 2500000,
    status: 'active',
    applications: 45,
    views: 320,
    createdAt: '2026-01-15',
    publishedAt: '2026-01-16',
  },
  {
    id: '2',
    title: 'Senior Software Engineer',
    companyId: '1',
    companyName: 'Tech Solutions SpA',
    employmentType: 'full_time',
    salaryMin: 2500000,
    salaryMax: 4000000,
    status: 'pending',
    applications: 0,
    views: 0,
    createdAt: '2026-02-04',
    publishedAt: null,
  },
  {
    id: '3',
    title: 'Product Designer',
    companyId: '2',
    companyName: 'Creative Agency Ltda',
    employmentType: 'full_time',
    salaryMin: 1200000,
    salaryMax: 1800000,
    status: 'pending',
    applications: 0,
    views: 0,
    createdAt: '2026-02-04',
    publishedAt: null,
  },
  {
    id: '4',
    title: 'Marketing Manager',
    companyId: '3',
    companyName: 'Global Marketing SA',
    employmentType: 'full_time',
    salaryMin: 2000000,
    salaryMax: 3000000,
    status: 'active',
    applications: 28,
    views: 156,
    createdAt: '2026-01-20',
    publishedAt: '2026-01-21',
  },
  {
    id: '5',
    title: 'Práctica Profesional IT',
    companyId: '1',
    companyName: 'Tech Solutions SpA',
    employmentType: 'internship',
    salaryMin: 400000,
    salaryMax: 500000,
    status: 'closed',
    applications: 67,
    views: 450,
    createdAt: '2025-11-01',
    publishedAt: '2025-11-02',
  },
  {
    id: '6',
    title: 'Contador Part-Time',
    companyId: '4',
    companyName: 'Contadores Asociados',
    employmentType: 'part_time',
    salaryMin: 600000,
    salaryMax: 800000,
    status: 'rejected',
    applications: 0,
    views: 0,
    createdAt: '2026-01-28',
    publishedAt: null,
  },
];

const employmentTypeLabels: Record<string, string> = {
  full_time: 'Tiempo Completo',
  part_time: 'Medio Tiempo',
  contract: 'Contrato',
  temporary: 'Temporal',
  internship: 'Práctica',
  volunteer: 'Voluntariado',
};

const statusLabels: Record<string, string> = {
  active: 'Activa',
  pending: 'Pendiente',
  closed: 'Cerrada',
  rejected: 'Rechazada',
  draft: 'Borrador',
};

type Job = typeof mockJobs[0];

export default function AdminJobsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [jobToAction, setJobToAction] = useState<Job | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const filteredJobs = mockJobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.companyName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || job.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const pendingCount = mockJobs.filter(j => j.status === 'pending').length;
  const activeCount = mockJobs.filter(j => j.status === 'active').length;
  const closedCount = mockJobs.filter(j => j.status === 'closed').length;
  const rejectedCount = mockJobs.filter(j => j.status === 'rejected').length;

  const formatSalary = (min: number, max: number) => {
    const format = (n: number) => `$${(n / 1000000).toFixed(1)}M`;
    return `${format(min)} - ${format(max)}`;
  };

  const handleApprove = () => {
    // In production, this would call the API
    console.log('Approving job:', jobToAction?.title);
    setShowApproveModal(false);
    setJobToAction(null);
  };

  const handleReject = () => {
    // In production, this would call the API
    console.log('Rejecting job:', jobToAction?.title, 'Reason:', rejectionReason);
    setShowRejectModal(false);
    setJobToAction(null);
    setRejectionReason('');
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Ofertas' },
        ]}
      />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Ofertas</h1>
          <p className="text-gray-500 mt-1">
            Administra y modera las ofertas de empleo publicadas.
          </p>
        </div>
        <Button variant="secondary">
          Exportar Excel
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" value={activeTab} onChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Todas ({mockJobs.length})</TabsTrigger>
          <TabsTrigger value="pending">Pendientes ({pendingCount})</TabsTrigger>
          <TabsTrigger value="active">Activas ({activeCount})</TabsTrigger>
          <TabsTrigger value="closed">Cerradas ({closedCount})</TabsTrigger>
          <TabsTrigger value="rejected">Rechazadas ({rejectedCount})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  placeholder="Buscar por título o empresa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Jobs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Ofertas ({filteredJobs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Oferta</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Empresa</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Tipo</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Salario</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Estado</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Postulaciones</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Fecha</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map((job) => (
                      <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900">{job.title}</p>
                        </td>
                        <td className="py-3 px-4">
                          <Link
                            href={`/admin/companies/${job.companyId}`}
                            className="text-brand hover:text-brand-hover"
                          >
                            {job.companyName}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {employmentTypeLabels[job.employmentType]}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {formatSalary(job.salaryMin, job.salaryMax)}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={job.status} />
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {job.applications}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {new Date(job.createdAt).toLocaleDateString('es-CL')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedJob(job)}
                              className="p-2 text-gray-400 hover:text-brand rounded-lg hover:bg-gray-100 transition-colors"
                              aria-label="Ver detalles"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            {job.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => {
                                    setJobToAction(job);
                                    setShowApproveModal(true);
                                  }}
                                  className="p-2 text-gray-400 hover:text-green-500 rounded-lg hover:bg-gray-100 transition-colors"
                                  aria-label="Aprobar"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => {
                                    setJobToAction(job);
                                    setShowRejectModal(true);
                                  }}
                                  className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 transition-colors"
                                  aria-label="Rechazar"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(filteredJobs.length / 10)}
                  onPageChange={setCurrentPage}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Job Details Modal */}
      <Modal
        isOpen={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        title="Detalles de la Oferta"
        size="lg"
      >
        {selectedJob && (
          <>
            <div className="space-y-6">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selectedJob.title}</h3>
                    <p className="text-brand">{selectedJob.companyName}</p>
                  </div>
                  <StatusBadge status={selectedJob.status} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-gray-500">Tipo de Empleo</p>
                  <p className="font-medium">{employmentTypeLabels[selectedJob.employmentType]}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Rango Salarial</p>
                  <p className="font-medium">{formatSalary(selectedJob.salaryMin, selectedJob.salaryMax)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fecha de Creación</p>
                  <p className="font-medium">
                    {new Date(selectedJob.createdAt).toLocaleDateString('es-CL')}
                  </p>
                </div>
                {selectedJob.publishedAt && (
                  <div>
                    <p className="text-sm text-gray-500">Fecha de Publicación</p>
                    <p className="font-medium">
                      {new Date(selectedJob.publishedAt).toLocaleDateString('es-CL')}
                    </p>
                  </div>
                )}
              </div>

              {selectedJob.status === 'active' && (
                <div className="pt-4 border-t">
                  <h4 className="font-medium text-gray-900 mb-3">Estadísticas</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{selectedJob.applications}</p>
                      <p className="text-sm text-blue-700">Postulaciones</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{selectedJob.views}</p>
                      <p className="text-sm text-green-700">Vistas</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <Link
                  href={`/jobs/${selectedJob.id}`}
                  target="_blank"
                  className="text-brand hover:text-brand-hover flex items-center gap-1"
                >
                  Ver oferta pública
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </Link>
              </div>
            </div>

            <ModalFooter>
              <Button variant="secondary" onClick={() => setSelectedJob(null)}>
                Cerrar
              </Button>
              {selectedJob.status === 'pending' && (
                <>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setJobToAction(selectedJob);
                      setSelectedJob(null);
                      setShowRejectModal(true);
                    }}
                  >
                    Rechazar
                  </Button>
                  <Button
                    onClick={() => {
                      setJobToAction(selectedJob);
                      setSelectedJob(null);
                      setShowApproveModal(true);
                    }}
                  >
                    Aprobar
                  </Button>
                </>
              )}
            </ModalFooter>
          </>
        )}
      </Modal>

      {/* Approve Confirmation Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => {
          setShowApproveModal(false);
          setJobToAction(null);
        }}
        title="Aprobar Oferta"
        size="sm"
      >
        {jobToAction && (
          <>
            <p className="text-gray-600">
              ¿Estás seguro de que deseas aprobar la oferta <strong>{jobToAction.title}</strong>?
              Será publicada y visible para los postulantes.
            </p>

            <ModalFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowApproveModal(false);
                  setJobToAction(null);
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleApprove}>
                Aprobar Oferta
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>

      {/* Reject Confirmation Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setJobToAction(null);
          setRejectionReason('');
        }}
        title="Rechazar Oferta"
        size="md"
      >
        {jobToAction && (
          <>
            <div className="space-y-4">
              <p className="text-gray-600">
                ¿Estás seguro de que deseas rechazar la oferta <strong>{jobToAction.title}</strong>?
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo del rechazo
                </label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ingresa el motivo del rechazo..."
                />
              </div>
            </div>

            <ModalFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowRejectModal(false);
                  setJobToAction(null);
                  setRejectionReason('');
                }}
              >
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleReject} disabled={!rejectionReason.trim()}>
                Rechazar Oferta
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
