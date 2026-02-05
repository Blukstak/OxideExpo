'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi, type CreateLanguageData } from '@/lib/api';
import { Card, CardContent, Button, Modal, ModalFooter, Select } from '@/components/ui';
import { Breadcrumbs } from '@/components/dashboard';
import type { UserLanguage } from '@/types';

const proficiencyOptions = [
  { value: 'basic', label: 'Básico' },
  { value: 'intermediate', label: 'Intermedio' },
  { value: 'advanced', label: 'Avanzado' },
  { value: 'native', label: 'Nativo' },
];

// Mock languages for demonstration - in production these would come from the API
const availableLanguages = [
  { id: 'es', name: 'Español' },
  { id: 'en', name: 'Inglés' },
  { id: 'pt', name: 'Portugués' },
  { id: 'fr', name: 'Francés' },
  { id: 'de', name: 'Alemán' },
  { id: 'it', name: 'Italiano' },
  { id: 'zh', name: 'Chino Mandarín' },
  { id: 'ja', name: 'Japonés' },
  { id: 'ko', name: 'Coreano' },
  { id: 'ar', name: 'Árabe' },
  { id: 'ru', name: 'Ruso' },
];

export default function LanguagesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState<UserLanguage | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [selectedLanguageId, setSelectedLanguageId] = useState('');
  const [proficiency, setProficiency] = useState('intermediate');

  const { data: languages, isLoading } = useQuery({
    queryKey: ['languages'],
    queryFn: profileApi.listLanguages,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateLanguageData) => profileApi.createLanguage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['languages'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'full'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateLanguageData> }) =>
      profileApi.updateLanguage(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['languages'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'full'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => profileApi.deleteLanguage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['languages'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'full'] });
      setDeleteConfirmId(null);
    },
  });

  const openModal = (language?: UserLanguage) => {
    if (language) {
      setEditingLanguage(language);
      setSelectedLanguageId(language.language_id);
      setProficiency(language.proficiency);
    } else {
      setEditingLanguage(null);
      setSelectedLanguageId('');
      setProficiency('intermediate');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLanguage(null);
    setSelectedLanguageId('');
    setProficiency('intermediate');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: CreateLanguageData = {
      language_id: selectedLanguageId,
      proficiency,
    };

    if (editingLanguage) {
      updateMutation.mutate({ id: editingLanguage.id, data: { proficiency } });
    } else {
      createMutation.mutate(data);
    }
  };

  const getLanguageName = (languageId: string) => {
    return availableLanguages.find(l => l.id === languageId)?.name || languageId;
  };

  const getProficiencyLabel = (level: string) => {
    return proficiencyOptions.find(l => l.value === level)?.label || level;
  };

  const getProficiencyColor = (level: string) => {
    const colors = {
      basic: 'bg-gray-200 text-gray-700',
      intermediate: 'bg-blue-100 text-blue-700',
      advanced: 'bg-green-100 text-green-700',
      native: 'bg-brand-light text-brand',
    };
    return colors[level as keyof typeof colors] || 'bg-gray-200 text-gray-700';
  };

  // Filter out already added languages
  const addedLanguageIds = new Set(languages?.map(l => l.language_id) || []);
  const availableToAdd = availableLanguages.filter(l => !addedLanguageIds.has(l.id));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Perfil', href: '/profile' },
          { label: 'Idiomas' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Idiomas</h1>
          <p className="text-gray-500 mt-1">
            Indica los idiomas que dominas y tu nivel de competencia.
          </p>
        </div>
        <Button onClick={() => openModal()} disabled={availableToAdd.length === 0}>
          Agregar Idioma
        </Button>
      </div>

      {/* Languages List */}
      {(languages?.length ?? 0) > 0 ? (
        <Card>
          <CardContent>
            <div className="space-y-3">
              {languages?.map((language) => (
                <div
                  key={language.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{getLanguageName(language.language_id)}</h4>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${getProficiencyColor(language.proficiency)}`}>
                        {getProficiencyLabel(language.proficiency)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openModal(language)}
                      className="p-2 text-gray-400 hover:text-brand rounded-lg hover:bg-white transition-colors"
                      aria-label="Editar"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(language.id)}
                      className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-white transition-colors"
                      aria-label="Eliminar"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No tienes idiomas registrados
            </h3>
            <p className="text-gray-500 mb-4">
              Agrega los idiomas que dominas para ampliar tus oportunidades laborales.
            </p>
            <Button onClick={() => openModal()}>
              Agregar Primer Idioma
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingLanguage ? 'Editar Idioma' : 'Agregar Idioma'}
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {!editingLanguage && (
              <Select
                label="Idioma"
                options={availableToAdd.map(l => ({ value: l.id, label: l.name }))}
                placeholder="Selecciona un idioma"
                value={selectedLanguageId}
                onChange={(e) => setSelectedLanguageId(e.target.value)}
                required
              />
            )}

            {editingLanguage && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Idioma</label>
                <p className="text-gray-900">{getLanguageName(editingLanguage.language_id)}</p>
              </div>
            )}

            <Select
              label="Nivel de Competencia"
              options={proficiencyOptions}
              value={proficiency}
              onChange={(e) => setProficiency(e.target.value)}
              required
            />

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                <strong>Básico:</strong> Puedes comunicarte en situaciones simples.
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Intermedio:</strong> Puedes mantener conversaciones y escribir textos básicos.
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Avanzado:</strong> Dominas el idioma a nivel profesional.
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Nativo:</strong> Es tu lengua materna.
              </p>
            </div>
          </div>

          <ModalFooter>
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
              disabled={!editingLanguage && !selectedLanguageId}
            >
              {editingLanguage ? 'Guardar Cambios' : 'Agregar'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Eliminar Idioma"
        size="sm"
      >
        <p className="text-gray-600">
          ¿Estás seguro de que deseas eliminar este idioma? Esta acción no se puede deshacer.
        </p>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
            isLoading={deleteMutation.isPending}
          >
            Eliminar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
