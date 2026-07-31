import { createRouter, createWebHistory } from 'vue-router'
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: () => import('../views/auth/LoginView.vue'),
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('../views/auth/SignupView.vue'),
    },

    {
      path: '/admin-dashboard',
      name: 'admin-dashboard',
      component: () => import('../views/admin/AdminDashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin-users',
      name: 'admin-users',
      component: () => import('../views/admin/AdminManageUsersView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/coordinator/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/manage-session',
      name: 'manage-session',
      component: () => import('../views/coordinator/ManageSessionView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/calendar',
      name: 'calendar',
      component: () => import('../views/coordinator/CalendarView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/add-time-table',
      name: 'add-time-table',
      component: () => import('../views/coordinator/ManageTimeTableView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/create-meeting',
      name: 'create-meeting',
      component: () => import('../views/coordinator/CreateMeetingView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/edit-time-table',
      name: 'edit-time-table',
      component: () => import('../views/coordinator/EditTimeTableView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/manage-user',
      name: 'manage-user',
      component: () => import('../views/coordinator/ManageUserView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/manage-fyp',
      name: 'manage-fyp',
      component: () => import('../views/coordinator/ManageFYPView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/coordinator-project-details',
      name: 'coordinator-project-details',
      component: () => import('../views/coordinator/CoordinatorProjectDetailsView.vue'),
      meta: { requiresAuth: true, roles: ['coordinator', 'admin'] },
    },

    {
      path: '/student-dashboard',
      name: 'student-dashboard',
      component: () => import('../views/student/StudentDashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/student-fyp',
      name: 'student-fyp',
      component: () => import('../views/student/StudentMyFYPView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/student-logbook',
      name: 'student-logbook',
      component: () => import('../views/student/StudentLogbookView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/student-submissions',
      redirect: '/student-fyp',
    },
    {
      path: '/student-project-details',
      name: 'student-project-details',
      component: () => import('../views/student/StudentProjectDetailsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/supervisor-dashboard',
      name: 'supervisor-dashboard',
      component: () => import('../views/examiner/ExaminerDashboardView.vue'),
      meta: { requiresAuth: true, roles: ['supervisor', 'examiner'] },
    },
    {
      path: '/staff-dashboard',
      redirect: '/supervisor-dashboard',
    },
    {
      path: '/supervisor-projects',
      name: 'supervisor-projects',
      component: () => import('../views/supervisor/SupervisorProjectsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/supervisor-review',
      name: 'supervisor-review',
      component: () => import('../views/supervisor/SupervisorReviewView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/supervisor-logbook',
      name: 'supervisor-logbook',
      component: () => import('../views/supervisor/SupervisorLogbookView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/supervisor-assessment',
      name: 'supervisor-assessment',
      component: () => import('../views/supervisor/SupervisorAssessmentView.vue'),
      meta: { requiresAuth: true, roles: ['supervisor', 'coordinator', 'admin'] },
    },
    {
      path: '/project-journey',
      name: 'project-journey',
      component: () => import('../views/shared/ProjectJourneyView.vue'),
      meta: { requiresAuth: true, roles: ['student', 'supervisor', 'examiner', 'coordinator', 'admin'] },
    },
    {
      path: '/examiner-projects',
      name: 'examiner-projects',
      component: () => import('../views/examiner/ExaminerProjectsView.vue'),
      meta: { requiresAuth: true, roles: ['examiner'] },
    },
    {
      path: '/examiner-review',
      name: 'examiner-review',
      component: () => import('../views/examiner/ExaminerReviewView.vue'),
      meta: { requiresAuth: true, roles: ['examiner', 'coordinator', 'admin'] },
    },
    {
      path: '/examiner-assignment',
      name: 'examiner-assignment',
      component: () => import('../views/coordinator/ExaminerAssignmentView.vue'),
      meta: { requiresAuth: true, roles: ['coordinator', 'admin'] },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/shared/ProfileView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

// Route Guard for Authentication
const getDefaultRouteForUser = () => {
  const session = JSON.parse(localStorage.getItem('userSession') || 'null')

  if (Number(session?.is_admin) === 1) return '/admin-dashboard'
  if (Number(session?.is_coordinator) === 1) return '/dashboard'
  if (Number(session?.is_supervisor) === 1 || Number(session?.is_examiner) === 1) return '/supervisor-dashboard'
  if (Number(session?.is_student) === 1) return '/student-dashboard'

  return '/dashboard'
}

router.beforeEach((to, from, next) => {
  const rawSession = localStorage.getItem('userSession')
  const isAuthenticated = !!rawSession
  let session = {}
  try { session = JSON.parse(rawSession || 'null') || {} } catch { session = {} }

  if (to.meta.requiresAuth && !isAuthenticated) {
    return next({ name: 'login' })
  }
  if (to.name === 'login' && isAuthenticated) {
    return next(getDefaultRouteForUser())
  }

  const requiredRoles = to.meta.roles || []
  if (requiredRoles.length) {
    const hasRole = requiredRoles.some((role) => Number(session[`is_${role}`] || session.role_info?.[`is_${role}`] || 0) === 1)
    if (!hasRole) return next(getDefaultRouteForUser())
  }
  return next()
})

export default router