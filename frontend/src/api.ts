// Client API helper for Ethara.AI Project Management App

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocalhost ? 'http://localhost:5000/api' : '/api';

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

// Global request wrapper that attaches JWT token
async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const token = localStorage.getItem('ethara_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    data = { error: 'Failed to parse server response' };
  }

  if (!response.ok) {
    throw new Error(data.error || `HTTP error! status: ${response.status}`);
  }

  return data as T;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  userRole: 'ADMIN' | 'MEMBER';
  tasksCount: number;
  members: Array<{
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'MEMBER';
  }>;
  tasks: Task[];
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate: string;
  projectId: string;
  creator: User;
  assignee?: User | null;
  createdAt: string;
}

export const api = {
  // Authentication
  signup: (body: any) => apiFetch<{ token: string; user: User }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(body),
  }),

  login: (body: any) => apiFetch<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  }),

  getMe: () => apiFetch<User>('/auth/me', {
    method: 'GET',
  }),

  // Projects
  getProjects: () => apiFetch<Project[]>('/projects', {
    method: 'GET',
  }),

  getProjectById: (id: string) => apiFetch<Project>(`/projects/${id}`, {
    method: 'GET',
  }),

  createProject: (body: { name: string; description?: string }) => apiFetch<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  }),

  addProjectMember: (projectId: string, body: { email: string; role?: 'ADMIN' | 'MEMBER' }) => 
    apiFetch<{ id: string; name: string; email: string; role: 'ADMIN' | 'MEMBER' }>(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  removeProjectMember: (projectId: string, userId: string) => 
    apiFetch<{ message: string }>(`/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    }),

  searchUsers: (query: string) => apiFetch<User[]>(`/users/search?query=${encodeURIComponent(query)}`, {
    method: 'GET',
  }),

  // Tasks
  createTask: (projectId: string, body: {
    title: string;
    description?: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    dueDate: string;
    assigneeId?: string | null;
  }) => apiFetch<Task>(`/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(body),
  }),

  updateTask: (taskId: string, body: {
    title?: string;
    description?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    dueDate?: string;
    assigneeId?: string | null;
    status?: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  }) => apiFetch<Task>(`/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }),

  deleteTask: (taskId: string) => apiFetch<{ message: string }>(`/tasks/${taskId}`, {
    method: 'DELETE',
  }),
};
