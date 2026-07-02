import axios from 'axios'

const api = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || 'https://mymemos-production-d0e1.up.railway.app' 
})

export interface Client {
  id: string
  created_at: string
  name: string
}

export interface Recording {
  id: string
  created_at: string
  transcript: string
  summary: string
  status: string
  date_recorded?: string
  type: string
  client_id?: string
  client?: Client
}

export interface AdminUser {
  id: string
  email: string
  pin?: string
  role: string
  created_at: string
}

export const getByDate = (dateStr: string) =>
  api.get(`/recordings/by-date/${dateStr}`).then(r => r.data)

export const getRecording = (id: string) =>
  api.get(`/recordings/${id}`).then(r => r.data)

export const updateStatus = (id: string, status: string) =>
  api.patch(`/recordings/${id}/status`, { status }).then(r => r.data)

export const updateDate = (id: string, date_recorded: string) =>
  api.patch(`/recordings/${id}/date`, { date_recorded }).then(r => r.data)

export const deleteRecording = (id: string) =>
  api.delete(`/recordings/${id}`).then(r => r.data)

export const getCalendarDoneCounts = () =>
  api.get(`/recordings/calendar/done-counts`).then(r => r.data)

export const getDoneByDate = (dateStr: string) =>
  api.get(`/recordings/calendar/done-by-date/${dateStr}`).then(r => r.data)

export const getActiveShopping = () =>
  api.get(`/recordings/shopping/active`).then(r => r.data)

export const getShoppingHistory = () =>
  api.get(`/recordings/shopping/history`).then(r => r.data)

export const getClients = () =>
  api.get(`/clients`).then(r => r.data)

export const createClient = (name: string) =>
  api.post(`/clients`, { name }).then(r => r.data)

export const sendPin = (email: string) =>
  api.post(`/auth/send-pin`, { email }).then(r => r.data)

export const verifyPin = (email: string, pin: string) =>
  api.post(`/auth/verify-pin`, { email, pin }).then(r => r.data)

export const registerUser = (email: string, pin: string) =>
  api.post(`/auth/register`, { email, pin }).then(r => r.data)

export const adminListUsers = (admin_email: string) =>
  api.get(`/auth/admin/users`, { params: { admin_email } }).then(r => r.data)

export const adminCreateUser = (admin_email: string, email: string, pin: string, role: string = "user") =>
  api.post(`/auth/admin/users`, { admin_email, email, pin, role }).then(r => r.data)

export const adminUpdateUser = (user_id: string, admin_email: string, email?: string, pin?: string, role?: string) =>
  api.put(`/auth/admin/users/${user_id}`, { admin_email, email, pin, role }).then(r => r.data)

export const adminDeleteUser = (user_id: string, admin_email: string) =>
  api.delete(`/auth/admin/users/${user_id}`, { params: { admin_email } }).then(r => r.data)

export default api
