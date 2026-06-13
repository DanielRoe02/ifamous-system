<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import {
  Bell,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  FolderKanban,
  LayoutDashboard,
} from 'lucide-vue-next'

const router = useRouter()

const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:3000'

const loading = ref(false)
const errorMessage = ref('')
const student = ref(null)
const records = ref([])
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

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const currentProject = computed(() => records.value[0] || null)

const displayName = computed(() => {
  const stored = getStoredUser()
  return student.value?.full_name || stored.full_name || stored.fullName || stored.name || 'Student'
})

const currentStatus = computed(() => currentProject.value?.status || 'No FYP Yet')

const pendingReviewCount = computed(() =>
  records.value.filter((item) =>
    String(item.status || '').toLowerCase().includes('pending')
  ).length
)

const progressStep = computed(() => {
  const status = String(currentStatus.value || '').toLowerCase()

  if (status.includes('active')) return 3
  if (status.includes('revision') || status.includes('rejected')) return 2
  if (status.includes('supervisor approval')) return 2
  if (status.includes('assignment')) return 2
  if (status.includes('matching')) return 2
  if (status.includes('coordinator') || status.includes('pending')) return 1
  return currentProject.value ? 1 : 0
})

const nextAction = computed(() => {
  const status = String(currentStatus.value || '').toLowerCase()

  if (!currentProject.value) return 'Create and submit your FYP proposal'
  if (status.includes('coordinator')) return 'Wait for coordinator review'
  if (status.includes('matching')) return 'Wait for AI matching'
  if (status.includes('assignment')) return 'Wait for supervisor assignment'
  if (status.includes('supervisor approval')) return 'Wait for supervisor approval'
  if (status.includes('active')) return 'Continue project progress and logbook'
  if (status.includes('revision')) return 'Revise proposal based on supervisor feedback'
  if (status.includes('rejected')) return 'Create a new proposal or contact coordinator'
  return 'Check your latest FYP status'
})

const overviewCards = computed(() => [
  {
    label: 'My FYP Status',
    value: currentStatus.value,
    note: currentProject.value ? nextAction.value : 'No active project found',
  },
  {
    label: 'Pending Review',
    value: pendingReviewCount.value,
    note: 'Database proposal records',
  },
  {
    label: 'Notifications',
    value: notifications.value.filter((item) => !item.isRead).length,
    note: 'Unread latest updates',
  },
  {
    label: 'Logbook',
    value: String(currentStatus.value).toLowerCase().includes('active') ? 'Open' : '-',
    note: String(currentStatus.value).toLowerCase().includes('active')
      ? 'Available now'
      : 'Available after approval',
  },
])

const activities = computed(() => {
  const items = []

  if (currentProject.value) {
    items.push({
      text: `${currentProject.value.title} status: ${currentProject.value.status}`,
      date: formatDate(currentProject.value.lastUpdated),
    })
  }

  notifications.value.slice(0, 4).forEach((item) => {
    items.push({
      text: item.title || item.message,
      date: formatDate(item.createdAt),
    })
  })

  if (items.length === 0) {
    items.push({ text: 'No FYP activity yet.', date: '-' })
  }

  return items
})

async function loadDashboard() {
  loading.value = true
  errorMessage.value = ''

  try {
    const token = getAuthToken()

    const fypResponse = await fetch(`${API_BASE}/api/student/my-fyp`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const fypData = await fypResponse.json()

    if (!fypResponse.ok) {
      throw new Error(fypData.error || 'Failed to load student FYP dashboard.')
    }

    student.value = fypData.student || null
    records.value = fypData.records || []

    const email = student.value?.email || getStoredUser().email || ''
    const notificationResponse = await fetch(
      `${API_BASE}/api/supervisor-matching/notifications?recipientType=Student&recipientEmail=${encodeURIComponent(email)}`
    )
    const notificationData = await notificationResponse.json()

    notifications.value = notificationData.notifications || []
  } catch (error) {
    errorMessage.value = error.message
    records.value = []
  } finally {
    loading.value = false
  }
}

function openCurrentFyp() {
  if (currentProject.value?.project_id) {
    router.push({
      path: '/student-project-details',
      query: { projectId: currentProject.value.project_id },
    })
    return
  }

  router.push('/student-fyp')
}

onMounted(loadDashboard)
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3] text-black font-['Inter']">
    <AppHeader />

    <div class="flex">
      <aside class="w-[240px] bg-[#f7f1ea] border-r border-[#d8c9bd] min-h-[calc(100vh-70px)] p-4">
        <div class="bg-white/80 border border-[#e1d5cc] rounded-[18px] p-4 mb-4">
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5c001f]">Student</p>
          <p class="text-sm text-gray-600 mt-1">FYP Workspace</p>
        </div>

        <nav class="space-y-2">
          <button class="w-full bg-[#5c001f] text-white rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold">
            <LayoutDashboard class="w-5 h-5 text-[#f8be17]" /> Dashboard
          </button>
          <button @click="router.push('/student-fyp')" class="w-full hover:bg-white text-[#2b1b1b] rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold">
            <FolderKanban class="w-5 h-5 text-[#5c001f]" /> My FYP
          </button>
          <button @click="router.push('/student-logbook')" class="w-full hover:bg-white text-[#2b1b1b] rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold">
            <BookOpenCheck class="w-5 h-5 text-[#5c001f]" /> Logbook
          </button>
        </nav>
      </aside>

      <main class="flex-1 p-8 space-y-7">
        <section class="rounded-[32px] bg-[#5c001f] text-white p-8 shadow-xl relative overflow-hidden">
          <div class="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[#f8be17]/20"></div>
          <p class="text-[#f8be17] font-bold uppercase tracking-[0.2em]">I-FAMOUS Student</p>
          <h1 class="text-[36px] font-bold mt-2">Welcome, {{ displayName }}</h1>
          <p class="text-white/80 mt-2">Track your FYP progress, proposal status, supervisor assignment, logbook and feedback.</p>
        </section>

        <section v-if="errorMessage" class="bg-red-50 border border-red-200 rounded-[24px] p-5 text-red-700 font-bold">
          {{ errorMessage }}
        </section>

        <section class="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div v-for="card in overviewCards" :key="card.label" class="bg-white rounded-[24px] p-6 shadow-lg border border-black/10">
            <p class="text-sm font-bold text-gray-500">{{ card.label }}</p>
            <p class="text-[28px] font-bold text-[#5c001f] mt-2">{{ loading ? '...' : card.value }}</p>
            <p class="text-xs text-gray-500 mt-1">{{ card.note }}</p>
          </div>
        </section>

        <section class="grid grid-cols-1 xl:grid-cols-3 gap-7">
          <div class="xl:col-span-2 bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">Current FYP</p>
                <h2 class="text-[28px] font-bold mt-1">{{ currentProject?.title || 'No FYP project yet' }}</h2>
                <p class="text-gray-600 mt-2">{{ nextAction }}</p>
              </div>
              <span class="px-4 py-2 rounded-full bg-[#fff3c4] text-[#5c001f] font-bold text-sm">{{ currentStatus }}</span>
            </div>

            <div class="mt-7 rounded-[24px] bg-[#f7f1ea] border border-[#e1d5cc] p-6">
              <h3 class="font-bold text-xl">FYP Progress</h3>
              <div class="mt-6 grid grid-cols-5 items-center text-center gap-3">
                <div v-for="step in [1,2,3,4,5]" :key="step" class="space-y-2">
                  <div
                    class="mx-auto w-11 h-11 rounded-full flex items-center justify-center font-bold"
                    :class="step <= progressStep ? 'bg-[#5c001f] text-white' : 'bg-white border border-[#d8c9bd]'"
                  >
                    {{ step }}
                  </div>
                  <p class="text-xs font-bold">{{ ['Proposal','Review','Progress','Final','Completed'][step - 1] }}</p>
                </div>
              </div>
            </div>

            <div class="mt-7 grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div class="rounded-[22px] border border-[#e1d5cc] p-5">
                <p class="text-sm font-bold uppercase tracking-[0.15em] text-[#5c001f]">My FYP Summary</p>
                <div class="mt-4 space-y-2 text-sm">
                  <p><b>Type:</b> {{ currentProject?.type || '-' }}</p>
                  <p><b>Supervisor:</b> {{ currentProject?.supervisor || 'Not Assigned Yet' }}</p>
                  <p><b>Examiner:</b> {{ currentProject?.examiner || 'Not Assigned Yet' }}</p>
                  <p><b>Next Action:</b> {{ nextAction }}</p>
                </div>
                <button @click="openCurrentFyp" class="mt-5 bg-[#5c001f] text-white px-5 py-3 rounded-full font-bold">Open My FYP</button>
              </div>
              <div class="rounded-[22px] border border-[#e1d5cc] p-5">
                <p class="text-sm font-bold uppercase tracking-[0.15em] text-[#5c001f]">Submission Status</p>
                <div class="mt-4 divide-y divide-[#e1d5cc] text-sm">
                  <p class="py-3 flex justify-between"><span>Proposal Document</span><b :class="currentProject ? 'text-green-700' : 'text-gray-500'">{{ currentProject ? 'Submitted' : 'Not Submitted' }}</b></p>
                  <p class="py-3 flex justify-between"><span>Admin Form</span><b class="text-gray-500">Not Submitted</b></p>
                  <p class="py-3 flex justify-between"><span>Proposal Presentation</span><b class="text-gray-500">Not Submitted</b></p>
                  <p class="py-3 flex justify-between"><span>Progress Report</span><b class="text-gray-500">Not Submitted</b></p>
                  <p class="py-3 flex justify-between"><span>Final Report</span><b class="text-gray-500">Not Submitted</b></p>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-bold">Latest Activities</h2>
              <Bell class="w-5 h-5 text-[#5c001f]" />
            </div>
            <div class="mt-5 space-y-4 text-sm">
              <div v-for="item in activities" :key="item.text" class="rounded-[18px] bg-[#f7f1ea] border border-[#e1d5cc] p-4 flex gap-3">
                <CheckCircle2 class="w-5 h-5 text-green-700 shrink-0" />
                <div><p class="font-bold">{{ item.text }}</p><p class="text-xs text-gray-500 mt-1">{{ item.date }}</p></div>
              </div>
              <div class="rounded-[18px] bg-[#fff3c4] border border-[#f8be17] p-4 flex gap-3 text-[#5c001f]">
                <Clock3 class="w-5 h-5 shrink-0" />
                <div><p class="font-bold">{{ nextAction }}</p><p class="text-xs mt-1">Dashboard data is loaded from Aiven MySQL.</p></div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
