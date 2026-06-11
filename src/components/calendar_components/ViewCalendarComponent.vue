<template>
  <div class="flex flex-col lg:flex-row gap-6 h-full min-h-[800px] w-full font-sans">
    <!-- 1. LEFT SIDEBAR (FILTERS) -->
    <aside
      class="w-full lg:w-80 flex flex-col bg-[#FFFFAB] border border-gray-200 rounded-xl overflow-hidden shrink-0 relative shadow-sm"
    >
      <!-- Sidebar Header -->
      <div class="p-6 pb-2">
        <h2 class="text-xl font-bold text-[#5C001E] leading-tight">
          Lecturer/section<br />schedule
        </h2>
      </div>

      <!-- Accordion Area (Scrollable) -->
      <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <!-- Accordion 1: STAFF SCHEDULES (Lecturers) -->
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <button
            @click="accordions.lecturers = !accordions.lecturers"
            class="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50 transition-colors"
          >
            <span class="text-xs font-bold text-gray-800 tracking-wider">STAFF SCHEDULES</span>
            <svg
              class="w-4 h-4 text-gray-600 transition-transform duration-200"
              :class="{ 'rotate-180': accordions.lecturers }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          <div v-show="accordions.lecturers" class="border-t border-gray-100 p-3 space-y-3">
            <div
              v-if="calendarStore.availableSchedules.lecturers.length === 0"
              class="text-xs text-gray-400"
            >
              No lecturer schedules
            </div>

            <label
              v-for="schedule in calendarStore.availableSchedules.lecturers"
              :key="schedule.id"
              class="flex items-start gap-3 cursor-pointer group"
            >
              <input
                type="checkbox"
                v-model="calendarStore.selectedSchedules"
                :value="schedule.id"
                class="mt-1 w-4 h-4 text-[#5C001E] rounded border-gray-300 focus:ring-[#5C001E] cursor-pointer"
              />
              <div class="flex items-center gap-2">
                <!-- Color Indicator -->
                <div
                  class="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0"
                  :style="{ backgroundColor: schedule.color }"
                ></div>
                <!-- Avatar Mock -->
                <div
                  class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden shrink-0"
                >
                  <svg class="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
                <div class="flex flex-col min-w-0">
                  <span
                    class="text-xs font-medium text-gray-900 truncate"
                    :title="schedule.label"
                    >{{ schedule.label }}</span
                  >
                </div>
              </div>
            </label>
          </div>
        </div>

        <!-- Accordion 2: CLASS SECTIONS -->
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <button
            @click="accordions.classes = !accordions.classes"
            class="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50 transition-colors"
          >
            <span class="text-xs font-bold text-gray-800 tracking-wider">CLASS SECTIONS</span>
            <svg
              class="w-4 h-4 text-gray-600 transition-transform duration-200"
              :class="{ 'rotate-180': accordions.classes }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          <div v-show="accordions.classes" class="border-t border-gray-100 p-3 space-y-3">
            <div
              v-if="calendarStore.availableSchedules.classes.length === 0"
              class="text-xs text-gray-400"
            >
              No class sections
            </div>

            <label
              v-for="schedule in calendarStore.availableSchedules.classes"
              :key="schedule.id"
              class="flex items-center gap-3 cursor-pointer group"
            >
              <input
                type="checkbox"
                v-model="calendarStore.selectedSchedules"
                :value="schedule.id"
                class="w-4 h-4 text-[#5C001E] rounded border-gray-300 focus:ring-[#5C001E] cursor-pointer"
              />
              <div class="flex items-center gap-2 text-gray-700 min-w-0">
                <!-- Color Indicator -->
                <div
                  class="w-2.5 h-2.5 rounded-full shrink-0"
                  :style="{ backgroundColor: schedule.color }"
                ></div>
                <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <span class="text-sm font-medium truncate" :title="schedule.label">{{
                  schedule.label
                }}</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->

      <div class="p-4 flex flex-col gap-2 mt-auto border-t border-[#d6d68b]">
        <router-link
          to="/add-time-table"
          class="w-full bg-[#5C001E] hover:bg-[#4a0018] text-white font-bold py-3 rounded-md shadow text-xs transition-colors flex justify-center items-center gap-2"
        >
          <span>+</span> Add new time table
        </router-link>
        <router-link
          to="/edit-time-table"
          class="w-full bg-[#5C001E] hover:bg-[#4a0018] text-white font-bold py-3 rounded-md shadow text-xs transition-colors flex justify-center items-center gap-2"
        >
          <span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              class="bi bi-pencil-fill"
              viewBox="0 0 16 16"
            >
              <path
                d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.5.5 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11z"
              />
            </svg>
          </span>
          Edit time table
        </router-link>
      </div>
    </aside>

    <!-- 2. MAIN CONTENT (CALENDAR) -->
    <div class="flex-1 min-w-0">
      <CalendarSchedule :events="calendarStore.visibleEvents" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useCalendarStore } from '@/stores/calendarStore'
import CalendarSchedule from '@/components/calendar_components/CalendarSchedule.vue'

const calendarStore = useCalendarStore()

// --- ACCORDION STATE ---
const accordions = ref({
  lecturers: true,
  classes: true,
})
</script>
