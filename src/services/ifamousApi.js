import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem('userSession') || 'null') || {}
  } catch {
    return {}
  }
}

export function getToken() {
  const session = getSession()
  return (
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    localStorage.getItem('ifamous_token') ||
    session.token ||
    ''
  )
}

export function fileUrl(projectId, submissionId, download = false) {
  const token = encodeURIComponent(getToken())
  return `${API_BASE_URL}/api/projects/${projectId}/submissions/${submissionId}/file?download=${download ? 1 : 0}&access_token=${token}`
}

export function feedbackFileUrl(projectId, feedbackId, download = false) {
  const token = encodeURIComponent(getToken())
  return `${API_BASE_URL}/api/projects/${projectId}/feedback/${feedbackId}/file?download=${download ? 1 : 0}&access_token=${token}`
}

export function roleFlags() {
  const session = getSession()
  return {
    isAdmin: Number(session.is_admin || session.role_info?.is_admin || 0) === 1,
    isCoordinator: Number(session.is_coordinator || session.role_info?.is_coordinator || 0) === 1,
    isStudent: Number(session.is_student || session.role_info?.is_student || 0) === 1,
    isSupervisor: Number(session.is_supervisor || session.role_info?.is_supervisor || 0) === 1,
    isExaminer: Number(session.is_examiner || session.role_info?.is_examiner || 0) === 1,
  }
}
