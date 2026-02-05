'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { cn } from '@/lib/utils';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { openLogin, openRegister } = useAuthModal();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Determine user type and dashboard link
  const getDashboardLink = () => {
    if (!user) return '/';
    if (user.user_type === 'company') return '/company';
    if (user.user_type === 'admin') return '/admin';
    return '/profile';
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link
            href="/"
            className="text-2xl font-bold text-brand hover:text-brand-hover transition-colors"
          >
            Empleos Inclusivos
          </Link>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                {/* Main navigation links based on user type */}
                {user?.user_type === 'job_seeker' && (
                  <>
                    <Link
                      href="/"
                      className="px-3 py-2 text-gray-700 font-medium hover:text-brand transition-colors"
                    >
                      Empleos
                    </Link>
                    <Link
                      href="/my-applications"
                      className="px-3 py-2 text-gray-700 font-medium hover:text-brand transition-colors"
                    >
                      Mis Postulaciones
                    </Link>
                  </>
                )}

                {user?.user_type === 'company' && (
                  <>
                    <Link
                      href="/company"
                      className="px-3 py-2 text-gray-700 font-medium hover:text-brand transition-colors"
                    >
                      Panel
                    </Link>
                    <Link
                      href="/company/jobs"
                      className="px-3 py-2 text-gray-700 font-medium hover:text-brand transition-colors"
                    >
                      Mis Empleos
                    </Link>
                  </>
                )}

                {user?.user_type === 'admin' && (
                  <>
                    <Link
                      href="/admin"
                      className="px-3 py-2 text-gray-700 font-medium hover:text-brand transition-colors"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/admin/companies"
                      className="px-3 py-2 text-gray-700 font-medium hover:text-brand transition-colors"
                    >
                      Empresas
                    </Link>
                  </>
                )}

                {/* User dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 px-3 py-2 text-gray-700 font-medium
                               hover:text-brand transition-colors rounded-lg hover:bg-gray-50"
                  >
                    <span className="w-8 h-8 rounded-full bg-brand-light text-brand
                                     flex items-center justify-center text-sm font-semibold">
                      {user?.first_name?.charAt(0).toUpperCase()}
                    </span>
                    <span className="hidden sm:block">{user?.first_name}</span>
                    <svg
                      className={cn('w-4 h-4 transition-transform', showUserMenu && 'rotate-180')}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showUserMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowUserMenu(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg
                                      border border-gray-200 py-1 z-20">
                        <Link
                          href={getDashboardLink()}
                          onClick={() => setShowUserMenu(false)}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Mi Perfil
                        </Link>
                        {user?.user_type === 'job_seeker' && (
                          <Link
                            href="/profile/settings"
                            onClick={() => setShowUserMenu(false)}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Configuración
                          </Link>
                        )}
                        {user?.user_type === 'company' && (
                          <Link
                            href="/company/settings"
                            onClick={() => setShowUserMenu(false)}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Configuración
                          </Link>
                        )}
                        <hr className="my-1 border-gray-200" />
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            logout();
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                        >
                          Cerrar Sesión
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={openLogin}
                  className="px-4 py-2 text-gray-700 font-medium hover:text-brand transition-colors"
                >
                  Iniciar Sesión
                </button>
                <button
                  onClick={openRegister}
                  className="px-4 py-2 bg-brand text-white font-medium rounded-lg
                             hover:bg-brand-hover transition-colors
                             focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
                >
                  Registrarse
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
