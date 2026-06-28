import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getByDate = (dateStr: string) =>
  api.get(`/recordings/by-date/${dateStr}`).then(r => r.data)

export const getRecording = (id: string) =>
  api.get(`/recordings/${id}`).then(r => r.data)

export const updateStatus = (id: string, status: string) =>
  api.patch(`/recordings/${id}/status`, { status }).then(r => r.data)

export default api
