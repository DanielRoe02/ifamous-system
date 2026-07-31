<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import AppHeader from '@/components/AppHeader.vue'
import CreateSessionModal from '@/components/CreateSessionModal.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import AppFooter from '@/components/AppFooter.vue'
import { useCalendarStore } from '@/stores/calendarStore'
import {
  FolderKanban,
  Users,
  CalendarDays,
  AlertTriangle,
  UserPlus,
  UploadCloud,
  FileDown,
  Clock,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  ShieldCheck,
  Sparkles,
} from 'lucide-vue-next'

const { user } = useAuth()
const router = useRouter()
const isModalOpen = ref(false)

const calendarStore = useCalendarStore()

const handleSessionCreated = () => {
  isModalOpen.value = false
  router.push('/manage-session')
}

const goTo = (path) => {
  router.push(path)
}

onMounted(() => {
  calendarStore.fetchActiveSession()
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[#e7ded3] w-full font-['Inter'] text-black">
    <AppHeader />

    <!-- Access Denied View for Non-Coordinators -->
    <div
      v-if="!user || Number(user.is_coordinator) !== 1"
      class="flex-1 flex flex-col items-center justify-center text-center px-4"
    >
      <div class="bg-white rounded-[28px] shadow-xl border border-black/10 px-10 py-12 max-w-xl">
        <div
          class="w-16 h-16 rounded-2xl bg-[#5c001f] mx-auto mb-5 flex items-center justify-center"
        >
          <ShieldCheck class="w-8 h-8 text-[#f8be17]" />
        </div>
        <h1 class="text-4xl font-bold text-[#5c001f] mb-4">Access Restricted</h1>
        <p class="text-lg text-gray-700">
          You do not have coordinator permissions to view this dashboard.
        </p>
      </div>
    </div>

    <!-- Main Content Split Layout for Coordinators -->
    <div v-else class="flex flex-1 w-full relative">
      <AppSidebar />

      <!-- Main Dashboard Content -->
      <main class="flex-1 flex flex-col px-[50px] py-[30px] gap-8 overflow-y-auto">
        <!-- Hero / Dashboard Header -->
        <section
          class="relative overflow-hidden rounded-[32px] bg-[#5c001f] text-white shadow-xl border border-black/10"
        >
          <div class="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[#f8be17]/20"></div>
          <div class="absolute right-20 bottom-[-70px] w-40 h-40 rounded-full bg-white/10"></div>

          <div class="relative p-8 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
            <div>
              <div class="flex items-center gap-3 mb-4">
                <div
                  class="w-12 h-12 rounded-2xl bg-[#f8be17] flex items-center justify-center shadow-md"
                >
                  <BarChart3 class="w-7 h-7 text-[#5c001f]" />
                </div>
                <div>
                  <p class="text-[#f8be17] font-bold text-sm uppercase tracking-[0.2em]">
                    I-FAMOUS Coordinator
                  </p>
                  <h1 class="font-bold text-[36px] leading-tight">Dashboard Overview</h1>
                </div>
              </div>

              <p class="text-white/80 max-w-3xl text-[16px] leading-relaxed">
                Monitor FYP sessions, proposal progress, user data, timetable readiness, and AI
                assisted coordination from one centralized workspace.
              </p>
            </div>

            <div class="flex flex-col sm:flex-row gap-3">
              <button
                @click="isModalOpen = true"
                class="bg-[#f8be17] text-[#5c001f] px-6 py-3 rounded-full font-bold hover:bg-[#ffd45a] transition-colors shadow-md border-none flex items-center gap-2"
              >
                <CalendarDays class="w-5 h-5" />
                Create Session
              </button>

              <button
                @click="goTo('/manage-fyp')"
                class="bg-white/10 text-white px-6 py-3 rounded-full font-bold hover:bg-white/20 transition-colors border border-white/20 flex items-center gap-2"
              >
                <Sparkles class="w-5 h-5 text-[#f8be17]" />
                Manage FYP
              </button>
            </div>
          </div>
        </section>

        <!-- Current Session + AI Status -->
        <section class="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div class="xl:col-span-2 bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
                  Active Session
                </p>
                <h2 class="text-[34px] font-bold mt-2">
                  {{
                    calendarStore.isLoading
                      ? 'Loading session...'
                      : calendarStore.activeSessionId
                        ? 'Session ' + calendarStore.activeSessionId
                        : 'No active session'
                  }}
                </h2>
                <p class="text-gray-600 mt-2">
                  Active session controls the calendar, timetable, FYP project assignment, and
                  coordinator monitoring workflow.
                </p>
              </div>

              <div
                class="w-16 h-16 rounded-2xl bg-[#e7ded3] flex items-center justify-center shrink-0"
              >
                <Clock class="w-8 h-8 text-[#5c001f]" />
              </div>
            </div>

            <div class="mt-6 flex flex-wrap gap-3">
              <span
                class="px-4 py-2 rounded-full bg-green-100 text-green-700 font-bold text-sm flex items-center gap-2"
              >
                <CheckCircle2 class="w-4 h-4" />
                System Online
              </span>
              <span
                class="px-4 py-2 rounded-full bg-[#fff3c4] text-[#5c001f] font-bold text-sm flex items-center gap-2"
              >
                <Sparkles class="w-4 h-4" />
                AI Assistant Ready
              </span>
              <span
                class="px-4 py-2 rounded-full bg-[#e7ded3] text-gray-700 font-bold text-sm flex items-center gap-2"
              >
                <ShieldCheck class="w-4 h-4" />
                Coordinator Access
              </span>
            </div>
          </div>

          <div class="bg-[#f8be17] rounded-[28px] p-7 shadow-lg border border-black/10">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
                  AI Workflow
                </p>
                <h3 class="text-[28px] font-bold text-[#5c001f] mt-2">Supervisor Matching</h3>
              </div>
              <Sparkles class="w-12 h-12 text-[#5c001f]" />
            </div>
            <p class="text-[#5c001f]/80 mt-4 text-sm leading-relaxed">
              Next prototype module: upload or enter proposal details, compare with lecturer
              expertise, and recommend the best supervisor.
            </p>
            <button
              @click="goTo('/manage-fyp')"
              class="mt-5 bg-[#5c001f] text-white px-5 py-3 rounded-full font-bold hover:bg-[#4a0019] transition-colors border-none flex items-center gap-2"
            >
              Open Manage FYP
              <ArrowRight class="w-4 h-4" />
            </button>
          </div>
        </section>

        <!-- Stats Cards -->
        <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div class="bg-white rounded-[26px] p-6 shadow-lg border border-black/10">
            <div class="flex items-center justify-between">
              <div class="w-13 h-13 rounded-2xl bg-[#5c001f] p-3 flex items-center justify-center">
                <FolderKanban class="w-7 h-7 text-[#f8be17]" />
              </div>
              <span class="text-xs font-bold text-green-700 bg-green-100 px-3 py-1 rounded-full">
                Active
              </span>
            </div>
            <p class="text-gray-500 font-semibold mt-5">Total FYP Projects</p>
            <h3 class="text-[34px] font-bold text-black mt-1">12</h3>
            <p class="text-sm text-gray-500 mt-2">Projects currently tracked in this session.</p>
          </div>

          <div class="bg-white rounded-[26px] p-6 shadow-lg border border-black/10">
            <div class="flex items-center justify-between">
              <div class="w-13 h-13 rounded-2xl bg-[#5c001f] p-3 flex items-center justify-center">
                <Users class="w-7 h-7 text-[#f8be17]" />
              </div>
              <span class="text-xs font-bold text-[#5c001f] bg-[#fff3c4] px-3 py-1 rounded-full">
                Users
              </span>
            </div>
            <p class="text-gray-500 font-semibold mt-5">Registered Users</p>
            <h3 class="text-[34px] font-bold text-black mt-1">13</h3>
            <p class="text-sm text-gray-500 mt-2">Students, lecturers, examiners, and outsiders.</p>
          </div>

          <div class="bg-white rounded-[26px] p-6 shadow-lg border border-black/10">
            <div class="flex items-center justify-between">
              <div class="w-13 h-13 rounded-2xl bg-[#5c001f] p-3 flex items-center justify-center">
                <CalendarDays class="w-7 h-7 text-[#f8be17]" />
              </div>
              <span class="text-xs font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
                Calendar
              </span>
            </div>
            <p class="text-gray-500 font-semibold mt-5">Timetables</p>
            <h3 class="text-[34px] font-bold text-black mt-1">9</h3>
            <p class="text-sm text-gray-500 mt-2">Lecturer and class timetable records imported.</p>
          </div>

          <div class="bg-white rounded-[26px] p-6 shadow-lg border border-black/10">
            <div class="flex items-center justify-between">
              <div class="w-13 h-13 rounded-2xl bg-red-100 p-3 flex items-center justify-center">
                <AlertTriangle class="w-7 h-7 text-red-600" />
              </div>
              <span class="text-xs font-bold text-red-700 bg-red-100 px-3 py-1 rounded-full">
                Alert
              </span>
            </div>
            <p class="text-gray-500 font-semibold mt-5">Pending Assignment</p>
            <h3 class="text-[34px] font-bold text-black mt-1">3</h3>
            <p class="text-sm text-gray-500 mt-2">Projects need supervisor or examiner review.</p>
          </div>
        </section>

        <!-- Main Dashboard Panels -->
        <section class="grid grid-cols-1 2xl:grid-cols-3 gap-6">
          <!-- Recent Projects -->
          <div class="2xl:col-span-2 bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
            <div class="flex items-center justify-between gap-4 mb-6">
              <div>
                <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
                  Project Monitoring
                </p>
                <h2 class="text-[28px] font-bold mt-1">Recent FYP Projects</h2>
              </div>

              <button
                @click="goTo('/manage-fyp')"
                class="bg-[#5c001f] text-white px-5 py-2.5 rounded-full font-bold hover:bg-[#4a0019] transition-colors border-none flex items-center gap-2"
              >
                View All
                <ArrowRight class="w-4 h-4" />
              </button>
            </div>

            <div class="overflow-hidden rounded-[20px] border border-gray-200">
              <table class="w-full text-left">
                <thead class="bg-[#5c001f] text-white">
                  <tr>
                    <th class="px-5 py-4 text-sm font-bold">Student</th>
                    <th class="px-5 py-4 text-sm font-bold">Project Title</th>
                    <th class="px-5 py-4 text-sm font-bold">Supervisor</th>
                    <th class="px-5 py-4 text-sm font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-b border-gray-100 bg-white hover:bg-[#fff8df] transition-colors">
                    <td class="px-5 py-4 font-semibold">Ali bin Abu</td>
                    <td class="px-5 py-4 text-gray-700">AI-Based Project Recommendation</td>
                    <td class="px-5 py-4 text-gray-700">Dr Ali</td>
                    <td class="px-5 py-4">
                      <span class="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                        Assigned
                      </span>
                    </td>
                  </tr>

                  <tr class="border-b border-gray-100 bg-white hover:bg-[#fff8df] transition-colors">
                    <td class="px-5 py-4 font-semibold">Wong Mei Ling</td>
                    <td class="px-5 py-4 text-gray-700">Smart Timetable Conflict Detection</td>
                    <td class="px-5 py-4 text-gray-700">Pending</td>
                    <td class="px-5 py-4">
                      <span class="px-3 py-1 rounded-full bg-[#fff3c4] text-[#5c001f] text-xs font-bold">
                        Needs Match
                      </span>
                    </td>
                  </tr>

                  <tr class="bg-white hover:bg-[#fff8df] transition-colors">
                    <td class="px-5 py-4 font-semibold">Siti Nurhaliza</td>
                    <td class="px-5 py-4 text-gray-700">IoT-Based Academic Monitoring System</td>
                    <td class="px-5 py-4 text-gray-700">Dr Siti</td>
                    <td class="px-5 py-4">
                      <span class="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                        In Review
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Recent Activity -->
          <div class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
            <div>
              <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
                Activity
              </p>
              <h2 class="text-[28px] font-bold mt-1">Recent Updates</h2>
            </div>

            <div class="mt-6 flex flex-col gap-4">
              <div class="flex gap-4">
                <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 class="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <p class="font-bold text-sm">Session 25262 is active</p>
                  <p class="text-xs text-gray-500 mt-1">System session loaded successfully.</p>
                </div>
              </div>

              <div class="flex gap-4">
                <div class="w-10 h-10 rounded-full bg-[#fff3c4] flex items-center justify-center">
                  <UploadCloud class="w-5 h-5 text-[#5c001f]" />
                </div>
                <div>
                  <p class="font-bold text-sm">Timetable records imported</p>
                  <p class="text-xs text-gray-500 mt-1">Lecturer and class schedules are ready.</p>
                </div>
              </div>

              <div class="flex gap-4">
                <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Sparkles class="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <p class="font-bold text-sm">AI workflow prepared</p>
                  <p class="text-xs text-gray-500 mt-1">
                    Supervisor matching module can be connected next.
                  </p>
                </div>
              </div>

              <div class="flex gap-4">
                <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle class="w-5 h-5 text-red-700" />
                </div>
                <div>
                  <p class="font-bold text-sm">3 projects require action</p>
                  <p class="text-xs text-gray-500 mt-1">
                    Coordinator review is required before assignment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Quick Actions -->
        <section class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10 mb-10">
          <div class="flex items-center justify-between mb-6">
            <div>
              <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
                Coordinator Tools
              </p>
              <h2 class="text-[28px] font-bold mt-1">Quick Actions</h2>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            <button
              @click="goTo('/manage-user')"
              class="group text-left bg-[#e7ded3] hover:bg-[#5c001f] rounded-[22px] p-5 transition-all border border-black/10"
            >
              <UserPlus class="w-8 h-8 text-[#5c001f] group-hover:text-[#f8be17]" />
              <h3 class="font-bold text-lg mt-4 group-hover:text-white">Manage Users</h3>
              <p class="text-sm text-gray-600 mt-1 group-hover:text-white/70">
                Create staff, examiner, and external user records.
              </p>
            </button>

            <button
              @click="goTo('/manage-fyp')"
              class="group text-left bg-[#e7ded3] hover:bg-[#5c001f] rounded-[22px] p-5 transition-all border border-black/10"
            >
              <FolderKanban class="w-8 h-8 text-[#5c001f] group-hover:text-[#f8be17]" />
              <h3 class="font-bold text-lg mt-4 group-hover:text-white">Manage FYP</h3>
              <p class="text-sm text-gray-600 mt-1 group-hover:text-white/70">
                Review projects and prepare AI supervisor matching.
              </p>
            </button>

            <button
              @click="goTo('/add-time-table')"
              class="group text-left bg-[#e7ded3] hover:bg-[#5c001f] rounded-[22px] p-5 transition-all border border-black/10"
            >
              <UploadCloud class="w-8 h-8 text-[#5c001f] group-hover:text-[#f8be17]" />
              <h3 class="font-bold text-lg mt-4 group-hover:text-white">Add Timetable</h3>
              <p class="text-sm text-gray-600 mt-1 group-hover:text-white/70">
                Upload or manually enter lecturer/class schedules.
              </p>
            </button>

            <button
              @click="goTo('/export')"
              class="group text-left bg-[#e7ded3] hover:bg-[#5c001f] rounded-[22px] p-5 transition-all border border-black/10"
            >
              <FileDown class="w-8 h-8 text-[#5c001f] group-hover:text-[#f8be17]" />
              <h3 class="font-bold text-lg mt-4 group-hover:text-white">Export Report</h3>
              <p class="text-sm text-gray-600 mt-1 group-hover:text-white/70">
                Generate coordinator reports for records.
              </p>
            </button>
          </div>
        </section>
      </main>
    </div>

    <AppFooter class="mt-auto -mb-[30px]" />

    <CreateSessionModal
      v-if="isModalOpen"
      @close="isModalOpen = false"
      @create="handleSessionCreated"
    />
  </div>
</template>
