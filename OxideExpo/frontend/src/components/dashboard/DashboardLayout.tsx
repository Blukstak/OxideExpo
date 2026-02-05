'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export interface SidebarItem {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: string | number;
}

export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

interface DashboardLayoutProps {
  children: ReactNode;
  sections: SidebarSection[];
  title?: string;
  headerActions?: ReactNode;
}

export function DashboardLayout({
  children,
  sections,
  title,
  headerActions,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <Sidebar sections={sections} />

        {/* Main content */}
        <main className="flex-1 ml-64">
          {/* Header */}
          {(title || headerActions) && (
            <header className="bg-white border-b border-gray-200 px-8 py-6">
              <div className="flex items-center justify-between">
                {title && (
                  <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                )}
                {headerActions && (
                  <div className="flex items-center gap-4">{headerActions}</div>
                )}
              </div>
            </header>
          )}

          {/* Content */}
          <div className="p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

interface SidebarProps {
  sections: SidebarSection[];
}

function Sidebar({ sections }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 overflow-y-auto">
      {/* Logo */}
      <div className="px-6 py-4 border-b border-gray-200">
        <Link
          href="/"
          className="text-xl font-bold text-brand hover:text-brand-hover transition-colors"
        >
          Empleos Inclusivos
        </Link>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-6">
        {sections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            {section.title && (
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {section.title}
              </h3>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                        isActive
                          ? 'bg-brand-light text-brand font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge !== undefined && (
                        <span
                          className={cn(
                            'px-2 py-0.5 text-xs font-medium rounded-full',
                            isActive
                              ? 'bg-brand text-white'
                              : 'bg-gray-200 text-gray-600'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

// Breadcrumbs component
interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav className={cn('flex items-center gap-2 text-sm', className)} aria-label="Breadcrumb">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && (
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-900 font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
