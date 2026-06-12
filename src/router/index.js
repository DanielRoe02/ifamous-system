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
      component: () => import('../views/supervisor/SupervisorDashboardView.vue'),
      meta: { requiresAuth: true },
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
  ],
})

// Route Guard for Authentication
const getDefaultRouteForUser = () => {
  const session = JSON.parse(localStorage.getItem('userSession') || 'null')

  if (Number(session?.is_admin) === 1) return '/admin-dashboard'
  if (Number(session?.is_coordinator) === 1) return '/dashboard'
  if (Number(session?.is_supervisor) === 1) return '/supervisor-dashboard'
  if (Number(session?.is_student) === 1) return '/student-dashboard'

  return '/dashboard'
}

router.beforeEach((to, from, next) => {
  const isAuthenticated = !!localStorage.getItem('userSession')

  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'login' })
  } else if (to.name === 'login' && isAuthenticated) {
    next(getDefaultRouteForUser())
  } else {
    next()
  }
})

export default router