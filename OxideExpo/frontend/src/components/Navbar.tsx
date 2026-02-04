'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <nav className="bg-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold">
            Empleos Inclusivos
          </Link>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <span className="text-sm">
                  Hola, {user?.first_name}
                </span>
                <Link
                  href="/my-applications"
                  className="px-4 py-2 bg-blue-700 rounded hover:bg-blue-800 transition"
                >
                  Mis Postulaciones
                </Link>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-red-600 rounded hover:bg-red-700 transition"
                >
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 bg-blue-700 rounded hover:bg-blue-800 transition"
                >
                  Iniciar Sesión
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 transition"
                >
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
