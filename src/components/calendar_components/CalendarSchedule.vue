<template>
  <div
    class="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden w-full max-w-6xl mx-auto"
  >
    <!-- Header Area -->
    <div
      class="bg-[#5C001F] text-white px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4"
    >
      <div class="flex items-center gap-4">
        <h2 class="text-xl font-bold tracking-wide">{{ currentMonthName }} {{ currentYear }}</h2>
        <div class="flex items-center bg-white/10 rounded-lg p-1">
          <button
            @click="viewMode = 'month'"
            :class="[
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              viewMode === 'month'
                ? 'bg-white text-[#5C001F] shadow-sm'
                : 'text-white/80 hover:text-white hover:bg-white/10',
            ]"
          >
            Month
          </button>
          <button
            @click="viewMode = 'week'"
            :class="[
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              viewMode === 'week'
                ? 'bg-white text-[#5C001F] shadow-sm'
                : 'text-white/80 hover:text-white hover:bg-white/10',
            ]"
          >
            Week
          </button>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <!-- Navigation -->
        <div class="flex items-center bg-white/10 rounded-lg overflow-hidden">
          <button
            @click="previous"
            class="p-2 hover:bg-white/20 transition-colors"
            title="Previous"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            @click="goToToday"
            class="px-3 py-1.5 text-sm font-medium hover:bg-white/20 transition-colors border-x border-white/10"
          >
            Today
          </button>
          <button @click="next" class="p-2 hover:bg-white/20 transition-colors" title="Next">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        <!-- Call to Action -->
        <router-link
          v-if="!hideAddMeetingButton"
          to="/create-meeting"
          class="bg-[#F8BE17] hover:bg-[#e0ab15] text-[#5C001F] font-bold px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-2 transform active:scale-95"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          Add new meeting
        </router-link>
      </div>
    </div>

    <!-- Month View -->
    <div v-if="viewMode === 'month'" class="p-4 md:p-6 bg-gray-50/50">
      <div
        class="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-200"
      >
        <!-- Day headers -->
        <div
          v-for="day in daysOfWeek"
          :key="day"
          class="bg-gray-100 py-3 text-center text-sm font-semibold text-gray-700"
        >
          {{ day }}
        </div>

        <!-- Calendar days -->
        <div
          v-for="(dateInfo, index) in monthDays"
          :key="index"
          class="min-h-[100px] p-2 hover:bg-[#FFFFAB]/20 transition-colors duration-300 relative"
          :class="[
            !dateInfo.isCurrentMonth ? 'opacity-50' : '',
            props.constraints.avoidWeekend &&
            (dateInfo.date.getDay() === 0 || dateInfo.date.getDay() === 6)
              ? 'bg-[url(\'data:image/svg+xml;utf8,%3Csvg width=%2212%22 height=%2212%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath d=%22M-2,2 l4,-4 M0,12 l12,-12 M10,14 l4,-4%22 stroke=%22%2394a3b8%22 stroke-width=%222%22/%3E%3C/svg%3E\')] bg-gray-200/80 shadow-inner'
              : 'bg-white',
          ]"
        >
          <div
            class="w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1"
            :class="{
              'bg-[#5C001F] text-white': dateInfo.isToday,
              'text-gray-900': !dateInfo.isToday,
            }"
          >
            {{ dateInfo.date.getDate() }}
          </div>

          <!-- Events indicators for Month view -->
          <div class="flex flex-col gap-1 mt-1">
            <div
              v-for="event in dateInfo.events.slice(0, 3)"
              :key="event.id"
              class="text-xs truncate px-1.5 py-0.5 rounded font-medium border"
              :style="{
                backgroundColor: event.color ? event.color + '1A' : '#5C001F1A',
                color: event.color || '#5C001F',
                borderColor: event.color ? event.color + '33' : '#5C001F33',
              }"
              :title="`${event.title} (${event.start_time} - ${event.end_time})`"
            >
              {{ event.start_time }} {{ event.title }}
            </div>
            <div v-if="dateInfo.events.length > 3" class="text-xs text-gray-500 px-1 font-medium">
              +{{ dateInfo.events.length - 3 }} more
            </div>
          </div>

          <!-- Subtle dot indicator if there are events and we don't want to show the full boxes -->
          <!-- <div v-if="dateInfo.events.length > 0" class="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#5C001F]"></div> -->
        </div>
      </div>
    </div>

    <!-- Week View -->
    <div v-else class="flex flex-col bg-white">
      <div class="flex border-b border-gray-200 bg-gray-50">
        <!-- Time column header (empty) -->
        <div class="w-20 shrink-0 border-r border-gray-200"></div>
        <!-- Days header -->
        <div class="flex-1 grid grid-cols-7">
          <div
            v-for="(dateInfo, index) in weekDays"
            :key="index"
            class="py-3 text-center border-r border-gray-200 last:border-r-0 flex flex-col items-center justify-center"
            :class="{ 'bg-[#FFFFAB]/30': dateInfo.isToday }"
          >
            <span class="text-xs text-gray-500 uppercase font-semibold">{{
              daysOfWeekShort[index]
            }}</span>
            <span
              class="mt-1 w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold"
              :class="{
                'bg-[#5C001F] text-white shadow-md': dateInfo.isToday,
                'text-gray-900': !dateInfo.isToday,
              }"
            >
              {{ dateInfo.date.getDate() }}
            </span>
          </div>
        </div>
      </div>

      <div class="flex overflow-y-auto max-h-[600px] relative">
        <!-- Times column -->
        <div class="w-20 shrink-0 bg-gray-50 border-r border-gray-200">
          <div v-for="hour in hours" :key="hour" class="h-[60px] border-b border-gray-200 relative">
            <span class="absolute -top-2.5 right-2 text-xs font-medium text-gray-500">
              {{ formatHour(hour) }}
            </span>
          </div>
        </div>

        <!-- Grid -->
        <div class="flex-1 grid grid-cols-7 relative">
          <!-- Background grid lines -->
          <div
            v-for="dayIndex in 7"
            :key="'col-' + dayIndex"
            class="border-r border-gray-100 last:border-r-0 relative"
          >
            <div
              v-for="hour in hours"
              :key="'cell-' + dayIndex + '-' + hour"
              class="h-[60px] border-b border-gray-100 transition-colors duration-300"
              :class="{
                'bg-[url(\'data:image/svg+xml;utf8,%3Csvg width=%2212%22 height=%2212%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath d=%22M-2,2 l4,-4 M0,12 l12,-12 M10,14 l4,-4%22 stroke=%22%2394a3b8%22 stroke-width=%222%22/%3E%3C/svg%3E\')] bg-gray-200/80 shadow-inner':
                  isHourBlockedByConstraints(hour, dayIndex),
              }"
            ></div>
          </div>

          <!-- Events -->
          <template v-for="(dateInfo, dayIndex) in weekDays" :key="'events-' + dayIndex">
            <div
              v-for="event in dateInfo.events"
              :key="event.id"
              class="absolute mx-1 rounded-md overflow-hidden shadow-sm border hover:shadow-md transition-shadow group cursor-pointer"
              :style="[
                getEventStyle(event, dayIndex),
                { borderColor: event.color ? event.color + '40' : '#5C001F33' },
              ]"
            >
              <div
                class="w-1 h-full absolute left-0 top-0"
                :style="{ backgroundColor: event.color || '#5C001F' }"
              ></div>
              <div
                class="w-full h-full p-1.5 pl-2.5 text-xs"
                :style="{ backgroundColor: event.color ? event.color + '1A' : '#5C001F1A' }"
              >
                <div
                  class="font-bold truncate group-hover:whitespace-normal group-hover:break-words"
                  :style="{ color: event.color || '#5C001F' }"
                >
                  {{ event.title }}
                </div>
                <div class="font-medium" :style="{ color: event.color || '#5C001F' }">
                  {{ event.start_time }} - {{ event.end_time }}
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// --- STATE ---
const props = defineProps({
  events: {
    type: Array,
    default: () => [],
  },
  hideAddMeetingButton: {
    type: Boolean,
    default: false,
  },
  constraints: {
    type: Object,
    default: () => ({ avoidWeekend: false, avoidOffWorkingHour: false, avoidLunchHour: false }),
  },
})

// --- STATE ---
const viewMode = ref('month') // 'month' | 'week'
const currentDate = ref(new Date()) // The date driving the current view
const today = new Date()

// --- CONSTANTS ---
const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const daysOfWeekShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const START_HOUR = 6
const END_HOUR = 22
const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

// --- COMPUTED: HEADER INFO ---
const currentMonthName = computed(() => {
  return currentDate.value.toLocaleString('default', { month: 'long' })
})

const currentYear = computed(() => {
  return currentDate.value.getFullYear()
})

// --- HELPERS ---
const isHourBlockedByConstraints = (hour, dayIndex) => {
  const c = props.constraints
  if (!c) return false

  if (c.avoidWeekend && dayIndex !== undefined) {
    const dayOfWeek = weekDays.value[dayIndex - 1].date.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) return true
  }

  if (c.avoidOffWorkingHour) {
    const wStart = c.workingHourStart ? parseInt(c.workingHourStart.split(':')[0], 10) : 8
    const wEnd = c.workingHourEnd ? parseInt(c.workingHourEnd.split(':')[0], 10) : 17
    if (hour < wStart || hour >= wEnd) return true
  }

  if (c.avoidLunchHour) {
    const lStart = c.lunchHourStart ? parseInt(c.lunchHourStart.split(':')[0], 10) : 13
    const lEnd = c.lunchHourEnd ? parseInt(c.lunchHourEnd.split(':')[0], 10) : 14
    if (hour >= lStart && hour < lEnd) return true
  }

  return false
}

const isSameDay = (date1, date2) => {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  )
}

const formatDate = (date) => {
  const d = new Date(date)
  let month = '' + (d.getMonth() + 1)
  let day = '' + d.getDate()
  const year = d.getFullYear()

  if (month.length < 2) month = '0' + month
  if (day.length < 2) day = '0' + day

  return [year, month, day].join('-')
}

const getEventsForDate = (dateStr) => {
  return props.events
    .filter((e) => e.date === dateStr)
    .sort((a, b) => {
      return a.start_time.localeCompare(b.start_time)
    })
}

// --- COMPUTED: MONTH VIEW ---
const monthDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)

  const daysInMonth = lastDayOfMonth.getDate()
  const startingDayOfWeek = firstDayOfMonth.getDay() // 0 = Sunday

  const days = []

  // Previous month trailing days
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLastDay - i)
    const dateStr = formatDate(d)
    days.push({
      date: d,
      isCurrentMonth: false,
      isToday: isSameDay(d, today),
      events: getEventsForDate(dateStr),
    })
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i)
    const dateStr = formatDate(d)
    days.push({
      date: d,
      isCurrentMonth: true,
      isToday: isSameDay(d, today),
      events: getEventsForDate(dateStr),
    })
  }

  // Next month leading days (to fill 6 rows if necessary, or just up to a multiple of 7)
  const remainingCells = (7 - (days.length % 7)) % 7
  for (let i = 1; i <= remainingCells; i++) {
    const d = new Date(year, month + 1, i)
    const dateStr = formatDate(d)
    days.push({
      date: d,
      isCurrentMonth: false,
      isToday: isSameDay(d, today),
      events: getEventsForDate(dateStr),
    })
  }

  return days
})

// --- COMPUTED: WEEK VIEW ---
const weekDays = computed(() => {
  const current = new Date(currentDate.value)
  const dayOfWeek = current.getDay() // 0 = Sunday

  // Find the Sunday of the current week
  const startOfWeek = new Date(current)
  startOfWeek.setDate(current.getDate() - dayOfWeek)

  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    const dateStr = formatDate(d)

    days.push({
      date: d,
      isToday: isSameDay(d, today),
      events: getEventsForDate(dateStr),
    })
  }

  return days
})

// --- NAVIGATION ACTIONS ---
const previous = () => {
  const newDate = new Date(currentDate.value)
  if (viewMode.value === 'month') {
    newDate.setMonth(newDate.getMonth() - 1)
  } else {
    newDate.setDate(newDate.getDate() - 7)
  }
  currentDate.value = newDate
}

const next = () => {
  const newDate = new Date(currentDate.value)
  if (viewMode.value === 'month') {
    newDate.setMonth(newDate.getMonth() + 1)
  } else {
    newDate.setDate(newDate.getDate() + 7)
  }
  currentDate.value = newDate
}

const goToToday = () => {
  currentDate.value = new Date(today)
}

// --- UTILS FOR WEEK VIEW RENDERING ---
const formatHour = (hour) => {
  return `${hour.toString().padStart(2, '0')}:00`
}

const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

const getEventStyle = (event, dayIndex) => {
  const startMinutes = timeToMinutes(event.start_time)
  const endMinutes = timeToMinutes(event.end_time)
  const viewStartMinutes = START_HOUR * 60

  // Handle events outside view bounds
  const clampedStart = Math.max(startMinutes, viewStartMinutes)
  const duration = endMinutes - clampedStart

  // Pixels per minute (60px per hour = 1px per min)
  const pxPerMin = 1

  const topOffset = (clampedStart - viewStartMinutes) * pxPerMin
  const height = duration * pxPerMin

  // Column width percentage
  const colWidth = 100 / 7
  const leftPos = dayIndex * colWidth

  return {
    top: `${topOffset}px`,
    height: `${height}px`,
    left: `${leftPos}%`,
    width: `calc(${colWidth}% - 8px)`, // subtract margins
  }
}
</script>

<style scoped>
/* Hidden scrollbar for cleaner look if desired */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: #f1f1f1;
}
::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
