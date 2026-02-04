import axios from 'axios';
import type { AuthResponse, JobListResponse, JobWithCompany, JobApplication } from '@/types';
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
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  login: async (data: LoginFormData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  me: async (): Promise<AuthResponse['user']> => {
    const response = await api.get<AuthResponse['user']>('/auth/me');
    return response.data;
  },
};

export const jobsApi = {
  list: async (filters: JobFiltersData = {}): Promise<JobListResponse> => {
    const response = await api.get<JobListResponse>('/jobs', { params: filters });
    return response.data;
  },

  get: async (id: number): Promise<JobWithCompany> => {
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
