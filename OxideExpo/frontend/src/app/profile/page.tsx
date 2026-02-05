'use client';

import { useQuery } from '@tanstack/react-query';
import { profileApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileProgress } from '@/components/dashboard';
import { Card, CardHeader, CardTitle, CardContent, StatusBadge } from '@/components/ui';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

export default function ProfileDashboard() {
  const { user } = useAuth();

  const { data: fullProfile, isLoading, error } = useQuery({
    queryKey: ['profile', 'full'],
    queryFn: profileApi.getFullProfile,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Error al cargar el perfil</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 text-brand hover:text-brand-hover"
        >
          Intentar de nuevo
        </button>
      </div>
    );
  }

  const profile = fullProfile?.profile;
  const completeness = profile?.completeness_percentage ?? 0;

  // Calculate profile sections for the progress component
  const profileSections = [
    {
      id: 'personal',
      name: 'Información Personal',
      href: '/profile/personal-info',
      completed: Boolean(profile?.phone && profile?.date_of_birth),
      weight: 20,
    },
    {
      id: 'bio',
      name: 'Presentación Profesional',
      href: '/profile/personal-info',
      completed: Boolean(profile?.bio && profile?.professional_headline),
      weight: 15,
    },
    {
      id: 'experience',
      name: 'Experiencia Laboral',
      href: '/profile/work-experience',
      completed: (fullProfile?.experience?.length ?? 0) > 0,
      weight: 25,
    },
    {
      id: 'education',
      name: 'Educación',
      href: '/profile/education',
      completed: (fullProfile?.education?.length ?? 0) > 0,
      weight: 20,
    },
    {
      id: 'skills',
      name: 'Habilidades',
      href: '/profile/skills',
      completed: (fullProfile?.skills?.length ?? 0) > 0,
      weight: 10,
    },
    {
      id: 'languages',
      name: 'Idiomas',
      href: '/profile/languages',
      completed: (fullProfile?.languages?.length ?? 0) > 0,
      weight: 5,
    },
    {
      id: 'cv',
      name: 'Currículum (CV)',
      href: '/profile/cv',
      completed: Boolean(profile?.cv_url),
      weight: 5,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bienvenido, {user?.first_name}
          </h1>
          <p className="text-gray-500 mt-1">
            Gestiona tu perfil profesional y aumenta tus posibilidades de empleo.
          </p>
        </div>
        <Link
          href="/my-applications"
          className="btn-primary"
        >
          Ver mis postulaciones
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>Tu Perfil</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-6">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {profile?.profile_image_url ? (
                    <img
                      src={profile.profile_image_url}
                      alt="Foto de perfil"
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-3xl font-bold text-gray-400">
                        {user?.first_name?.[0]}{user?.last_name?.[0]}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {user?.first_name} {user?.last_name}
                  </h2>
                  {profile?.professional_headline && (
                    <p className="text-brand font-medium mt-1">
                      {profile.professional_headline}
                    </p>
                  )}
                  <p className="text-gray-500 mt-1">{user?.email}</p>

                  {profile?.bio && (
                    <p className="text-gray-600 mt-3 line-clamp-2">{profile.bio}</p>
                  )}

                  <div className="flex items-center gap-4 mt-4">
                    <Link
                      href="/profile/personal-info"
                      className="text-brand hover:text-brand-hover text-sm font-medium"
                    >
                      Editar perfil
                    </Link>
                    {profile?.cv_url && (
                      <a
                        href={profile.cv_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                      >
                        Ver CV
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Experience */}
          <Card>
            <CardHeader
              actions={
                <Link
                  href="/profile/work-experience"
                  className="text-sm text-brand hover:text-brand-hover"
                >
                  Ver todo
                </Link>
              }
            >
              <CardTitle>Experiencia Laboral</CardTitle>
            </CardHeader>
            <CardContent>
              {(fullProfile?.experience?.length ?? 0) > 0 ? (
                <div className="space-y-4">
                  {fullProfile?.experience?.slice(0, 3).map((exp) => (
                    <div
                      key={exp.id}
                      className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900">{exp.position_title}</h4>
                        <p className="text-sm text-gray-500">{exp.company_name}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(exp.start_date)} - {exp.is_current ? 'Presente' : exp.end_date ? formatDate(exp.end_date) : ''}
                        </p>
                      </div>
                      {exp.is_current && <StatusBadge status="active" />}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-500 mb-3">No has agregado experiencia laboral</p>
                  <Link href="/profile/work-experience" className="btn-primary text-sm">
                    Agregar experiencia
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Education */}
          <Card>
            <CardHeader
              actions={
                <Link
                  href="/profile/education"
                  className="text-sm text-brand hover:text-brand-hover"
                >
                  Ver todo
                </Link>
              }
            >
              <CardTitle>Educación</CardTitle>
            </CardHeader>
            <CardContent>
              {(fullProfile?.education?.length ?? 0) > 0 ? (
                <div className="space-y-4">
                  {fullProfile?.education?.slice(0, 3).map((edu) => (
                    <div
                      key={edu.id}
                      className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900">
                          {edu.degree_title || edu.field_of_study_name || 'Educación'}
                        </h4>
                        <p className="text-sm text-gray-500">{edu.institution_name}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(edu.start_date)} - {edu.end_date ? formatDate(edu.end_date) : 'En curso'}
                        </p>
                      </div>
                      <StatusBadge status={edu.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-500 mb-3">No has agregado educación</p>
                  <Link href="/profile/education" className="btn-primary text-sm">
                    Agregar educación
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Profile Completeness */}
          <ProfileProgress sections={profileSections} />

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Experiencias</span>
                  <span className="font-semibold">{fullProfile?.experience?.length ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Educación</span>
                  <span className="font-semibold">{fullProfile?.education?.length ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Habilidades</span>
                  <span className="font-semibold">{fullProfile?.skills?.length ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Idiomas</span>
                  <span className="font-semibold">{fullProfile?.languages?.length ?? 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Skills Preview */}
          {(fullProfile?.skills?.length ?? 0) > 0 && (
            <Card>
              <CardHeader
                actions={
                  <Link
                    href="/profile/skills"
                    className="text-sm text-brand hover:text-brand-hover"
                  >
                    Editar
                  </Link>
                }
              >
                <CardTitle>Habilidades</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {fullProfile?.skills?.slice(0, 8).map((skill) => (
                    <span
                      key={skill.id}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {skill.skill_id}
                    </span>
                  ))}
                  {(fullProfile?.skills?.length ?? 0) > 8 && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-sm">
                      +{(fullProfile?.skills?.length ?? 0) - 8} más
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
