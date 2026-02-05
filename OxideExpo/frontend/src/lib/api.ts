import axios from 'axios';
import type {
  AuthResponse,
  JobListResponse,
  JobWithCompany,
  JobApplication,
  JobSeekerProfile,
  JobSeekerDisability,
  EducationRecord,
  WorkExperience,
  UserSkill,
  UserLanguage,
  PortfolioItem,
  FullProfileResponse,
  Skill,
  Language,
  Region,
  Municipality,
  // Company types
  CompanyProfile,
  CompanyMember,
  CompanyMemberWithUser,
  FullCompanyProfileResponse,
  CompanyDashboard,
  CompanyJob,
  JobApplicant,
  // Admin types
  AdminDashboardStats,
  UserListItem,
  UserDetail,
  PaginatedResponse,
  AdminAuditLog,
  UserTrendsReport,
  CompanyTrendsReport,
  JobTrendsReport,
  ApplicationTrendsReport,
} from '@/types';
import type { RegisterFormData, LoginFormData, ApplicationFormData, JobFiltersData } from './schemas';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api',
  withCredentials: false,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export const authApi = {
  register: async (data: RegisterFormData): Promise<AuthResponse> => {
    // Transform Spanish field names to English for backend compatibility
    const backendData = {
      email: data.email,
      password: data.password,
      first_name: data.nombre,
      last_name: data.apellidos,
    };
    const response = await api.post<AuthResponse>('/auth/register', backendData);
    return response.data;
  },

  login: async (data: LoginFormData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  loginCompany: async (data: LoginFormData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login/company', data);
    return response.data;
  },

  me: async (): Promise<AuthResponse['user']> => {
    const response = await api.get<AuthResponse['user']>('/auth/me');
    return response.data;
  },

  forgotPassword: async (email: string): Promise<void> => {
    await api.post('/auth/forgot-password', { email });
  },

  resetPassword: async (token: string, password: string): Promise<void> => {
    await api.post('/auth/reset-password', { token, password });
  },
};

export const jobsApi = {
  list: async (filters: JobFiltersData = {}): Promise<JobListResponse> => {
    const response = await api.get<JobListResponse>('/jobs', { params: filters });
    return response.data;
  },

  get: async (id: string): Promise<JobWithCompany> => {
    const response = await api.get<JobWithCompany>(`/jobs/${id}`);
    return response.data;
  },
};

export const applicationsApi = {
  create: async (data: ApplicationFormData): Promise<JobApplication> => {
    const response = await api.post<JobApplication>('/applications', data);
    return response.data;
  },

  myApplications: async (): Promise<JobApplication[]> => {
    const response = await api.get<JobApplication[]>('/applications/my');
    return response.data;
  },
};

// ============================================================================
// PROFILE API
// ============================================================================

export interface UpdateProfileData {
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  marital_status?: string;
  nationality?: string;
  national_id?: string;
  region_id?: string;
  municipality_id?: string;
  address?: string;
  bio?: string;
  professional_headline?: string;
}

export interface UpdateDisabilityData {
  category: string;
  description?: string;
  has_disability_certificate: boolean;
  disability_percentage?: number;
  requires_accommodations: boolean;
  accommodation_details?: string;
}

export interface CreateEducationData {
  institution_id?: string;
  institution_name: string;
  level: string;
  field_of_study_id?: string;
  field_of_study_name?: string;
  degree_title?: string;
  status: string;
  start_date: string;
  end_date?: string;
  description?: string;
  achievements?: string;
}

export interface CreateExperienceData {
  company_name: string;
  industry_id?: string;
  position_title: string;
  work_area_id?: string;
  position_level_id?: string;
  employment_type?: string;
  is_current: boolean;
  start_date: string;
  end_date?: string;
  region_id?: string;
  municipality_id?: string;
  description?: string;
  achievements?: string;
}

export interface CreateSkillData {
  skill_id: string;
  proficiency_level: number;
  years_of_experience?: number;
}

export interface CreateLanguageData {
  language_id: string;
  proficiency: string;
}

export interface CreatePortfolioData {
  title: string;
  description?: string;
  url?: string;
  file_url?: string;
  category?: string;
  completion_date?: string;
}

export const profileApi = {
  // Profile
  getProfile: async (): Promise<JobSeekerProfile> => {
    const response = await api.get<JobSeekerProfile>('/me/profile');
    return response.data;
  },

  updateProfile: async (data: UpdateProfileData): Promise<JobSeekerProfile> => {
    const response = await api.put<JobSeekerProfile>('/me/profile', data);
    return response.data;
  },

  getFullProfile: async (): Promise<FullProfileResponse> => {
    const response = await api.get<FullProfileResponse>('/me/profile/full');
    return response.data;
  },

  // Disability
  getDisability: async (): Promise<JobSeekerDisability | null> => {
    const response = await api.get<JobSeekerDisability | null>('/me/disability');
    return response.data;
  },

  updateDisability: async (data: UpdateDisabilityData): Promise<JobSeekerDisability> => {
    const response = await api.put<JobSeekerDisability>('/me/disability', data);
    return response.data;
  },

  // Education
  listEducation: async (): Promise<EducationRecord[]> => {
    const response = await api.get<EducationRecord[]>('/me/education');
    return response.data;
  },

  createEducation: async (data: CreateEducationData): Promise<EducationRecord> => {
    const response = await api.post<EducationRecord>('/me/education', data);
    return response.data;
  },

  updateEducation: async (id: string, data: Partial<CreateEducationData>): Promise<EducationRecord> => {
    const response = await api.put<EducationRecord>(`/me/education/${id}`, data);
    return response.data;
  },

  deleteEducation: async (id: string): Promise<void> => {
    await api.delete(`/me/education/${id}`);
  },

  // Work Experience
  listExperience: async (): Promise<WorkExperience[]> => {
    const response = await api.get<WorkExperience[]>('/me/experience');
    return response.data;
  },

  createExperience: async (data: CreateExperienceData): Promise<WorkExperience> => {
    const response = await api.post<WorkExperience>('/me/experience', data);
    return response.data;
  },

  updateExperience: async (id: string, data: Partial<CreateExperienceData>): Promise<WorkExperience> => {
    const response = await api.put<WorkExperience>(`/me/experience/${id}`, data);
    return response.data;
  },

  deleteExperience: async (id: string): Promise<void> => {
    await api.delete(`/me/experience/${id}`);
  },

  // Skills
  listSkills: async (): Promise<UserSkill[]> => {
    const response = await api.get<UserSkill[]>('/me/skills');
    return response.data;
  },

  createSkill: async (data: CreateSkillData): Promise<UserSkill> => {
    const response = await api.post<UserSkill>('/me/skills', data);
    return response.data;
  },

  updateSkill: async (id: string, data: Partial<CreateSkillData>): Promise<UserSkill> => {
    const response = await api.put<UserSkill>(`/me/skills/${id}`, data);
    return response.data;
  },

  deleteSkill: async (id: string): Promise<void> => {
    await api.delete(`/me/skills/${id}`);
  },

  // Languages
  listLanguages: async (): Promise<UserLanguage[]> => {
    const response = await api.get<UserLanguage[]>('/me/languages');
    return response.data;
  },

  createLanguage: async (data: CreateLanguageData): Promise<UserLanguage> => {
    const response = await api.post<UserLanguage>('/me/languages', data);
    return response.data;
  },

  updateLanguage: async (id: string, data: Partial<CreateLanguageData>): Promise<UserLanguage> => {
    const response = await api.put<UserLanguage>(`/me/languages/${id}`, data);
    return response.data;
  },

  deleteLanguage: async (id: string): Promise<void> => {
    await api.delete(`/me/languages/${id}`);
  },

  // Portfolio
  listPortfolio: async (): Promise<PortfolioItem[]> => {
    const response = await api.get<PortfolioItem[]>('/me/portfolio');
    return response.data;
  },

  createPortfolio: async (data: CreatePortfolioData): Promise<PortfolioItem> => {
    const response = await api.post<PortfolioItem>('/me/portfolio', data);
    return response.data;
  },

  updatePortfolio: async (id: string, data: Partial<CreatePortfolioData>): Promise<PortfolioItem> => {
    const response = await api.put<PortfolioItem>(`/me/portfolio/${id}`, data);
    return response.data;
  },

  deletePortfolio: async (id: string): Promise<void> => {
    await api.delete(`/me/portfolio/${id}`);
  },
};

// ============================================================================
// REFERENCE DATA API
// ============================================================================

export const referenceApi = {
  getSkills: async (): Promise<Skill[]> => {
    const response = await api.get<Skill[]>('/reference/skills');
    return response.data;
  },

  getLanguages: async (): Promise<Language[]> => {
    const response = await api.get<Language[]>('/reference/languages');
    return response.data;
  },

  getRegions: async (): Promise<Region[]> => {
    const response = await api.get<Region[]>('/reference/regions');
    return response.data;
  },

  getMunicipalities: async (regionId: string): Promise<Municipality[]> => {
    const response = await api.get<Municipality[]>(`/reference/regions/${regionId}/municipalities`);
    return response.data;
  },
};

// ============================================================================
// COMPANY API
// ============================================================================

export interface UpdateCompanyProfileData {
  company_name?: string;
  legal_name?: string;
  tax_id?: string;
  industry_id?: string;
  company_size?: string;
  founded_year?: number;
  region_id?: string;
  municipality_id?: string;
  address?: string;
  phone?: string;
  website_url?: string;
  linkedin_url?: string;
  video_url?: string;
  logo_url?: string;
  cover_image_url?: string;
  description?: string;
  mission?: string;
  vision?: string;
  culture?: string;
  benefits?: string;
}

export interface UpdateMemberData {
  role?: string;
  job_title?: string;
  is_active?: boolean;
}

export interface CreateJobData {
  title: string;
  description: string;
  responsibilities?: string;
  job_type: string;
  work_modality?: string;
  work_schedule?: string;
  region_id?: string;
  municipality_id?: string;
  is_remote_allowed?: boolean;
  education_level?: string;
  years_experience_min?: number;
  years_experience_max?: number;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  salary_period?: string;
  benefits?: string;
  application_deadline?: string;
  contact_email?: string;
  vacancies?: number;
}

export interface UpdateApplicantStatusData {
  status: string;
  rejection_reason?: string;
}

export const companyApi = {
  // Profile
  getProfile: async (): Promise<CompanyProfile> => {
    const response = await api.get<CompanyProfile>('/me/company/profile');
    return response.data;
  },

  updateProfile: async (data: UpdateCompanyProfileData): Promise<CompanyProfile> => {
    const response = await api.put<CompanyProfile>('/me/company/profile', data);
    return response.data;
  },

  getFullProfile: async (): Promise<FullCompanyProfileResponse> => {
    const response = await api.get<FullCompanyProfileResponse>('/me/company/full');
    return response.data;
  },

  // Dashboard
  getDashboard: async (): Promise<CompanyDashboard> => {
    const response = await api.get<CompanyDashboard>('/me/company/dashboard');
    return response.data;
  },

  // Members
  listMembers: async (): Promise<CompanyMemberWithUser[]> => {
    const response = await api.get<CompanyMemberWithUser[]>('/me/company/members');
    return response.data;
  },

  updateMember: async (memberId: string, data: UpdateMemberData): Promise<CompanyMember> => {
    const response = await api.put<CompanyMember>(`/me/company/members/${memberId}`, data);
    return response.data;
  },

  removeMember: async (memberId: string): Promise<void> => {
    await api.delete(`/me/company/members/${memberId}`);
  },

  // Jobs
  listJobs: async (params?: { status?: string }): Promise<CompanyJob[]> => {
    const response = await api.get<CompanyJob[]>('/me/company/jobs', { params });
    return response.data;
  },

  getJob: async (jobId: string): Promise<CompanyJob> => {
    const response = await api.get<CompanyJob>(`/me/company/jobs/${jobId}`);
    return response.data;
  },

  createJob: async (data: CreateJobData): Promise<CompanyJob> => {
    const response = await api.post<CompanyJob>('/me/company/jobs', data);
    return response.data;
  },

  updateJob: async (jobId: string, data: Partial<CreateJobData>): Promise<CompanyJob> => {
    const response = await api.put<CompanyJob>(`/me/company/jobs/${jobId}`, data);
    return response.data;
  },

  deleteJob: async (jobId: string): Promise<void> => {
    await api.delete(`/me/company/jobs/${jobId}`);
  },

  // Applicants
  listApplicants: async (jobId: string): Promise<JobApplicant[]> => {
    const response = await api.get<JobApplicant[]>(`/me/company/jobs/${jobId}/applicants`);
    return response.data;
  },

  updateApplicantStatus: async (
    jobId: string,
    applicantId: string,
    data: UpdateApplicantStatusData
  ): Promise<JobApplicant> => {
    const response = await api.patch<JobApplicant>(
      `/me/company/jobs/${jobId}/applicants/${applicantId}/status`,
      data
    );
    return response.data;
  },

  addApplicantComment: async (
    jobId: string,
    applicantId: string,
    comment: string
  ): Promise<void> => {
    await api.post(`/me/company/jobs/${jobId}/applicants/${applicantId}/comments`, { comment });
  },
};

// ============================================================================
// ADMIN API
// ============================================================================

export interface UserFilterParams {
  user_type?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface UpdateUserStatusData {
  status: string;
  reason?: string;
}

export interface ApproveCompanyData {
  approval_notes?: string;
}

export interface RejectCompanyData {
  rejection_reason: string;
}

export interface ApproveJobData {
  approval_notes?: string;
}

export interface RejectJobData {
  rejection_reason: string;
}

export interface ReportDateRangeParams {
  from_date?: string;
  to_date?: string;
}

export const adminApi = {
  // Dashboard
  getDashboardStats: async (): Promise<AdminDashboardStats> => {
    const response = await api.get<AdminDashboardStats>('/admin/dashboard/stats');
    return response.data;
  },

  // Users
  listUsers: async (params?: UserFilterParams): Promise<PaginatedResponse<UserListItem>> => {
    const response = await api.get<PaginatedResponse<UserListItem>>('/admin/users', { params });
    return response.data;
  },

  getUserDetail: async (userId: string): Promise<UserDetail> => {
    const response = await api.get<UserDetail>(`/admin/users/${userId}`);
    return response.data;
  },

  updateUserStatus: async (userId: string, data: UpdateUserStatusData): Promise<void> => {
    await api.patch(`/admin/users/${userId}/status`, data);
  },

  impersonateUser: async (userId: string): Promise<{ impersonation_token: string; expires_at: string }> => {
    const response = await api.get<{ impersonation_token: string; expires_at: string }>(
      `/admin/users/${userId}/impersonate`
    );
    return response.data;
  },

  // Companies
  listPendingCompanies: async (): Promise<CompanyProfile[]> => {
    const response = await api.get<CompanyProfile[]>('/admin/companies/pending');
    return response.data;
  },

  approveCompany: async (companyId: string, data?: ApproveCompanyData): Promise<CompanyProfile> => {
    const response = await api.patch<CompanyProfile>(`/admin/companies/${companyId}/approve`, data || {});
    return response.data;
  },

  rejectCompany: async (companyId: string, data: RejectCompanyData): Promise<CompanyProfile> => {
    const response = await api.patch<CompanyProfile>(`/admin/companies/${companyId}/reject`, data);
    return response.data;
  },

  // Jobs
  listPendingJobs: async (): Promise<CompanyJob[]> => {
    const response = await api.get<CompanyJob[]>('/admin/jobs/pending');
    return response.data;
  },

  approveJob: async (jobId: string, data?: ApproveJobData): Promise<CompanyJob> => {
    const response = await api.patch<CompanyJob>(`/admin/jobs/${jobId}/approve`, data || {});
    return response.data;
  },

  rejectJob: async (jobId: string, data: RejectJobData): Promise<CompanyJob> => {
    const response = await api.patch<CompanyJob>(`/admin/jobs/${jobId}/reject`, data);
    return response.data;
  },

  // Audit Logs
  listAuditLogs: async (params?: {
    admin_id?: string;
    action_type?: string;
    entity_type?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<AdminAuditLog>> => {
    const response = await api.get<PaginatedResponse<AdminAuditLog>>('/admin/audit-logs', { params });
    return response.data;
  },

  // Reports
  getUsersReport: async (params?: ReportDateRangeParams): Promise<UserTrendsReport> => {
    const response = await api.get<UserTrendsReport>('/admin/reports/users', { params });
    return response.data;
  },

  getCompaniesReport: async (params?: ReportDateRangeParams): Promise<CompanyTrendsReport> => {
    const response = await api.get<CompanyTrendsReport>('/admin/reports/companies', { params });
    return response.data;
  },

  getJobsReport: async (params?: ReportDateRangeParams): Promise<JobTrendsReport> => {
    const response = await api.get<JobTrendsReport>('/admin/reports/jobs', { params });
    return response.data;
  },

  getApplicationsReport: async (params?: ReportDateRangeParams): Promise<ApplicationTrendsReport> => {
    const response = await api.get<ApplicationTrendsReport>('/admin/reports/applications', { params });
    return response.data;
  },

  exportReport: async (reportType: string, params?: ReportDateRangeParams): Promise<Blob> => {
    const response = await api.get(`/admin/reports/export/${reportType}`, {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};
