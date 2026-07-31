<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import imgLogoUtmReversePutih1 from '@/assets/77ef8f9588a3fa002b1d280d8bcea5ad51e2d03d.png'
import { formatMalaysiaDateTime } from '@/utils/dateTime'

const router = useRouter()
const { user, logout } = useAuth()

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const showDropdown = ref(false)
const showNotifications = ref(false)
const notifications = ref([])
const isLoadingNotifications = ref(false)
const notificationError = ref('')

// Build notification roles from the logged-in user.
// One account may have several staff capabilities, so combine every effective role.
// Coordinator notifications are shown generally.
// Supervisor notifications are shown only when recipient_email matches user.email.
const currentUser = computed(() => {
  return user?.value || user || {}
})

const notificationRoles = computed(() => {
  const u = currentUser.value
  const roles = []

  if (u.is_coordinator || u.role_info?.is_coordinator) {
    roles.push('Coordinator')
  }

  if (u.is_supervisor || u.role_info?.is_supervisor) {
    roles.push('Supervisor')
  }

  if (u.is_examiner || u.role_info?.is_examiner) {
    roles.push('Examiner')
  }

  if (u.is_student || u.role_info?.is_student) {
    roles.push('Student')
  }

  // Fallback because this header is mainly used inside coordinator pages
  if (roles.length === 0) {
    roles.push('Coordinator')
  }

  return roles
})

const notificationTitle = computed(() => {
  if (notificationRoles.value.length > 1) {
    return 'My Notifications'
  }

  return `${notificationRoles.value[0]} Notifications`
})

const unreadCount = computed(() => {
  return notifications.value.filter((item) => !item.isRead).length
})

const latestNotifications = computed(() => {
  return notifications.value.slice(0, 8)
})

const dashboardPath = computed(() => {
  const u = currentUser.value
  const roles = notificationRoles.value

  if (u.is_admin || u.role_info?.is_admin) {
    return '/admin-dashboard'
  }

  if (roles.includes('Student') && !roles.includes('Coordinator') && !roles.includes('Supervisor') && !roles.includes('Examiner')) {
    return '/student-dashboard'
  }

  if ((roles.includes('Supervisor') || roles.includes('Examiner')) && !roles.includes('Coordinator')) {
    return '/supervisor-dashboard'
  }

  return '/dashboard'
})

const roleHomePath = computed(() => {
  const roles = notificationRoles.value

  if (roles.includes('Student') && !roles.includes('Coordinator') && !roles.includes('Supervisor') && !roles.includes('Examiner')) {
    return '/student-fyp'
  }

  if (roles.includes('Examiner') && !roles.includes('Supervisor') && !roles.includes('Coordinator')) {
    return '/examiner-projects'
  }

  if (roles.includes('Supervisor') && !roles.includes('Coordinator')) {
    return '/supervisor-projects'
  }

  return '/manage-fyp'
})

const goToDashboard = () => {
  router.push(dashboardPath.value)
}

const getNotificationTarget = (item) => {
  const type = String(item?.recipientType || '').toLowerCase()
  const projectId = item?.project_id || ''

  if (type === 'student') {
    const isResult = /result released|grade released/i.test(String(item?.title || ''))
    return {
      path: '/student-project-details',
      query: projectId ? { projectId, ...(isResult ? { tab: 'result' } : {}) } : {},
    }
  }

  if (type === 'supervisor') {
    return {
      path: '/supervisor-review',
      query: projectId ? { projectId } : {},
    }
  }

  if (type === 'coordinator') {
    return {
      path: '/manage-fyp',
      query: { tab: 'records', ...(projectId ? { projectId } : {}) },
    }
  }

  if (type === 'examiner') {
    return {
      path: '/examiner-review',
      query: projectId ? { projectId } : {},
    }
  }

  return { path: roleHomePath.value }
}

const notificationOpenLabel = computed(() => {
  const roles = notificationRoles.value

  if (roles.includes('Student') && !roles.includes('Coordinator') && !roles.includes('Supervisor') && !roles.includes('Examiner')) {
    return 'Open My FYP'
  }

  if (roles.includes('Supervisor') && !roles.includes('Coordinator')) {
    return 'Open Assigned Projects'
  }

  return 'Open Manage FYP'
})

const loadNotifications = async () => {
  notificationError.value = ''

  try {
    isLoadingNotifications.value = true

    const u = currentUser.value
    const roles = notificationRoles.value.join(',')
    const email = u.email || ''

    const query = new URLSearchParams({
      roles,
      email,
    })

    const response = await fetch(
      `${API_BASE_URL}/api/supervisor-matching/notifications?${query.toString()}`
    )

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to load notifications.')
    }

    notifications.value = data.notifications || []
  } catch (error) {
    console.error('Notification load error:', error)
    notificationError.value = error.message || 'Failed to load notifications.'
  } finally {
    isLoadingNotifications.value = false
  }
}

const markNotificationAsRead = async (notificationId) => {
  if (!notificationId) return

  try {
    await fetch(
      `${API_BASE_URL}/api/supervisor-matching/notifications/${notificationId}/read`,
      {
        method: 'PATCH',
      }
    )

    notifications.value = notifications.value.map((item) => {
      if (item.notification_id === notificationId) {
        return {
          ...item,
          isRead: true,
        }
      }

      return item
    })
  } catch (error) {
    console.error('Mark notification as read error:', error)
  }
}

const openNotification = async (item) => {
  await markNotificationAsRead(item.notification_id)

  showNotifications.value = false
  router.push(getNotificationTarget(item))
}

const toggleNotifications = async () => {
  showNotifications.value = !showNotifications.value
  showDropdown.value = false

  if (showNotifications.value) {
    await loadNotifications()
  }
}

const toggleUserDropdown = () => {
  showDropdown.value = !showDropdown.value
  showNotifications.value = false
}

const goToProfile = () => {
  showDropdown.value = false
  showNotifications.value = false
  router.push('/profile')
}

const handleLogout = () => {
  logout()
  showDropdown.value = false
  showNotifications.value = false
  router.push('/')
}

const goToManageFYP = () => {
  showNotifications.value = false
  router.push({ path: roleHomePath.value })
}

const handleClickOutside = (event) => {
  const target = event.target

  if (!target.closest?.('.header-notification-area')) {
    showNotifications.value = false
  }

  if (!target.closest?.('.header-user-area')) {
    showDropdown.value = false
  }
}

let notificationTimer = null

onMounted(() => {
  loadNotifications()
  notificationTimer = setInterval(loadNotifications, 30000)
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  if (notificationTimer) {
    clearInterval(notificationTimer)
  }

  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div
    class="bg-[#5C001F] w-full h-[100px] lg:h-[70px] px-[20px] py-[8px] flex items-center justify-between shrink-0 shadow-sm relative z-50"
  >
    <!-- Left side -->
    <div
      class="flex items-center gap-[15px] shrink-0 cursor-pointer "
      @click="goToDashboard"
      title="Go to Dashboard"
    >
      <div
        class="h-[71.186px] lg:h-[45px] overflow-clip relative shrink-0 w-[210px] lg:w-[133px] flex items-center"
      >
        <img
          :src="imgLogoUtmReversePutih1"
          alt="UTM Logo"
          class="max-h-full max-w-full object-contain pointer-events-none"
        />
      </div>

      <div class="h-[70px] lg:h-[40px] w-px bg-white/40 shrink-0 mx-2"></div>

      <p
        class="capitalize font-bold text-[48px] lg:text-[28px] text-white whitespace-nowrap tracking-wide leading-none pt-0.5 font-['Inter']"
      >
        I-FAMOUS
      </p>
    </div>

    <!-- Right side -->
    <div v-if="user" class="flex items-center gap-[15px] shrink-0 relative">
      <!-- Notifications -->
      <div class="relative header-notification-area">
        <button
          @click.stop="toggleNotifications"
          class="relative p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          title="Notifications"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-8 w-8 lg:h-6 lg:w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>

          <span
            v-if="unreadCount > 0"
            class="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 bg-red-500 text-white text-[11px] font-bold rounded-full border-2 border-[#800000] flex items-center justify-center"
          >
            {{ unreadCount > 9 ? '9+' : unreadCount }}
          </span>
        </button>

        <!-- Notification Dropdown -->
        <div
          v-if="showNotifications"
          class="absolute right-0 mt-3 w-[420px] max-w-[90vw] bg-white rounded-[18px] shadow-2xl border border-gray-200 overflow-hidden z-[9999]"
        >
          <div class="bg-[#5c001f] text-white px-5 py-4 flex items-center justify-between">
            <div>
              <p class="font-bold text-lg">{{ notificationTitle }}</p>
              <p class="text-xs text-white/70">
                {{ unreadCount }} unread notification(s)
              </p>
            </div>

            <button
              @click.stop="loadNotifications"
              class="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-full text-xs font-bold"
            >
              Refresh
            </button>
          </div>

          <div v-if="isLoadingNotifications" class="p-6 text-center text-sm text-gray-600">
            Loading notifications...
          </div>

          <div v-else-if="notificationError" class="p-5 bg-red-50 text-red-700 text-sm">
            {{ notificationError }}
          </div>

          <div v-else-if="latestNotifications.length === 0" class="p-6 text-center">
            <p class="font-bold text-gray-700">No notifications yet</p>
            <p class="text-sm text-gray-500 mt-1">
              Coordinator and supervisor assignment records will appear here.
            </p>
          </div>

          <div v-else class="max-h-[420px] overflow-y-auto">
            <button
              v-for="item in latestNotifications"
              :key="item.notification_id"
              @click="openNotification(item)"
              class="w-full text-left px-5 py-4 border-b border-gray-100 hover:bg-[#fff8df] transition-colors"
            >
              <div class="flex gap-3">
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-[#fff3c4] text-[#5c001f]"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                </div>

                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-3">
                    <p class="font-bold text-sm text-[#5c001f]">
                      {{ item.title }}
                    </p>

                    <span
                      v-if="!item.isRead"
                      class="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-1"
                    ></span>
                  </div>

                  <p class="text-xs text-gray-500 mt-1">
                    {{ item.recipientType }} · {{ formatMalaysiaDateTime(item.createdAt) }}
                  </p>

                  <p class="text-sm text-gray-700 mt-2 leading-relaxed">
                    {{ item.message }}
                  </p>

                  <p class="text-xs text-[#5c001f] font-bold mt-2">
                    Click to open related project
                  </p>
                </div>
              </div>
            </button>
          </div>

          <div class="p-4 bg-[#f7f1ea]">
            <button
              @click="goToManageFYP"
              class="w-full bg-[#5c001f] text-white px-4 py-3 rounded-full font-bold hover:bg-[#4a0019] transition-colors"
            >
              {{ notificationOpenLabel }}
            </button>
          </div>
        </div>
      </div>

      <!-- User Profile Dropdown -->
      <div class="relative header-user-area">
        <button
          @click.stop="toggleUserDropdown"
          class="bg-[rgba(255,255,255,0.5)] flex items-center justify-center gap-[12px] lg:gap-[8px] px-[12px] py-[8px] lg:py-[4px] lg:px-[10px] rounded-[15px] hover:bg-white/60 transition-colors"
        >
          <div
            class="w-[35px] h-[35px] lg:w-[28px] lg:h-[28px] rounded-full bg-[#5c001f] flex items-center justify-center text-white font-bold text-lg lg:text-sm"
          >
            {{ user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U' }}
          </div>

          <p
            class="capitalize font-bold text-[24px] lg:text-[16px] text-white whitespace-nowrap font-['Inter']"
          >
            {{ user.full_name || 'Username' }}
          </p>
        </button>

        <div
          v-if="showDropdown"
          class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200"
        >
          <div class="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
            {{ user.email }}
          </div>

          <button
            @click="goToProfile"
            class="block w-full text-left px-4 py-2 text-sm text-[#5c001f] hover:bg-[#f7f1ea] font-semibold"
          >
            Edit Profile
          </button>

          <button
            @click="handleLogout"
            class="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium border-t border-gray-100"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
