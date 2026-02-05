import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import type { JobWithCompany } from '@/types';

interface JobCardProps {
  job: JobWithCompany;
}

export function JobCard({ job }: JobCardProps) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-6
                 hover:shadow-lg hover:border-l-4 hover:border-l-brand
                 transition-all duration-200
                 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
    >
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        {job.title}
      </h2>
      <p className="text-gray-700 font-medium mb-3">
        {job.company_name}
      </p>

      <div className="space-y-2">
        {job.region_name && (
          <p className="text-sm text-gray-600 flex items-center gap-1">
            <span aria-hidden="true">📍</span>
            <span>{job.region_name}</span>
          </p>
        )}

        {job.salary_min && job.salary_max && (
          <p className="text-sm font-semibold text-green-700">
            {formatCurrency(job.salary_min)} - {formatCurrency(job.salary_max)}
          </p>
        )}

        <p className="text-sm text-gray-600">
          {job.vacancies} {job.vacancies === 1 ? 'vacante' : 'vacantes'}
        </p>
      </div>
    </Link>
  );
}
