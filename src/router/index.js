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
  ],
})

// Route Guard for Authentication
router.beforeEach((to, from, next) => {
  const isAuthenticated = !!localStorage.getItem('userSession')

  if (to.meta.requiresAuth && !isAuthenticated) {
    // If the route requires auth and user is not logged in, redirect to login
    next({ name: 'login' })
  } else if (to.name === 'login' && isAuthenticated) {
    // If the user is already logged in and tries to access login page, redirect to dashboard
    next({ name: 'dashboard' })
  } else {
    // Proceed normally
    next()
  }
})

export default router
