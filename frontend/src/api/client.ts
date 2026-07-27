import axios from 'axios'

const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:8000'
  }
  return 'https://mymemos-production-d0e1.up.railway.app'
}

export const api = axios.create({ 
  baseURL: getBaseURL()
})

api.interceptors.request.use((config) => {
  const email = localStorage.getItem('auth_email')

  // Always send user identity header
  if (email) {
    config.headers['X-User-Email'] = email
  }

  if (email && config.url?.includes('/recordings')) {
    if (config.method?.toLowerCase() === 'get') {
      config.params = { ...(config.params || {}), user_email: email }
    } else if (config.method?.toLowerCase() === 'post' && config.data instanceof FormData) {
      if (!config.data.has('user_email')) {
        config.data.append('user_email', email)
      }
    }
  }

  const activeLodgeId = localStorage.getItem('activeLodgeId')
  if (activeLodgeId) {
    config.headers['X-Lodge-Id'] = activeLodgeId
    if (config.method?.toLowerCase() === 'post' && config.data instanceof FormData) {
      if (!config.data.has('lodge_id')) {
        config.data.append('lodge_id', activeLodgeId)
      }
    }
  }

  return config
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

export interface ShoppingItem {
  id: string
  created_at: string
  updated_at: string
  item_name: string
  status: string
  recording_id?: string
  user_email?: string
}

export const getActiveShopping = () =>
  api.get(`/recordings/shopping/active`).then(r => r.data)

export const getShoppingHistory = () =>
  api.get(`/recordings/shopping/history`).then(r => r.data)

export const deleteShoppingItem = (id: string) =>
  api.delete(`/recordings/shopping/items/${id}`).then(r => r.data)

export const updateRecordingText = (id: string, summary: string, transcript: string) =>
  api.patch(`/recordings/${id}/text`, { summary, transcript }).then(r => r.data)

export const resummarizeRecording = (id: string, transcript: string) =>
  api.post(`/recordings/${id}/resummarize`, { transcript }).then(r => r.data)

export const cleanRecordingTranscript = (id: string, transcript: string) =>
  api.post(`/recordings/${id}/clean-transcript`, { transcript }).then(r => r.data)

export const getCalendarMonthSummary = (month: string) =>
  api.get(`/lodge/calendar/month-summary`, { params: { month } }).then(r => r.data)

export const getReservationsByDate = (dateStr: string) =>
  api.get(`/lodge/reservations`, { params: { start_date: dateStr, end_date: dateStr } }).then(r => r.data)

export const getRooms = () => api.get(`/lodge/rooms`).then(r => r.data)
export const createRoom = (name: string) => api.post(`/lodge/rooms`, { name }).then(r => r.data)
export const updateRoom = (id: string, name: string) => api.put(`/lodge/rooms/${id}`, { name }).then(r => r.data)
export const deleteRoom = (id: string) => api.delete(`/lodge/rooms/${id}`).then(r => r.data)

export const getAgencies = () => api.get(`/lodge/agencies`).then(r => r.data)
export const createAgency = (name: string, color: string) => api.post(`/lodge/agencies`, { name, color }).then(r => r.data)
export const updateAgency = (id: string, name: string, color: string) => api.put(`/lodge/agencies/${id}`, { name, color }).then(r => r.data)
export const deleteAgency = (id: string) => api.delete(`/lodge/agencies/${id}`).then(r => r.data)

export const exportBookingSheet = (month: string) => 
  api.get(`/lodge/export-booking-sheet`, { params: { month }, responseType: 'blob' }).then(r => r.data)

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
