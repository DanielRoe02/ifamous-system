<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useCalendarStore } from '@/stores/calendarStore'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import AppFooter from '@/components/AppFooter.vue'
import EditSlotModal from '@/components/calendar_components/EditSlotModal.vue'
import { apiService } from '@/services/api'

const { user } = useAuth()
const router = useRouter()
const calendarStore = useCalendarStore()

onMounted(() => {
  if (!calendarStore.sessionData) {
    calendarStore.fetchActiveSession()
  }
})

const selectedScheduleId = ref(null)
const hasUnsavedChanges = ref(false)

const accordions = ref({
  lecturers: true,
  classes: true,
})

const calendarData = ref({
  weekly_recurring_occupancy: [],
  specific_calendar_events: [],
})

const editingOwnerIdentifier = ref('')

const selectSchedule = (newId) => {
  if (selectedScheduleId.value === newId) return
  if (hasUnsavedChanges.value) {
    if (!confirm('You have unsaved changes. Do you want to discard them?')) {
      return
    }
  }
  const tb = calendarStore.sessionData?.timetables.find((t) => t.time_table_id === newId)
  selectedScheduleId.value = newId
  editingOwnerIdentifier.value = tb
    ? tb.class_id != null
      ? tb.section_name
      : tb.staff_email || tb.staff_name || tb.user_id
    : newId
  if (tb && tb.schedule) {
    calendarData.value = {
      weekly_recurring_occupancy: JSON.parse(JSON.stringify(tb.schedule.weekly_recurring || [])),
      specific_calendar_events: JSON.parse(JSON.stringify(tb.schedule.specific_events || [])),
    }
  } else {
    calendarData.value = { weekly_recurring_occupancy: [], specific_calendar_events: [] }
  }
  hasUnsavedChanges.value = false
}

const isSaving = ref(false)

const saveTimeTable = async () => {
  if (!selectedScheduleId.value) return

  const tb = calendarStore.sessionData?.timetables.find(
    (t) => t.time_table_id === selectedScheduleId.value,
  )
  if (!tb) return

  // Parse the input as targetId for updates
  const targetId = parseInt(String(editingOwnerIdentifier.value).trim()) || null
  const newUserId = tb.class_id != null ? null : targetId || tb.user_id
  const newClassId = tb.class_id != null ? targetId || tb.class_id : null

  const newSchedule = {
    weekly_recurring: JSON.parse(JSON.stringify(calendarData.value.weekly_recurring_occupancy)),
    specific_events: JSON.parse(JSON.stringify(calendarData.value.specific_calendar_events)),
  }

  isSaving.value = true
  try {
    await apiService.updateCalendarSchedule(tb.time_table_id, newUserId, newClassId, newSchedule)

    tb.schedule = newSchedule
    if (newUserId !== tb.user_id) tb.user_id = newUserId
    if (newClassId !== tb.class_id) tb.class_id = newClassId

    hasUnsavedChanges.value = false
    alert('Time table saved successfully!')
  } catch (error) {
    console.error('Failed to save time table:', error)
    alert('Failed to save time table. Please try again.')
  } finally {
    isSaving.value = false
  }
}

const deleteTimeTable = async () => {
  if (!selectedScheduleId.value) return
  const confirmation = prompt(
    `Type "${selectedScheduleId.value}" to confirm deletion of this time table:`,
  )
  if (confirmation === selectedScheduleId.value) {
    const tb = calendarStore.sessionData?.timetables.find(
      (t) => t.time_table_id === selectedScheduleId.value,
    )
    if (!tb) return

    isSaving.value = true
    try {
      await apiService.deleteCalendarSchedule(tb.time_table_id)

      calendarStore.sessionData.timetables = calendarStore.sessionData.timetables.filter(
        (t) => t.time_table_id !== selectedScheduleId.value,
      )
      selectedScheduleId.value = null
      editingOwnerIdentifier.value = ''
      calendarData.value = { weekly_recurring_occupancy: [], specific_calendar_events: [] }
      hasUnsavedChanges.value = false
      alert('Time table deleted.')
    } catch (error) {
      console.error('Failed to delete time table:', error)
      alert('Failed to delete time table. Please try again.')
    } finally {
      isSaving.value = false
    }
  } else if (confirmation !== null) {
    alert('Identifier did not match. Deletion cancelled.')
  }
}

const jsDayToJsonDay = (jsDay) => (jsDay === 0 ? 7 : jsDay)

const today = new Date(2026, 4, 7) // May 2026
const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth())

const removeRecurringSlot = (dayOfWeek, slotId) => {
  const day = calendarData.value.weekly_recurring_occupancy.find((d) => d.day_of_week === dayOfWeek)
  if (day) {
    day.slots = day.slots.filter((s) => s.slot_id !== slotId)
    if (day.slots.length === 0) {
      calendarData.value.weekly_recurring_occupancy =
        calendarData.value.weekly_recurring_occupancy.filter((d) => d.day_of_week !== dayOfWeek)
    }
    hasUnsavedChanges.value = true
  }
}

const removeSpecificEvent = (eventId) => {
  calendarData.value.specific_calendar_events = calendarData.value.specific_calendar_events.filter(
    (e) => e.event_id !== eventId,
  )
  hasUnsavedChanges.value = true
}

const editModal = ref({
  isOpen: false,
  type: '',
  dayOfWeek: null,
  slotId: null,
  eventId: null,
  form: {
    title: '',
    startTime: '',
    endTime: '',
  },
})

const openEditModal = (type, item, dayOfWeek = null) => {
  editModal.value.type = type
  editModal.value.isOpen = true

  if (type === 'recurring') {
    editModal.value.dayOfWeek = dayOfWeek
    editModal.value.slotId = item.slot_id
    editModal.value.form.title = item.label
    editModal.value.form.startTime = item.start_time || ''
    editModal.value.form.endTime = item.end_time || ''
  } else {
    editModal.value.eventId = item.event_id
    editModal.value.form.title = item.title
    editModal.value.form.startTime = item.start_time || ''
    editModal.value.form.endTime = item.end_time || ''
  }
}

const handleModalSave = (updatedData) => {
  editModal.value.form = updatedData
  saveEditModal()
}

const saveEditModal = () => {
  let changed = false
  if (editModal.value.type === 'recurring') {
    const day = calendarData.value.weekly_recurring_occupancy.find(
      (d) => d.day_of_week === editModal.value.dayOfWeek,
    )
    if (day) {
      const slot = day.slots.find((s) => s.slot_id === editModal.value.slotId)
      if (slot) {
        slot.label = editModal.value.form.title
        slot.start_time = editModal.value.form.startTime
        slot.end_time = editModal.value.form.endTime
        changed = true
      }
    }
  } else {
    const event = calendarData.value.specific_calendar_events.find(
      (e) => e.event_id === editModal.value.eventId,
    )
    if (event) {
      event.title = editModal.value.form.title
      event.start_time = editModal.value.form.startTime
      event.end_time = editModal.value.form.endTime
      changed = true
    }
  }
  if (changed) hasUnsavedChanges.value = true
  closeEditModal()
}

const closeEditModal = () => {
  editModal.value.isOpen = false
}

const editRecurringSlot = (dayOfWeek, slotId) => {
  const day = calendarData.value.weekly_recurring_occupancy.find((d) => d.day_of_week === dayOfWeek)
  if (!day) return
  const slot = day.slots.find((s) => s.slot_id === slotId)
  if (!slot) return
  openEditModal('recurring', slot, dayOfWeek)
}

const editSpecificEvent = (eventId) => {
  const event = calendarData.value.specific_calendar_events.find((e) => e.event_id === eventId)
  if (!event) return
  openEditModal('specific', event)
}

// Calendar Month logic
const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const dayHeaders = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const activeMonthLabel = computed(() => `${monthNames[currentMonth.value]} ${currentYear.value}`)
const prevMonthLabel = computed(() =>
  currentMonth.value === 0 ? monthNames[11] : monthNames[currentMonth.value - 1],
)
const nextMonthLabel = computed(() =>
  currentMonth.value === 11 ? monthNames[0] : monthNames[currentMonth.value + 1],
)

const goToPrevMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

const goToNextMonth = () => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

const calendarWeeks = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const data = calendarData.value

  const firstDayJS = new Date(year, month, 1).getDay() // 0=Sun, 1=Mon...
  const startOffset = firstDayJS // We want week to start on Sunday

  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: null, events: [], recurringSlots: [] })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dateObj = new Date(year, month, d)
    const jsonDayOfWeek = jsDayToJsonDay(dateObj.getDay())

    const dayEvents = (data.specific_calendar_events || []).filter((e) => e.target_date === dateStr)
    const recurringSlots = []

    for (const entry of data.weekly_recurring_occupancy || []) {
      if (entry.day_of_week === jsonDayOfWeek) {
        for (const slot of entry.slots || []) {
          recurringSlots.push({ ...slot, dayOfWeek: entry.day_of_week })
        }
      }
    }

    cells.push({
      day: d,
      events: dayEvents,
      recurringSlots,
    })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ day: null, events: [], recurringSlots: [] })
  }

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }
  return weeks
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[#e7ded3] w-full font-['Inter'] text-black">
    <AppHeader />
    <div class="flex flex-1 w-full relative">
      <AppSidebar />

      <main class="flex-1 flex flex-col px-[50px] py-[30px] overflow-y-auto">
        <!-- Breadcrumbs -->
        <div class="text-[#5c001f] text-md mb-4">
          <span class="hover:underline cursor-pointer" @click="router.push('/calendar')"
            >Time table</span
          >
          &gt;
          <span class="font-bold underline ml-1">Edit Time Table</span>
        </div>

        <div class="flex flex-col lg:flex-row gap-8 mt-2 h-full">
          <!-- LEFT PANEL (Sidebar for selecting schedule) -->
          <div
            class="w-[300px] flex flex-col bg-[#FFFFAB] border border-gray-200 rounded-xl overflow-hidden shrink-0 relative shadow-sm h-[800px]"
          >
            <div class="p-6 pb-2">
              <h2 class="text-xl font-bold text-[#5C001E] leading-tight">
                Lecturer/section<br />schedule
              </h2>
            </div>

            <!-- Accordion Area (Scrollable) -->
            <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <!-- Accordion 1: STUDENT SCHEDULES (Lecturers) -->
              <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <button
                  @click="accordions.lecturers = !accordions.lecturers"
                  class="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50 transition-colors"
                >
                  <span class="text-xs font-bold text-gray-800 tracking-wider"
                    >STAFF SCHEDULES</span
                  >
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

                  <div
                    v-for="schedule in calendarStore.availableSchedules.lecturers"
                    :key="schedule.id"
                    class="flex items-start gap-3 cursor-pointer group"
                    @click="selectSchedule(schedule.id)"
                  >
                    <input
                      type="radio"
                      :checked="selectedScheduleId === schedule.id"
                      class="mt-1 w-4 h-4 text-[#5C001E] border-gray-300 focus:ring-[#5C001E] cursor-pointer"
                      readonly
                    />
                    <div class="flex items-center gap-2">
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
                  </div>
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

                  <div
                    v-for="schedule in calendarStore.availableSchedules.classes"
                    :key="schedule.id"
                    class="flex items-center gap-3 cursor-pointer group"
                    @click="selectSchedule(schedule.id)"
                  >
                    <input
                      type="radio"
                      :checked="selectedScheduleId === schedule.id"
                      class="w-4 h-4 text-[#5C001E] border-gray-300 focus:ring-[#5C001E] cursor-pointer"
                      readonly
                    />
                    <div class="flex items-center gap-2 text-gray-700 min-w-0">
                      <svg
                        class="w-5 h-5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
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
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- RIGHT PANEL -->
          <div class="flex-1 flex flex-col gap-4">
            <div class="flex justify-between items-start mb-2">
              <h1 class="text-3xl font-bold uppercase tracking-wider">UPDATE TIME TABLE</h1>
              <button
                @click="saveTimeTable"
                :disabled="!selectedScheduleId || isSaving"
                :class="
                  !selectedScheduleId || isSaving
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-[#5c001f] hover:bg-[#4a0019] shadow-lg'
                "
                class="text-white px-8 py-3 rounded-full font-bold transition-colors capitalize"
              >
                {{ isSaving ? 'Saving...' : 'Save time table' }}
              </button>
            </div>

            <!-- Owner Edit & Delete Actions -->
            <div
              v-if="selectedScheduleId"
              class="flex items-end gap-4 p-4 bg-white/60 border border-gray-300 rounded-lg shadow-sm"
            >
              <div class="flex flex-col gap-1 flex-1">
                <label class="text-sm font-medium text-gray-700"
                  >Owner Identifier (Staff Email or Section)</label
                >
                <input
                  v-model="editingOwnerIdentifier"
                  @input="hasUnsavedChanges = true"
                  type="text"
                  class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#5c001f]"
                />
              </div>
              <button
                @click="deleteTimeTable"
                :disabled="isSaving"
                class="px-6 py-2 bg-[#5c001f] text-white font-bold rounded-md hover:bg-[#4a0019] transition-colors h-[42px] shadow-sm flex items-center gap-2"
                :class="{ 'opacity-50 cursor-not-allowed': isSaving }"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete
              </button>
            </div>

            <!-- Calendar Container -->
            <div
              v-if="selectedScheduleId"
              class="bg-[#e7ded3] rounded-lg overflow-hidden shadow-lg border border-gray-300 relative"
            >
              <div class="flex items-center justify-between p-4 bg-white/50">
                <button
                  @click="goToPrevMonth"
                  class="text-black font-bold hover:text-[#5c001f] transition-colors flex items-center gap-2"
                >
                  <span>&lt;</span> {{ prevMonthLabel }}
                </button>
                <div class="flex items-center gap-4">
                  <h2 class="text-2xl font-bold text-[#5c001f]">{{ activeMonthLabel }}</h2>
                  <div class="flex bg-[#5c001f] rounded-lg text-white text-xs overflow-hidden">
                    <span class="px-4 py-1.5 bg-white text-[#5c001f] font-bold">Month</span>
                    <span class="px-4 py-1.5 font-bold opacity-70">Week</span>
                  </div>
                </div>
                <button
                  @click="goToNextMonth"
                  class="text-black font-bold hover:text-[#5c001f] transition-colors flex items-center gap-2"
                >
                  {{ nextMonthLabel }} <span>&gt;</span>
                </button>
              </div>

              <!-- Calendar Grid -->
              <div class="w-full bg-[#5c001f] text-white">
                <div class="grid grid-cols-7">
                  <div
                    v-for="header in dayHeaders"
                    :key="header"
                    class="p-3 text-center font-bold text-sm border-r border-white/20 last:border-r-0"
                  >
                    {{ header }}
                  </div>
                </div>
              </div>

              <div class="bg-[#f0ece9]">
                <div
                  v-for="(week, wIdx) in calendarWeeks"
                  :key="wIdx"
                  class="grid grid-cols-7 border-b border-gray-300 last:border-b-0"
                >
                  <div
                    v-for="(cell, dIdx) in week"
                    :key="dIdx"
                    class="min-h-[120px] border-r border-gray-300 last:border-r-0 p-1 flex flex-col gap-1 relative"
                    :class="
                      !cell.day ? 'bg-gray-200/50' : 'bg-white hover:bg-gray-50 transition-colors'
                    "
                  >
                    <span v-if="cell.day" class="text-sm font-medium pl-1 mt-1 text-gray-700">{{
                      cell.day
                    }}</span>

                    <!-- Render slots -->
                    <template v-if="cell.day">
                      <div
                        v-for="slot in cell.recurringSlots"
                        :key="slot.slot_id"
                        @click="editRecurringSlot(slot.dayOfWeek, slot.slot_id)"
                        class="bg-[#e85d04] text-white rounded p-1.5 text-[10px] leading-tight flex flex-col cursor-pointer hover:opacity-90 relative group shadow-sm"
                      >
                        <span class="font-bold">{{ slot.start_time }} - {{ slot.end_time }}</span>
                        <span class="truncate mt-0.5">{{ slot.label }}</span>
                      </div>
                      <div
                        v-for="event in cell.events"
                        :key="event.event_id"
                        @click="editSpecificEvent(event.event_id)"
                        class="bg-[#e85d04] text-white rounded p-1.5 text-[10px] leading-tight flex flex-col cursor-pointer hover:opacity-90 relative group shadow-sm"
                      >
                        <span class="font-bold" v-if="event.start_time"
                          >{{ event.start_time }} - {{ event.end_time }}</span
                        >
                        <span class="truncate mt-0.5">{{ event.title }}</span>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty State -->
            <div
              v-else
              class="flex-1 bg-white/50 rounded-xl border border-gray-300 flex items-center justify-center shadow-inner min-h-[500px]"
            >
              <p class="text-xl text-gray-500 font-bold">
                Please select a time table from the left menu to edit.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
    <AppFooter class="mt-auto -mb-[30px]" />

    <!-- Edit Modal Component -->
    <EditSlotModal
      :isOpen="editModal.isOpen"
      :initialData="editModal.form"
      @save="handleModalSave"
      @close="closeEditModal"
    />
  </div>
</template>
