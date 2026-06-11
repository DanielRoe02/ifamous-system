<script setup>
import { onMounted } from 'vue'
import { useCalendarStore } from '@/stores/calendarStore'

import ViewCalendarComponent from '@/components/calendar_components/ViewCalendarComponent.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import AppFooter from '@/components/AppFooter.vue'

const calendarStore = useCalendarStore()

onMounted(() => {
  calendarStore.fetchActiveSession()
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[#e7ded3] w-full font-['Inter'] text-black">
    <!-- Header -->
    <AppHeader />

    <!-- Main Content Split Layout -->
    <div class="flex flex-1 w-full relative">
      <!-- Side Navigation -->
      <AppSidebar />

      <!-- Main Dashboard Content -->
      <main class="flex-1 flex flex-col px-[50px] py-[30px] gap-8 overflow-y-auto">
        <!-- Heading -->
        <div class="flex items-center justify-between w-full">
          <h1 class="font-['Inter'] font-bold text-[40px] text-black uppercase">CALENDAR</h1>
        </div>

        <!-- Divider -->
        <hr class="border-[#2f2f2f] w-full" />

        <!-- ═══════════════════════════════════════════════════════════════ -->
        <!-- CALENDAR COMPONENT                                             -->
        <!-- ═══════════════════════════════════════════════════════════════ -->
        <div class="w-full">
          <!-- Loading State -->
          <div
            v-if="calendarStore.isLoading"
            class="flex flex-col items-center justify-center min-h-[400px] gap-4 bg-white rounded-xl shadow-md border border-gray-100 p-6"
          >
            <svg
              class="animate-spin h-10 w-10 text-[#5C001F]"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span class="text-sm font-medium text-gray-500">Loading FYP Session Schedule...</span>
          </div>

          <!-- Error State -->
          <div
            v-else-if="calendarStore.error"
            class="flex flex-col items-center justify-center min-h-[400px] gap-2 bg-white rounded-xl shadow-md border border-gray-100 p-6 text-red-600"
          >
            <svg
              class="h-12 w-12 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span class="text-lg font-bold">Failed to Load Schedule</span>
            <span class="text-sm text-gray-500">{{ calendarStore.error }}</span>
            <button
              @click="calendarStore.fetchActiveSession()"
              class="mt-4 px-4 py-2 bg-[#5C001F] text-white rounded-lg text-sm font-semibold hover:bg-[#4a0018]"
            >
              Retry
            </button>
          </div>

          <!-- Calendar View -->
          <div v-else class="w-full">
            <ViewCalendarComponent />
          </div>
        </div>
      </main>
    </div>
    <AppFooter class="mt-auto -mb-[30px]" />
  </div>
</template>
