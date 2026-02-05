'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Button, StatusBadge, Modal, ModalFooter, Tabs, TabsList, TabsTrigger, TabsContent, Select, Textarea } from '@/components/ui';
import { Breadcrumbs } from '@/components/dashboard';
import { formatDate } from '@/lib/utils';

// Mock data
const mockJob = {
  id: '1',
  title: 'Desarrollador Full Stack',
  status: 'active',
};

const mockApplicants = [
  {
    id: '1',
    name: 'María González',
    email: 'maria@example.com',
    phone: '+56 9 1234 5678',
    appliedAt: '2026-02-04',
    status: 'pending',
    coverLetter: 'Soy una desarrolladora con 5 años de experiencia...',
    cvUrl: '/cv/maria.pdf',
    matchScore: 85,
  },
  {
    id: '2',
    name: 'Juan Pérez',
    email: 'juan@example.com',
    phone: '+56 9 8765 4321',
    appliedAt: '2026-02-03',
    status: 'reviewed',
    coverLetter: 'Me interesa mucho esta posición porque...',
    cvUrl: '/cv/juan.pdf',
    matchScore: 72,
  },
  {
    id: '3',
    name: 'Ana Silva',
    email: 'ana@example.com',
    phone: '+56 9 5555 5555',
    appliedAt: '2026-02-03',
    status: 'shortlisted',
    coverLetter: 'Con mi experiencia en desarrollo web...',
    cvUrl: '/cv/ana.pdf',
    matchScore: 91,
  },
  {
    id: '4',
    name: 'Carlos Rodríguez',
    email: 'carlos@example.com',
    phone: '+56 9 4444 4444',
    appliedAt: '2026-02-02',
    status: 'rejected',
    coverLetter: 'Estoy buscando nuevas oportunidades...',
    cvUrl: '/cv/carlos.pdf',
    matchScore: 45,
  },
];

const statusOptions = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'reviewed', label: 'Revisado' },
  { value: 'shortlisted', label: 'Preseleccionado' },
  { value: 'interview_scheduled', label: 'Entrevista Agendada' },
  { value: 'offer_extended', label: 'Oferta Enviada' },
  { value: 'hired', label: 'Contratado' },
  { value: 'rejected', label: 'Rechazado' },
];

type Applicant = typeof mockApplicants[0];

export default function JobApplicantsPage() {
  const params = useParams();
  const [activeTab, setActiveTab] = useState('all');
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');

  const filterApplicants = (status: string) => {
    if (status === 'all') return mockApplicants;
    return mockApplicants.filter((a) => a.status === status);
  };

  const handleStatusChange = () => {
    // In production, this would call the API
    console.log('Changing status to:', newStatus, 'Note:', statusNote);
    setShowStatusModal(false);
    setNewStatus('');
    setStatusNote('');
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const ApplicantCard = ({ applicant }: { applicant: Applicant }) => (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedApplicant(applicant)}>
      <CardContent>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-lg font-bold text-gray-500">
                {applicant.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{applicant.name}</h3>
              <p className="text-sm text-gray-500">{applicant.email}</p>
              <p className="text-sm text-gray-400 mt-1">
                Postulado el {formatDate(applicant.appliedAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`px-2.5 py-1 rounded-full text-sm font-medium ${getMatchScoreColor(applicant.matchScore)}`}>
              {applicant.matchScore}% match
            </div>
            <StatusBadge status={applicant.status} />
          </div>
        </div>

        {applicant.coverLetter && (
          <p className="mt-3 text-sm text-gray-600 line-clamp-2">
            {applicant.coverLetter}
          </p>
        )}

        <div className="flex items-center gap-3 mt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              window.open(applicant.cvUrl, '_blank');
            }}
          >
            Ver CV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedApplicant(applicant);
              setNewStatus(applicant.status);
              setShowStatusModal(true);
            }}
          >
            Cambiar Estado
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/company' },
          { label: 'Mis Ofertas', href: '/company/jobs' },
          { label: mockJob.title, href: `/company/jobs/${params.id}` },
          { label: 'Postulantes' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Postulantes</h1>
          <p className="text-gray-500 mt-1">
            {mockJob.title} - {mockApplicants.length} postulantes
          </p>
        </div>
        <Button variant="secondary">
          Exportar a Excel
        </Button>
      </div>

      <Tabs defaultValue="all" value={activeTab} onChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            Todos ({mockApplicants.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pendientes ({filterApplicants('pending').length})
          </TabsTrigger>
          <TabsTrigger value="shortlisted">
            Preseleccionados ({filterApplicants('shortlisted').length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rechazados ({filterApplicants('rejected').length})
          </TabsTrigger>
        </TabsList>

        {['all', 'pending', 'shortlisted', 'rejected'].map((tab) => (
          <TabsContent key={tab} value={tab}>
            {filterApplicants(tab).length > 0 ? (
              <div className="space-y-4">
                {filterApplicants(tab).map((applicant) => (
                  <ApplicantCard key={applicant.id} applicant={applicant} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-gray-500">No hay postulantes en esta categoría.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Applicant Detail Modal */}
      <Modal
        isOpen={!!selectedApplicant && !showStatusModal}
        onClose={() => setSelectedApplicant(null)}
        title="Detalle del Postulante"
        size="lg"
      >
        {selectedApplicant && (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-500">
                  {selectedApplicant.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900">{selectedApplicant.name}</h3>
                <p className="text-gray-500">{selectedApplicant.email}</p>
                <p className="text-gray-500">{selectedApplicant.phone}</p>
                <div className="flex items-center gap-3 mt-2">
                  <StatusBadge status={selectedApplicant.status} />
                  <span className={`px-2.5 py-1 rounded-full text-sm font-medium ${getMatchScoreColor(selectedApplicant.matchScore)}`}>
                    {selectedApplicant.matchScore}% match
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Carta de Presentación</h4>
              <p className="text-gray-600 bg-gray-50 p-4 rounded-lg">
                {selectedApplicant.coverLetter || 'No proporcionada'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => window.open(selectedApplicant.cvUrl, '_blank')}
              >
                Ver CV Completo
              </Button>
              <Button
                onClick={() => {
                  setNewStatus(selectedApplicant.status);
                  setShowStatusModal(true);
                }}
              >
                Cambiar Estado
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Change Status Modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setNewStatus('');
          setStatusNote('');
        }}
        title="Cambiar Estado"
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Nuevo Estado"
            options={statusOptions}
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
          />

          <Textarea
            label="Nota (opcional)"
            placeholder="Agrega una nota sobre este cambio de estado..."
            rows={3}
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
          />
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowStatusModal(false)}>
            Cancelar
          </Button>
          <Button onClick={handleStatusChange}>
            Guardar Cambio
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
