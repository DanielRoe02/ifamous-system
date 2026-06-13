<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import {
  Bell,
  BookOpenCheck,
  ClipboardCheck,
  FileSearch,
  LayoutDashboard,
  MessageSquare,
  Users,
} from 'lucide-vue-next'

const router = useRouter()

const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:3000'

const loading = ref(false)
const errorMessage = ref('')
const supervisor = ref(null)
const stats = ref({ workload: 0, capacity: 5, pendingReviews: 0, pendingFeedback: 0, pendingLogbooks: 0 })
const projects = ref([])
const notifications = ref([])

function getAuthToken() {
  return (
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    localStorage.getItem('ifamous_token') ||
    localStorage.getItem('ifamousToken') ||
    sessionStorage.getItem('token') ||
    ''
  )
}

function getStoredUser() {
  try {
    const raw =
      localStorage.getItem('user') ||
      localStorage.getItem('ifamous_user') ||
      localStorage.getItem('currentUser')
    return raw ? JSON.parse(raw) : {}
  } catch (error) {
    return {}
  }
}

const displayName = computed(() => {
  const stored = getStoredUser()
  return supervisor.value?.full_name || stored.full_name || stored.fullName || stored.name || 'Supervisor'
})

const cards = computed(() => [
  { label: 'Workload', value: `${stats.value.workload || 0} / ${stats.value.capacity || 5}`, note: 'maximum capacity' },
  { label: 'Pending Reviews', value: stats.value.pendingReviews || 0, note: 'proposal/report review' },
  { label: 'Pending Feedback', value: stats.value.pendingFeedback || 0, note: 'comments to provide' },
  { label: 'Pending Logbooks', value: stats.value.pendingLogbooks || 0, note: 'weekly approval' },
])

const pendingProjects = computed(() =>
  projects.value.filter((project) => {
    const status = String(project.status || '').toLowerCase()
    return status.includes('pending supervisor approval') || status.includes('assigned') || status.includes('pending review')
  })
)

const tasks = computed(() => {
  const rows = pendingProjects.value.slice(0, 5).map((project) => ({
    id: project.project_id,
    text: `Review proposal - ${project.studentName || 'Student'}`,
    project,
    type: 'project',
  }))

  if (rows.length === 0) {
    return [{ id: 'empty', text: 'No pending project review right now.', type: 'empty' }]
  }

  return rows
})

async function loadDashboard() {
  loading.value = true
  errorMessage.value = ''

  try {
    const token = getAuthToken()

    const response = await fetch(`${API_BASE}/api/supervisor/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load supervisor dashboard.')
    }

    supervisor.value = data.supervisor || null
    stats.value = data.stats || stats.value
    projects.value = data.projects || []

    const email = supervisor.value?.email || getStoredUser().email || ''
    const notificationResponse = await fetch(
      `${API_BASE}/api/supervisor-matching/notifications?recipientType=Supervisor&recipientEmail=${encodeURIComponent(email)}`
    )
    const notificationData = await notificationResponse.json()
    notifications.value = notificationData.notifications || []
  } catch (error) {
    errorMessage.value = error.message
    projects.value = []
  } finally {
    loading.value = false
  }
}

function reviewTask(task) {
  if (task.type !== 'project') return

  router.push({
    path: '/supervisor-review',
    query: { projectId: task.project.project_id },
  })
}

onMounted(loadDashboard)
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3] text-black font-['Inter']">
    <AppHeader />
    <div class="flex">
      <aside class="w-[240px] bg-[#f7f1ea] border-r border-[#d8c9bd] min-h-[calc(100vh-70px)] p-4">
        <div class="bg-white/80 border border-[#e1d5cc] rounded-[18px] p-4 mb-4">
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5c001f]">Supervisor</p>
          <p class="text-sm text-gray-600 mt-1">Review Workspace</p>
        </div>
        <nav class="space-y-2">
          <button class="w-full bg-[#5c001f] text-white rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold">
            <LayoutDashboard class="w-5 h-5 text-[#f8be17]" /> Dashboard
          </button>
          <button @click="router.push('/supervisor-projects')" class="w-full hover:bg-white rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold">
            <FileSearch class="w-5 h-5 text-[#5c001f]" /> Assigned Projects
          </button>
          <button @click="router.push('/supervisor-logbook')" class="w-full hover:bg-white rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold">
            <BookOpenCheck class="w-5 h-5 text-[#5c001f]" /> Logbook
          </button>
        </nav>
      </aside>

      <main class="flex-1 p-8 space-y-7">
        <section class="rounded-[32px] bg-[#5c001f] text-white p-8 shadow-xl relative overflow-hidden">
          <div class="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[#f8be17]/20"></div>
          <p class="text-[#f8be17] font-bold uppercase tracking-[0.2em]">I-FAMOUS Supervisor</p>
          <h1 class="text-[36px] font-bold mt-2">Welcome, {{ displayName }}</h1>
          <p class="text-white/80 mt-2">Review assigned projects, approve/reject submissions, give feedback and check logbooks.</p>
        </section>

        <section v-if="errorMessage" class="bg-red-50 border border-red-200 rounded-[24px] p-5 text-red-700 font-bold">
          {{ errorMessage }}
        </section>

        <section class="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div v-for="card in cards" :key="card.label" class="bg-white rounded-[24px] p-6 shadow-lg border border-black/10">
            <p class="text-sm font-bold text-gray-500">{{ card.label }}</p>
            <p class="text-[34px] font-bold text-[#5c001f] mt-2">{{ loading ? '...' : card.value }}</p>
            <p class="text-xs text-gray-500 mt-1">{{ card.note }}</p>
          </div>
        </section>

        <section class="grid grid-cols-1 xl:grid-cols-3 gap-7">
          <div class="xl:col-span-2 bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
            <div class="flex items-center justify-between">
              <h2 class="text-[28px] font-bold">My Pending Tasks</h2>
              <button @click="router.push('/supervisor-projects')" class="bg-[#5c001f] text-white px-5 py-3 rounded-full font-bold">View All Projects</button>
            </div>
            <div class="mt-6 space-y-4">
              <div v-for="task in tasks" :key="task.id" class="rounded-[20px] bg-[#f7f1ea] border border-[#e1d5cc] p-5 flex items-center justify-between">
                <div class="flex items-center gap-3"><ClipboardCheck class="w-5 h-5 text-[#5c001f]" /><p class="font-bold">{{ task.text }}</p></div>
                <button
                  v-if="task.type === 'project'"
                  @click="reviewTask(task)"
                  class="bg-[#fff3c4] text-[#5c001f] px-4 py-2 rounded-full font-bold"
                >Review</button>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
            <div class="flex items-center justify-between"><h2 class="text-xl font-bold">Notifications</h2><Bell class="w-5 h-5 text-[#5c001f]" /></div>
            <div class="mt-5 space-y-4 text-sm">
              <div v-if="notifications.length === 0" class="rounded-[18px] bg-[#f7f1ea] p-4 border border-[#e1d5cc] flex gap-3">
                <MessageSquare class="w-5 h-5 text-[#5c001f]" /> No supervisor notification yet.
              </div>
              <div v-for="item in notifications.slice(0, 5)" :key="item.notification_id" class="rounded-[18px] bg-[#f7f1ea] p-4 border border-[#e1d5cc] flex gap-3">
                <Users class="w-5 h-5 text-[#5c001f] shrink-0" />
                <div>
                  <p class="font-bold">{{ item.title }}</p>
                  <p class="text-xs text-gray-600 mt-1">{{ item.message }}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
