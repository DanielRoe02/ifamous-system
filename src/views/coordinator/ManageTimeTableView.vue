<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import AppFooter from '@/components/AppFooter.vue'
import EditSlotModal from '@/components/calendar_components/EditSlotModal.vue'
import { apiService } from '@/services/api'
import { useCalendarStore } from '@/stores/calendarStore'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const { user } = useAuth()
const router = useRouter()
const calendarStore = useCalendarStore()

const targetType = ref('Lecturer')
const targetName = ref('')
const entryMode = ref('manual')

const manualForm = ref({
  label: '',
  startWeekday: 1,
  startTime: '',
  endTime: '',
  isRecurring: true,
})

const calendarData = ref({
  weekly_recurring_occupancy: [],
  specific_calendar_events: [],
})

const isUploading = ref(false)
const uploadError = ref('')

const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  uploadError.value = ''

  if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
    uploadError.value = 'Invalid file type. Please upload a PNG or JPEG.'
    return
  }

  isUploading.value = true

  try {
    const formData = new FormData()
    formData.append('image', file)

    const response = await fetch(`${API_BASE_URL}/api/assistant/analyze-timetable`, {
      method: 'POST',
      body: formData,
    })

    const result = await response.json()

    if (response.ok && result.success) {
      if (result.data.target_type) targetType.value = result.data.target_type
      if (result.data.target_name) targetName.value = result.data.target_name

      calendarData.value.weekly_recurring_occupancy = []
      calendarData.value.specific_calendar_events = []

      const newRecurring = result.data.weekly_recurring || []
      const newSpecific = result.data.specific_events || []

      newRecurring.forEach((day) => {
        if (day.slots) {
          day.slots.forEach((slot) => {
            slot.slot_id = Date.now().toString() + '_' + Math.random().toString(36).substring(7)
          })
        }
      })

      newSpecific.forEach((event) => {
        event.event_id = Date.now().toString() + '_' + Math.random().toString(36).substring(7)
      })

      newRecurring.forEach((newDay) => {
        const existingDay = calendarData.value.weekly_recurring_occupancy.find(
          (d) => d.day_of_week === newDay.day_of_week,
        )

        if (existingDay) {
          if (newDay.slots) {
            existingDay.slots.push(...newDay.slots)
          }
        } else {
          calendarData.value.weekly_recurring_occupancy.push(newDay)
        }
      })

      calendarData.value.specific_calendar_events.push(...newSpecific)
    } else {
      uploadError.value = result.error || 'Failed to process image'
    }
  } catch (error) {
    console.error('Upload error:', error)
    uploadError.value = 'An error occurred while uploading. Please ensure the backend is running.'
  } finally {
    isUploading.value = false
    event.target.value = ''
  }
}

const jsDayToJsonDay = (jsDay) => (jsDay === 0 ? 7 : jsDay)

const isCreating = ref(false)

const searchResults = ref([])
const showDropdown = ref(false)
const selectedTargetId = ref(null)

let searchTimeout = null

watch(targetName, (newVal) => {
  if (
    selectedTargetId.value &&
    newVal !== searchResults.value.find((r) => r.id === selectedTargetId.value)?.value
  ) {
    selectedTargetId.value = null
  }

  if (newVal.length >= 3 && !selectedTargetId.value) {
    clearTimeout(searchTimeout)

    searchTimeout = setTimeout(async () => {
      try {
        const sessionId = calendarStore.activeSessionId

        if (targetType.value === 'Lecturer') {
          const results = await apiService.searchUsers(newVal, sessionId)

          searchResults.value = results.map((u) => ({
            id: u.user_id,
            label: `${u.full_name} (${u.email})`,
            value: u.email,
          }))
        } else {
          const results = await apiService.searchClasses(newVal, sessionId)

          searchResults.value = results.map((c) => ({
            id: c.class_id,
            label: c.section_name,
            value: c.section_name,
          }))
        }

        showDropdown.value = true
      } catch (error) {
        console.error(error)
      }
    }, 300)
  } else {
    showDropdown.value = false
  }
})

const selectSearchResult = (result) => {
  targetName.value = result.value
  selectedTargetId.value = result.id
  showDropdown.value = false
}

const createTimeTable = async () => {
  if (!selectedTargetId.value) {
    alert('Please search and select a valid identifier from the dropdown.')
    return
  }

  if (!calendarStore.activeSessionId) {
    await calendarStore.fetchActiveSession()
  }

  const fypSessionId = calendarStore.activeSessionId

  if (!fypSessionId) {
    alert('No active session found. Please set an active session first.')
    return
  }

  const targetId = selectedTargetId.value
  const userId = targetType.value === 'Lecturer' ? targetId : null
  const classId = targetType.value === 'Section Class' ? targetId : null

  const scheduleJson = {
    weekly_recurring: calendarData.value.weekly_recurring_occupancy,
    specific_events: calendarData.value.specific_calendar_events,
  }

  isCreating.value = true

  try {
    await apiService.createCalendarSchedule(fypSessionId, userId, classId, scheduleJson)
    alert('Time table created successfully!')
    router.push('/calendar')
  } catch (error) {
    console.error('Failed to create time table:', error)
    alert('Failed to create time table. Please try again.')
  } finally {
    isCreating.value = false
  }
}

const today = new Date(2026, 4, 7)
const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth())

const addManualEntry = () => {
  if (!manualForm.value.label || !manualForm.value.startTime || !manualForm.value.endTime) return

  const newSlotId = Date.now().toString()

  if (manualForm.value.isRecurring) {
    const newSlot = {
      slot_id: newSlotId,
      start_time: manualForm.value.startTime,
      end_time: manualForm.value.endTime,
      label: manualForm.value.label,
      location: '',
    }

    const existingDay = calendarData.value.weekly_recurring_occupancy.find(
      (d) => d.day_of_week === manualForm.value.startWeekday,
    )

    if (existingDay) {
      existingDay.slots.push(newSlot)
    } else {
      const dayNames = {
        1: 'Monday',
        2: 'Tuesday',
        3: 'Wednesday',
        4: 'Thursday',
        5: 'Friday',
        6: 'Saturday',
        7: 'Sunday',
      }

      calendarData.value.weekly_recurring_occupancy.push({
        day_of_week: manualForm.value.startWeekday,
        day_name: dayNames[manualForm.value.startWeekday],
        slots: [newSlot],
      })
    }
  } else {
    const year = currentYear.value
    const month = currentMonth.value
    let targetDate = ''

    for (let d = 1; d <= 31; d++) {
      const dateObj = new Date(year, month, d)

      if (dateObj.getMonth() !== month) break

      if (jsDayToJsonDay(dateObj.getDay()) === manualForm.value.startWeekday) {
        targetDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        break
      }
    }

    if (targetDate) {
      calendarData.value.specific_calendar_events.push({
        event_id: newSlotId,
        target_date: targetDate,
        title: manualForm.value.label,
        start_time: manualForm.value.startTime,
        end_time: manualForm.value.endTime,
      })
    }
  }

  manualForm.value.label = ''
  manualForm.value.startTime = ''
  manualForm.value.endTime = ''
}

const removeRecurringSlot = (dayOfWeek, slotId) => {
  calendarData.value.weekly_recurring_occupancy.forEach((day) => {
    if (day.day_of_week === dayOfWeek) {
      day.slots = day.slots.filter((slot) => slot.slot_id !== slotId)
    }
  })

  calendarData.value.weekly_recurring_occupancy =
    calendarData.value.weekly_recurring_occupancy.filter((day) => day.slots && day.slots.length > 0)
}

const removeSpecificEvent = (eventId) => {
  calendarData.value.specific_calendar_events = calendarData.value.specific_calendar_events.filter(
    (event) => event.event_id !== eventId,
  )
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
  if (editModal.value.type === 'recurring') {
    for (const day of calendarData.value.weekly_recurring_occupancy) {
      const slot = day.slots.find((s) => s.slot_id === editModal.value.slotId)

      if (slot) {
        slot.label = editModal.value.form.title
        slot.start_time = editModal.value.form.startTime
        slot.end_time = editModal.value.form.endTime
        break
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
    }
  }

  closeEditModal()
}

const closeEditModal = () => {
  editModal.value.isOpen = false
}

const editRecurringSlot = (dayOfWeek, slotId) => {
  for (const day of calendarData.value.weekly_recurring_occupancy) {
    const slot = day.slots.find((s) => s.slot_id === slotId)

    if (slot) {
      openEditModal('recurring', slot, day.day_of_week)
      return
    }
  }
}

const editSpecificEvent = (eventId) => {
  const event = calendarData.value.specific_calendar_events.find((e) => e.event_id === eventId)

  if (!event) return

  openEditModal('specific', event)
}

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

  const firstDayJS = new Date(year, month, 1).getDay()
  const startOffset = firstDayJS
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []

  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: null, events: [], recurringSlots: [] })
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dateObj = new Date(year, month, day)
    const jsonDayOfWeek = jsDayToJsonDay(dateObj.getDay())

    const dayEvents = (data.specific_calendar_events || []).filter(
      (event) => event.target_date === dateStr,
    )

    const recurringSlots = []

    for (const entry of data.weekly_recurring_occupancy || []) {
      if (entry.day_of_week === jsonDayOfWeek) {
        for (const slot of entry.slots || []) {
          recurringSlots.push({ ...slot, dayOfWeek: entry.day_of_week })
        }
      }
    }

    cells.push({
      day,
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

const jsonTextarea = ref(JSON.stringify(calendarData.value, null, 2))

watch(
  calendarData,
  (value) => {
    jsonTextarea.value = JSON.stringify(value, null, 2)
  },
  { deep: true },
)

const updateFromJson = () => {
  try {
    const parsed = JSON.parse(jsonTextarea.value)

    if (parsed.weekly_recurring_occupancy && parsed.specific_calendar_events) {
      calendarData.value = parsed
    }
  } catch (error) {
    // Ignore invalid JSON during typing
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[#e7ded3] w-full font-['Inter'] text-black">
    <AppHeader />

    <div class="flex flex-1 w-full relative">
      <AppSidebar />

      <main class="flex-1 flex flex-col px-[50px] py-[30px] overflow-y-auto">
        <!-- Breadcrumbs -->
        <div class="text-[#5c001f] text-sm mb-4">
          <span class="hover:underline cursor-pointer" @click="router.push('/calendar')">
            Time table
          </span>
          &gt;
          <span class="font-bold underline">Add New Time Table</span>
        </div>

        <div class="flex flex-col lg:flex-row gap-8 mt-2 h-full">
          <!-- LEFT PANEL -->
          <div class="flex-1 flex flex-col gap-6 lg:pr-8 lg:border-r-2 border-black/20">
            <h1 class="text-3xl font-bold text-black mb-2">Add New Time table</h1>

            <!-- Mode Toggles -->
            <div class="flex flex-col xl:flex-row gap-4">
              <button
                @click="entryMode = 'manual'"
                :class="
                  entryMode === 'manual'
                    ? 'bg-[#5c001f] text-white'
                    : 'bg-gray-200 text-black hover:bg-gray-300'
                "
                class="px-6 py-3 rounded-full font-bold transition-colors text-sm shadow-md"
              >
                Add in manually
              </button>

              <button
                @click="entryMode = 'upload'"
                :class="
                  entryMode === 'upload'
                    ? 'bg-[#5c001f] text-white'
                    : 'bg-gray-200 text-black hover:bg-gray-300'
                "
                class="px-6 py-3 rounded-full font-bold transition-colors text-sm shadow-md"
              >
                Upload & AI Analyse
              </button>
            </div>

            <!-- Upload Mode -->
            <div
              v-if="entryMode === 'upload'"
              class="flex-1 flex flex-col items-center justify-center border-4 border-black rounded-3xl p-8 bg-[#e7ded3] relative shadow-inner min-h-[300px] max-h-[500px]"
            >
              <p class="text-xl text-center font-bold mb-6">
                Upload the time table<br />and<br />let AI analyse for you!
              </p>

              <div
                class="relative w-24 h-24 mb-6 group cursor-pointer hover:scale-110 transition-transform"
              >
                <svg
                  class="w-full h-full text-black group-hover:text-[#5c001f] transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>

                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  class="absolute inset-0 opacity-0 cursor-pointer"
                  @change="handleFileUpload"
                  :disabled="isUploading"
                />
              </div>

              <div
                v-if="uploadError"
                class="mt-4 text-red-600 font-bold bg-red-100 px-4 py-2 rounded-lg"
              >
                {{ uploadError }}
              </div>

              <div
                v-if="isUploading"
                class="absolute inset-0 bg-white/80 rounded-3xl flex flex-col items-center justify-center backdrop-blur-sm z-10"
              >
                <div
                  class="w-16 h-16 border-4 border-gray-300 border-t-[#5c001f] rounded-full animate-spin"
                ></div>
                <p class="mt-4 font-bold text-[#5c001f] text-lg">Processing image with AI...</p>
              </div>
            </div>

            <!-- Manual Mode -->
            <div v-if="entryMode === 'manual'" class="flex-1 flex flex-col gap-4">
              <h2 class="text-2xl font-bold">Add new manually</h2>

              <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col col-span-2">
                  <label class="font-medium text-sm mb-1">Label</label>
                  <input
                    v-model="manualForm.label"
                    type="text"
                    class="border border-gray-400 p-2 outline-none focus:border-[#5c001f] focus:ring-1 focus:ring-[#5c001f] rounded"
                    placeholder="e.g. Advanced AI System"
                  />
                </div>

                <div class="flex flex-col col-span-2">
                  <label class="font-medium text-sm mb-1">Start weekday</label>
                  <select
                    v-model="manualForm.startWeekday"
                    class="border border-gray-400 p-2 outline-none focus:border-[#5c001f] focus:ring-1 focus:ring-[#5c001f] rounded"
                  >
                    <option :value="1">Monday</option>
                    <option :value="2">Tuesday</option>
                    <option :value="3">Wednesday</option>
                    <option :value="4">Thursday</option>
                    <option :value="5">Friday</option>
                    <option :value="6">Saturday</option>
                    <option :value="7">Sunday</option>
                  </select>
                </div>

                <div class="flex flex-col">
                  <label class="font-medium text-sm mb-1">Start time</label>
                  <input
                    v-model="manualForm.startTime"
                    type="time"
                    class="border border-gray-400 p-2 outline-none focus:border-[#5c001f] focus:ring-1 focus:ring-[#5c001f] rounded"
                  />
                </div>

                <div class="flex flex-col">
                  <label class="font-medium text-sm mb-1">End time</label>
                  <input
                    v-model="manualForm.endTime"
                    type="time"
                    class="border border-gray-400 p-2 outline-none focus:border-[#5c001f] focus:ring-1 focus:ring-[#5c001f] rounded"
                  />
                </div>

                <div class="flex items-center gap-2 mt-2 col-span-2">
                  <input
                    v-model="manualForm.isRecurring"
                    type="checkbox"
                    id="recurring"
                    class="w-4 h-4 accent-[#5c001f] cursor-pointer"
                  />
                  <label for="recurring" class="font-medium text-sm cursor-pointer select-none">
                    is Recurring
                  </label>
                </div>

                <div class="col-span-2 flex justify-end mt-4">
                  <button
                    @click="addManualEntry"
                    class="bg-[#5c001f] text-white px-6 py-2 rounded-full font-bold hover:bg-[#4a0019] transition-colors shadow-md"
                  >
                    Add new period
                  </button>
                </div>
              </div>

              <!-- Added slots display -->
              <div class="mt-6 bg-white rounded-3xl p-6 flex flex-col gap-4 flex-1 shadow-md">
                <h3 class="text-2xl font-bold">Time table</h3>

                <div class="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2">
                  <template
                    v-for="day in calendarData.weekly_recurring_occupancy"
                    :key="day.day_of_week"
                  >
                    <div
                      v-for="slot in day.slots"
                      :key="slot.slot_id"
                      class="bg-[#5c001f] text-white p-3 rounded-lg flex flex-col relative group shadow-sm transition-transform hover:-translate-y-0.5"
                    >
                      <button
                        @click="removeRecurringSlot(day.day_of_week, slot.slot_id)"
                        class="absolute top-2 right-2 text-white/70 hover:text-white font-bold hidden group-hover:block transition-colors"
                      >
                        ✕
                      </button>

                      <span class="font-bold text-sm">{{ slot.start_time }} - {{ slot.end_time }}</span>
                      <span class="text-sm font-medium mt-1">{{ slot.label }}</span>
                      <span class="text-xs text-white/70 mt-1 uppercase tracking-wider">
                        {{ day.day_name }}
                      </span>
                    </div>
                  </template>

                  <div
                    v-for="event in calendarData.specific_calendar_events"
                    :key="event.event_id"
                    class="bg-[#e85d04] text-white p-3 rounded-lg flex flex-col relative group shadow-sm transition-transform hover:-translate-y-0.5"
                  >
                    <button
                      @click="removeSpecificEvent(event.event_id)"
                      class="absolute top-2 right-2 text-white/70 hover:text-white font-bold hidden group-hover:block transition-colors"
                    >
                      ✕
                    </button>

                    <span class="font-bold text-sm">{{ event.start_time }} - {{ event.end_time }}</span>
                    <span class="text-sm font-medium mt-1">{{ event.title }}</span>
                    <span class="text-xs text-white/70 mt-1 uppercase tracking-wider">
                      {{ event.target_date }}
                    </span>
                  </div>
                </div>

                <p
                  v-if="
                    calendarData.weekly_recurring_occupancy.length === 0 &&
                    calendarData.specific_calendar_events.length === 0
                  "
                  class="text-gray-500 text-center mt-4"
                >
                  No periods added yet.
                </p>
              </div>
            </div>
          </div>

          <!-- RIGHT PANEL -->
          <div class="flex-[1.5] flex flex-col gap-4">
            <div class="flex justify-between items-start mb-2">
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-gray-700">Time table for</label>

                <caption>
                  This will only show non student time table that does not exist any time table in
                  the system
                </caption>

                <select
                  v-model="targetType"
                  class="border border-gray-400 p-2 w-64 outline-none focus:border-[#5c001f] rounded shadow-sm"
                >
                  <option value="Lecturer">Lecturer</option>
                  <option value="Section Class">Section Class</option>
                </select>

                <label class="text-sm font-medium mt-2 text-gray-700">
                  {{
                    targetType === 'Lecturer'
                      ? 'Search Lecturer or Staff name/email (min 3 chars)'
                      : 'Search Section number (min 3 chars)'
                  }}
                </label>

                <div class="relative">
                  <input
                    v-model="targetName"
                    type="text"
                    @focus="targetName.length >= 3 && !selectedTargetId && (showDropdown = true)"
                    class="border border-gray-400 p-2 w-64 outline-none focus:border-[#5c001f] rounded shadow-sm"
                    :placeholder="targetType === 'Lecturer' ? 'e.g. john@utm.my' : 'e.g. 01'"
                  />

                  <div
                    v-if="showDropdown"
                    class="absolute z-50 w-64 mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto"
                  >
                    <div
                      v-for="res in searchResults"
                      :key="res.id"
                      @click="selectSearchResult(res)"
                      class="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm"
                    >
                      {{ res.label }}
                    </div>

                    <div v-if="searchResults.length === 0" class="px-3 py-2 text-sm text-gray-500">
                      Not found.
                      <router-link
                        v-if="targetType === 'Lecturer'"
                        to="/manage-user"
                        class="text-[#5c001f] font-bold underline block mt-1"
                      >
                        Create new user in Manage User
                      </router-link>
                    </div>
                  </div>
                </div>
              </div>

              <button
                @click="createTimeTable"
                :disabled="isCreating"
                class="bg-[#5c001f] text-white px-8 py-3 rounded-full font-bold hover:bg-[#4a0019] transition-colors shadow-lg"
                :class="{ 'opacity-50 cursor-not-allowed': isCreating }"
              >
                {{ isCreating ? 'Creating...' : 'Create time table' }}
              </button>
            </div>

            <!-- Calendar Container -->
            <div class="bg-[#e7ded3] rounded-lg overflow-hidden shadow-lg border border-gray-300">
              <div class="flex items-center justify-between p-4 bg-white/50">
                <button
                  @click="goToPrevMonth"
                  class="text-black font-bold hover:text-[#5c001f] transition-colors flex items-center gap-2"
                >
                  <span>&lt;</span> {{ prevMonthLabel }}
                </button>

                <h2 class="text-2xl font-bold text-[#5c001f]">{{ activeMonthLabel }}</h2>

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
                  v-for="(week, weekIndex) in calendarWeeks"
                  :key="weekIndex"
                  class="grid grid-cols-7 border-b border-gray-300 last:border-b-0"
                >
                  <div
                    v-for="(cell, dayIndex) in week"
                    :key="dayIndex"
                    class="min-h-[120px] border-r border-gray-300 last:border-r-0 p-1 flex flex-col gap-1 relative"
                    :class="
                      !cell.day ? 'bg-gray-200/50' : 'bg-white hover:bg-gray-50 transition-colors'
                    "
                  >
                    <span v-if="cell.day" class="text-sm font-medium pl-1 mt-1 text-gray-700">
                      {{ cell.day }}
                    </span>

                    <template v-if="cell.day">
                      <div
                        v-for="slot in cell.recurringSlots"
                        :key="slot.slot_id"
                        @click="editRecurringSlot(slot.dayOfWeek, slot.slot_id)"
                        class="bg-[#5c001f] text-white rounded p-1.5 text-[10px] leading-tight flex flex-col cursor-pointer hover:opacity-90 relative group shadow-sm"
                      >
                        <button
                          @click.stop="removeRecurringSlot(slot.dayOfWeek, slot.slot_id)"
                          class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold hidden group-hover:flex z-10 text-[8px] shadow"
                        >
                          ✕
                        </button>

                        <span class="font-bold">{{ slot.start_time }} - {{ slot.end_time }}</span>
                        <span class="truncate mt-0.5">{{ slot.label }}</span>
                      </div>

                      <div
                        v-for="event in cell.events"
                        :key="event.event_id"
                        @click="editSpecificEvent(event.event_id)"
                        class="bg-[#e85d04] text-white rounded p-1.5 text-[10px] leading-tight flex flex-col cursor-pointer hover:opacity-90 relative group shadow-sm"
                      >
                        <button
                          @click.stop="removeSpecificEvent(event.event_id)"
                          class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold hidden group-hover:flex z-10 text-[8px] shadow"
                        >
                          ✕
                        </button>

                        <span class="font-bold" v-if="event.start_time">
                          {{ event.start_time }} - {{ event.end_time }}
                        </span>
                        <span class="truncate mt-0.5">{{ event.title }}</span>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <!-- Developer Sandbox -->
            <div
              class="mt-4 bg-gray-900 rounded-lg overflow-hidden shadow-lg border border-gray-700"
            >
              <div
                class="bg-gray-800 px-4 py-2 flex justify-between items-center border-b border-gray-700"
              >
                <h3 class="font-bold text-gray-200 text-sm flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  Developer Sandbox (Live JSON State)
                </h3>
              </div>

              <textarea
                v-model="jsonTextarea"
                class="w-full h-48 bg-gray-900 text-green-400 font-mono p-4 text-xs outline-none resize-y leading-relaxed"
                @input="updateFromJson"
                spellcheck="false"
              ></textarea>
            </div>
          </div>
        </div>
      </main>
    </div>

    <AppFooter class="mt-auto -mb-[30px]" />

    <EditSlotModal
      :isOpen="editModal.isOpen"
      :initialData="editModal.form"
      @save="handleModalSave"
      @close="closeEditModal"
    />
  </div>
</template>
