import mockData from '../../localData/mockData.json'
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Simulated delay to mimic network latency
const delay = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * MOCK API SERVICE
 *
 * Once your backend (e.g. Node.js/Express connected to MySQL) is ready,
 * simply swap out these mock functions with real fetch or axios calls.
 *
 * Example for real backend:
 *
 * import axios from 'axios';
 * const API_BASE_URL = 'http://localhost:3000/api';
 *
 * export const getProjects = async () => {
 *   const response = await axios.get(`${API_BASE_URL}/projects`);
 *   return response.data;
 * }
 */

export const apiService = {
  // Users
  getUsers: async () => {
    await delay()
    return mockData.users
  },

  // Students
  getStudents: async () => {
    await delay()
    return mockData.students
  },

  // Supervisors
  getSupervisors: async () => {
    await delay()
    return mockData.supervisor
  },

  // Examiners
  getExaminers: async () => {
    await delay()
    return mockData.examiners
  },

  // Projects
  getProjects: async () => {
    await delay()
    return mockData.projects
  },

  getProjectById: async (id) => {
    await delay()
    return mockData.projects.find((p) => p.project_id === parseInt(id))
  },

  // Submissions
  getProjectSubmissions: async (projectId) => {
    await delay()
    return mockData.projects_submissions.filter((sub) => sub.project_id === parseInt(projectId))
  },

  // FYP Session Data from GetFYPSessionData procedure
  getFYPSessionData: async (sessionId) => {
    const response = await axios.get(`${API_BASE_URL}/api/sessions/${sessionId}/data`)
    return response.data
  },

  getActiveSession: async () => {
    const response = await axios.get(`${API_BASE_URL}/api/sessions/active`)
    return response.data
  },
  createCalendarSchedule: async (fypSessionId, userId, classId, scheduleJson) => {
    const response = await axios.post(`${API_BASE_URL}/api/timetables`, {
      fyp_session_id: fypSessionId,
      user_id: userId,
      class_id: classId,
      schedule_json: scheduleJson,
    })
    return response.data
  },

  deleteCalendarSchedule: async (timeTableId) => {
    const response = await axios.delete(`${API_BASE_URL}/api/timetables/${timeTableId}`)
    return response.data
  },

  updateCalendarSchedule: async (timeTableId, userId, classId, scheduleJson) => {
    const response = await axios.put(`${API_BASE_URL}/api/timetables/${timeTableId}`, {
      user_id: userId,
      class_id: classId,
      schedule_json: scheduleJson,
    })
    return response.data
  },

  getRecentUsers: async () => {
    const response = await axios.get(`${API_BASE_URL}/api/users/recent`)
    return response.data
  },

  createUser: async (userData) => {
    const response = await axios.post(`${API_BASE_URL}/api/users`, userData)
    return response.data
  },

  updateUser: async (userId, userData) => {
    const response = await axios.put(`${API_BASE_URL}/api/users/${userId}`, userData)
    return response.data
  },

  deleteUser: async (userId) => {
    const response = await axios.delete(`${API_BASE_URL}/api/users/${userId}`)
    return response.data
  },

  getPaginatedUsers: async (category, page) => {
    const response = await axios.get(`${API_BASE_URL}/api/users/paginated`, {
      params: { category, page },
    })
    return response.data
  },

  searchUsers: async (query, sessionId) => {
    const response = await axios.get(`${API_BASE_URL}/api/users/search`, {
      params: { q: query, session_id: sessionId },
    })
    return response.data
  },

  searchClasses: async (query, sessionId) => {
    const response = await axios.get(`${API_BASE_URL}/api/classes/search`, {
      params: { q: query, session_id: sessionId },
    })
    return response.data
  },
}
