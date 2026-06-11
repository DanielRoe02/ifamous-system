<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import AppHeader from '@/components/AppHeader.vue'
import NavigationButton from '@/components/NavigationButton.vue'
import StatsCard from '@/components/StatsCard.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import CreateSessionModal from '@/components/CreateSessionModal.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import AppFooter from '@/components/AppFooter.vue'
import { useCalendarStore } from '@/stores/calendarStore'

const { user } = useAuth()
const router = useRouter()
const isModalOpen = ref(false)

const handleSessionCreated = () => {
  isModalOpen.value = false
  router.push('/manage-session')
}

const calendarStore = useCalendarStore()

onMounted(() => {
  calendarStore.fetchActiveSession()
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[#e7ded3] w-full font-['Inter'] text-black">
    <!-- Header -->
    <AppHeader />

    <!-- Access Denied View for Non-Coordinators -->
    <div
      v-if="!user || Number(user.is_coordinator) !== 1"
      class="flex-1 flex flex-col items-center justify-center text-center px-4"
    >
      <h1 class="text-4xl font-bold text-[#5c001f] mb-4">Access Restricted</h1>
      <p class="text-xl text-gray-700 mb-6">
        You do not have coordinator permissions to view this dashboard.
      </p>
    </div>

    <!-- Main Content Split Layout for Coordinators -->
    <div v-else class="flex flex-1 w-full relative">
      <!-- Side Navigation -->
      <AppSidebar />

      <!-- Main Dashboard Content -->
      <main class="flex-1 flex flex-col px-[50px] py-[30px] gap-8 overflow-y-auto">
        <!-- Session Heading & Action -->
        <div class="flex items-center justify-between w-full">
          <h1 class="font-['Inter'] font-bold text-[40px] text-black uppercase">
            {{
              calendarStore.isLoading
                ? 'Loading session...'
                : calendarStore.activeSessionId
                  ? 'Session ' + calendarStore.activeSessionId
                  : 'No active session'
            }}
          </h1>
          <button
            @click="isModalOpen = true"
            class="bg-[#5c001f] text-white px-[24px] py-[16px] rounded-[8px] font-medium text-[16px] hover:bg-[#4a0019] transition-colors shadow-lg border-none"
          >
            Create New Session
          </button>
        </div>

        <!-- Divider -->
        <hr class="border-[#2f2f2f] w-full" />

        <!-- Quick Stats Cards (Color coded) -->
        <div
          class="bg-white rounded-[15px] p-[20px] flex flex-col gap-4 shadow-lg w-full border-none"
        >
          <h2 class="font-['Inter'] font-bold text-[32px] text-black">Quick Stats</h2>
          <div class="flex gap-[20px] w-full">
            <!-- Total Projects -->
            <div
              class="bg-[#00b424] rounded-[15px] p-[15px] flex items-start justify-between flex-1 shadow-md"
            >
              <div>
                <p class="font-bold text-[14px] text-white">Total Projects</p>
                <p class="font-bold text-[24px] text-white mt-4">0</p>
              </div>
            </div>
            <!-- Needing Supervisor -->
            <div
              class="bg-[#ffe100] rounded-[15px] p-[15px] flex items-start justify-between flex-1 shadow-md"
            >
              <div>
                <p class="font-bold text-[14px] text-black">Needing Supervisor</p>
                <p class="font-bold text-[24px] text-black mt-4">0</p>
              </div>
            </div>
            <!-- Missed Deadline -->
            <div
              class="bg-[#ff3737] rounded-[15px] p-[15px] flex items-start justify-between flex-1 shadow-md"
            >
              <div>
                <p class="font-bold text-[14px] text-white">Missed deadline</p>
                <p class="font-bold text-[24px] text-white mt-4">0</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Users & Data Manager -->
        <div class="bg-white rounded-[25px] p-[30px] flex flex-col gap-[20px] shadow-lg w-full">
          <div>
            <h2 class="font-['Inter'] font-bold text-[32px] text-black">Users & Data Manager</h2>
            <p class="text-[20px] text-gray-700 mt-2">Current users in this system:</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-[20px] w-full">
            <StatsCard amount="12" label="User" />
            <StatsCard amount="1" label="Student" />
            <StatsCard amount="3" label="Staff" />
            <StatsCard amount="4" label="Examiner" />
          </div>

          <button
            class="bg-[#5c001f] text-white px-[24px] py-[12px] rounded-full font-medium text-[16px] hover:bg-[#4a0019] transition-colors self-start mt-4 shadow-md"
          >
            Manage Users & Data Import
          </button>
        </div>

        <!-- Alerts Table -->
        <div
          class="bg-white rounded-[25px] p-[30px] flex flex-col gap-[15px] shadow-lg w-full mb-10"
        >
          <h2 class="font-['Inter'] font-bold text-[32px] text-black">Alerts</h2>

          <div class="border-2 border-black rounded-[5px] overflow-hidden">
            <!-- Table Header -->
            <div class="bg-white flex justify-between p-[16px] border-b-2 border-black">
              <div class="flex-1 font-bold text-[14px] text-center">Alert Type</div>
              <div class="flex-1 font-bold text-[14px] text-center">Affected User</div>
              <div class="flex-1 font-bold text-[14px] text-center">Status</div>
            </div>

            <!-- Table Row -->
            <div class="bg-[#f7f6fe] flex justify-between items-center p-[16px]">
              <div class="flex-1 text-[14px] font-medium text-center text-black">
                Proposal Submitted
              </div>
              <div class="flex-1 text-[14px] font-medium text-center text-black">
                Matt Dickerson
              </div>
              <div class="flex-1 flex justify-center">
                <StatusBadge status="Proposal Submitted" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
    <!-- Footer -->
    <AppFooter class="mt-auto -mb-[30px]" />

    <!-- Create Session Modal -->
    <CreateSessionModal
      v-if="isModalOpen"
      @close="isModalOpen = false"
      @create="handleSessionCreated"
    />
  </div>
</template>
