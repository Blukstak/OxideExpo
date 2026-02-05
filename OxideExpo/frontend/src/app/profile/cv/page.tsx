'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { profileApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent, Button, FileUpload } from '@/components/ui';
import { Breadcrumbs } from '@/components/dashboard';
import { formatDate } from '@/lib/utils';

export default function CVPage() {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: profileApi.getProfile,
  });

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      // In a real implementation, this would upload to the backend
      // For now, we'll simulate the upload
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Refresh profile data
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'full'] });
      setFiles([]);
    } catch {
      setUploadError('Error al subir el archivo. Intenta de nuevo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar tu CV?')) return;

    try {
      // In a real implementation, this would call the delete endpoint
      await new Promise(resolve => setTimeout(resolve, 500));

      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'full'] });
    } catch {
      setUploadError('Error al eliminar el CV. Intenta de nuevo.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Perfil', href: '/profile' },
          { label: 'Currículum' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Currículum Vitae</h1>
        <p className="text-gray-500 mt-1">
          Sube tu CV en formato PDF para que los empleadores puedan conocerte mejor.
        </p>
      </div>

      {/* Current CV */}
      {profile?.cv_url && (
        <Card>
          <CardHeader>
            <CardTitle>CV Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Mi CV</h4>
                  <p className="text-sm text-gray-500">
                    Subido el {formatDate(profile.updated_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={profile.cv_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-sm"
                >
                  Ver CV
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Eliminar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload New CV */}
      <Card>
        <CardHeader>
          <CardTitle>{profile?.cv_url ? 'Actualizar CV' : 'Subir CV'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUpload
            accept=".pdf"
            maxSize={5 * 1024 * 1024} // 5MB
            onChange={setFiles}
            value={files}
            error={uploadError || undefined}
            hint="Solo archivos PDF. Máximo 5MB."
            onError={setUploadError}
          />

          {files.length > 0 && (
            <div className="flex justify-end">
              <Button
                onClick={handleUpload}
                isLoading={isUploading}
              >
                {profile?.cv_url ? 'Actualizar CV' : 'Subir CV'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Consejos para tu CV</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-600">
                Mantén tu CV actualizado con tu información más reciente.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-600">
                Usa un diseño limpio y profesional que sea fácil de leer.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-600">
                Incluye palabras clave relevantes para el tipo de trabajo que buscas.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-600">
                Destaca tus logros con números y resultados concretos.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-600">
                Revisa la ortografía y gramática antes de subir el documento.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
