'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Modal, ModalFooter, StatusBadge, Select, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { Breadcrumbs } from '@/components/dashboard';
import { Pagination } from '@/components/ui/Table';

// Mock data
const mockCompanies = [
  {
    id: '1',
    name: 'Tech Solutions SpA',
    rut: '76.123.456-7',
    email: 'contacto@techsolutions.cl',
    industry: 'Tecnología',
    size: '51-200',
    status: 'approved',
    activeJobs: 5,
    totalApplications: 127,
    createdAt: '2025-06-15',
    approvedAt: '2025-06-18',
  },
  {
    id: '2',
    name: 'Innovatech SpA',
    rut: '76.543.210-1',
    email: 'contacto@innovatech.cl',
    industry: 'Tecnología',
    size: '11-50',
    status: 'pending',
    activeJobs: 0,
    totalApplications: 0,
    createdAt: '2026-02-04',
    approvedAt: null,
  },
  {
    id: '3',
    name: 'Green Solutions Ltda',
    rut: '76.987.654-3',
    email: 'info@greensolutions.cl',
    industry: 'Sustentabilidad',
    size: '1-10',
    status: 'pending',
    activeJobs: 0,
    totalApplications: 0,
    createdAt: '2026-02-03',
    approvedAt: null,
  },
  {
    id: '4',
    name: 'Marketing Global SA',
    rut: '76.111.222-K',
    email: 'admin@marketingglobal.cl',
    industry: 'Marketing',
    size: '201-500',
    status: 'approved',
    activeJobs: 3,
    totalApplications: 89,
    createdAt: '2025-08-10',
    approvedAt: '2025-08-12',
  },
  {
    id: '5',
    name: 'Fake Corp',
    rut: '76.000.000-0',
    email: 'fake@fakecorp.cl',
    industry: 'Otro',
    size: '1-10',
    status: 'rejected',
    activeJobs: 0,
    totalApplications: 0,
    createdAt: '2026-01-15',
    approvedAt: null,
  },
];

const industryOptions = [
  { value: '', label: 'Todas las industrias' },
  { value: 'Tecnología', label: 'Tecnología' },
  { value: 'Finanzas', label: 'Finanzas' },
  { value: 'Salud', label: 'Salud' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Sustentabilidad', label: 'Sustentabilidad' },
];

type Company = typeof mockCompanies[0];

export default function AdminCompaniesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [companyToAction, setCompanyToAction] = useState<Company | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const filteredCompanies = mockCompanies.filter((company) => {
    const matchesSearch =
      company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.rut.includes(searchQuery) ||
      company.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesIndustry = !industryFilter || company.industry === industryFilter;
    const matchesTab = activeTab === 'all' || company.status === activeTab;
    return matchesSearch && matchesIndustry && matchesTab;
  });

  const pendingCount = mockCompanies.filter(c => c.status === 'pending').length;
  const approvedCount = mockCompanies.filter(c => c.status === 'approved').length;
  const rejectedCount = mockCompanies.filter(c => c.status === 'rejected').length;

  const handleApprove = () => {
    // In production, this would call the API
    console.log('Approving company:', companyToAction?.name);
    setShowApproveModal(false);
    setCompanyToAction(null);
  };

  const handleReject = () => {
    // In production, this would call the API
    console.log('Rejecting company:', companyToAction?.name, 'Reason:', rejectionReason);
    setShowRejectModal(false);
    setCompanyToAction(null);
    setRejectionReason('');
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Empresas' },
        ]}
      />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Empresas</h1>
          <p className="text-gray-500 mt-1">
            Administra y aprueba las empresas registradas en la plataforma.
          </p>
        </div>
        <Button variant="secondary">
          Exportar Excel
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" value={activeTab} onChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Todas ({mockCompanies.length})</TabsTrigger>
          <TabsTrigger value="pending">Pendientes ({pendingCount})</TabsTrigger>
          <TabsTrigger value="approved">Aprobadas ({approvedCount})</TabsTrigger>
          <TabsTrigger value="rejected">Rechazadas ({rejectedCount})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  placeholder="Buscar por nombre, RUT o email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  }
                />
                <Select
                  options={industryOptions}
                  value={industryFilter}
                  onChange={(e) => setIndustryFilter(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Companies Table */}
          <Card>
            <CardHeader>
              <CardTitle>Empresas ({filteredCompanies.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Empresa</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">RUT</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Industria</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Tamaño</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Estado</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Ofertas</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Registro</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map((company) => (
                      <tr key={company.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{company.name}</p>
                            <p className="text-sm text-gray-500">{company.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{company.rut}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{company.industry}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{company.size}</td>
                        <td className="py-3 px-4">
                          <StatusBadge status={company.status} />
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{company.activeJobs}</td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {new Date(company.createdAt).toLocaleDateString('es-CL')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedCompany(company)}
                              className="p-2 text-gray-400 hover:text-brand rounded-lg hover:bg-gray-100 transition-colors"
                              aria-label="Ver detalles"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            {company.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => {
                                    setCompanyToAction(company);
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
                                    setCompanyToAction(company);
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
                  totalPages={Math.ceil(filteredCompanies.length / 10)}
                  onPageChange={setCurrentPage}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Company Details Modal */}
      <Modal
        isOpen={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
        title="Detalles de la Empresa"
        size="lg"
      >
        {selectedCompany && (
          <>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedCompany.name}</h3>
                  <p className="text-gray-500">{selectedCompany.email}</p>
                  <StatusBadge status={selectedCompany.status} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-gray-500">RUT</p>
                  <p className="font-medium">{selectedCompany.rut}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Industria</p>
                  <p className="font-medium">{selectedCompany.industry}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tamaño</p>
                  <p className="font-medium">{selectedCompany.size} empleados</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fecha de Registro</p>
                  <p className="font-medium">
                    {new Date(selectedCompany.createdAt).toLocaleDateString('es-CL')}
                  </p>
                </div>
                {selectedCompany.approvedAt && (
                  <div>
                    <p className="text-sm text-gray-500">Fecha de Aprobación</p>
                    <p className="font-medium">
                      {new Date(selectedCompany.approvedAt).toLocaleDateString('es-CL')}
                    </p>
                  </div>
                )}
              </div>

              {selectedCompany.status === 'approved' && (
                <div className="pt-4 border-t">
                  <h4 className="font-medium text-gray-900 mb-3">Estadísticas</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{selectedCompany.activeJobs}</p>
                      <p className="text-sm text-blue-700">Ofertas Activas</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{selectedCompany.totalApplications}</p>
                      <p className="text-sm text-green-700">Postulaciones Recibidas</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <ModalFooter>
              <Button variant="secondary" onClick={() => setSelectedCompany(null)}>
                Cerrar
              </Button>
              {selectedCompany.status === 'pending' && (
                <>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setCompanyToAction(selectedCompany);
                      setSelectedCompany(null);
                      setShowRejectModal(true);
                    }}
                  >
                    Rechazar
                  </Button>
                  <Button
                    onClick={() => {
                      setCompanyToAction(selectedCompany);
                      setSelectedCompany(null);
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
          setCompanyToAction(null);
        }}
        title="Aprobar Empresa"
        size="sm"
      >
        {companyToAction && (
          <>
            <p className="text-gray-600">
              ¿Estás seguro de que deseas aprobar a <strong>{companyToAction.name}</strong>?
              La empresa podrá comenzar a publicar ofertas de empleo.
            </p>

            <ModalFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowApproveModal(false);
                  setCompanyToAction(null);
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleApprove}>
                Aprobar Empresa
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
          setCompanyToAction(null);
          setRejectionReason('');
        }}
        title="Rechazar Empresa"
        size="md"
      >
        {companyToAction && (
          <>
            <div className="space-y-4">
              <p className="text-gray-600">
                ¿Estás seguro de que deseas rechazar a <strong>{companyToAction.name}</strong>?
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
                  setCompanyToAction(null);
                  setRejectionReason('');
                }}
              >
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleReject} disabled={!rejectionReason.trim()}>
                Rechazar Empresa
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
