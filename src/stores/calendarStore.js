import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService } from '@/services/api'

export const useCalendarStore = defineStore('calendar', () => {
  const sessionData = ref(null)
  const activeSessionId = ref(null)
  const selectedSchedules = ref([])
  const isLoading = ref(false)
  const error = ref(null)

  // Predefined color palette for mapping dynamic schedules
  const colorsList = [
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Orange
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#f43f5e', // Rose
  ]

  // Dynamic mapping of schedule owners to color codes
  const colorMap = computed(() => {
    if (!sessionData.value || !sessionData.value.timetables) return {}
    const map = {}
    sessionData.value.timetables.forEach((tb, index) => {
      map[tb.time_table_id] = colorsList[index % colorsList.length]
    })
    return map
  })

  // List of schedules split by categories (Class sections and Lecturers/Staff)
  const availableSchedules = computed(() => {
    if (!sessionData.value || !sessionData.value.timetables) {
      return { classes: [], lecturers: [] }
    }
    const classes = []
    const lecturers = []
    sessionData.value.timetables.forEach((tb) => {
      const isClass = tb.class_id != null
      const label = isClass
        ? tb.section_name
        : tb.staff_name || tb.staff_email || `User ${tb.user_id}`
      const item = {
        id: tb.time_table_id,
        label: label,
        is_class: isClass,
        color: colorMap.value[tb.time_table_id],
      }
      if (isClass) {
        classes.push(item)
      } else {
        lecturers.push(item)
      }
    })
    return { classes, lecturers }
  })

  // Fetch session data from the API and pre-select all schedules
  const fetchSessionData = async (sessionId) => {
    isLoading.value = true
    error.value = null
    try {
      const data = await apiService.getFYPSessionData(sessionId)
      sessionData.value = data
      // Select all schedule filters by default
      selectedSchedules.value = data.timetables.map((t) => t.time_table_id)
    } catch (err) {
      console.error('Error fetching calendar session data:', err)
      error.value = err.message || 'Failed to load session data'
    } finally {
      isLoading.value = false
    }
  }

  // Fetch active session from API or LocalStorage
  const fetchActiveSession = async () => {
    isLoading.value = true
    error.value = null

    // 1. Check if we already have it in localStorage to prevent SQL overload
    const cachedSessionId = localStorage.getItem('activeSessionId')
    if (cachedSessionId) {
      activeSessionId.value = parseInt(cachedSessionId, 10)
      await fetchSessionData(activeSessionId.value)
      return // Skip the API call completely
    }

    // 2. Otherwise fetch from API
    try {
      const activeSession = await apiService.getActiveSession()
      activeSessionId.value = activeSession.fyp_session_id

      // Save it to localStorage for future visits
      localStorage.setItem('activeSessionId', activeSessionId.value)

      // Now fetch the data for this active session
      await fetchSessionData(activeSessionId.value)
    } catch (err) {
      console.error('Error fetching active session:', err)
      error.value = err.message || 'Failed to load active session'
      isLoading.value = false
    }
  }

  // Format Date helper
  const formatDate = (date) => {
    const d = new Date(date)
    let month = '' + (d.getMonth() + 1)
    let day = '' + d.getDate()
    const year = d.getFullYear()

    if (month.length < 2) month = '0' + month
    if (day.length < 2) day = '0' + day

    return [year, month, day].join('-')
  }

  // Flattens weekly recurring schedules & specific calendar events from DB
  const flatEvents = computed(() => {
    if (!sessionData.value || !sessionData.value.timetables) return []
    const events = []
    let idCounter = 1

    sessionData.value.timetables.forEach((tb) => {
      const isClass = tb.class_id != null
      const ownerLabel = isClass
        ? tb.section_name
        : tb.staff_name || tb.staff_email || `User ${tb.user_id}`
      const schedule = tb.schedule || {}

      // 1. Specific calendar events
      if (schedule.specific_events && Array.isArray(schedule.specific_events)) {
        schedule.specific_events.forEach((e) => {
          events.push({
            id: `db-specific-${idCounter++}`,
            title: e.label || e.title,
            date: e.date || e.target_date,
            start_time: e.start_time || '08:00',
            end_time: e.end_time || '09:00',
            owner: ownerLabel,
            owner_id: tb.time_table_id,
            is_class: isClass,
            color: colorMap.value[tb.time_table_id],
          })
        })
      }

      // 2. Weekly recurring slots (mapped to the year 2026)
      if (schedule.weekly_recurring && Array.isArray(schedule.weekly_recurring)) {
        const startDate = new Date(2026, 0, 1)
        const endDate = new Date(2026, 11, 31)

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const jsDay = d.getDay()
          const jsonDayOfWeek = jsDay === 0 ? 7 : jsDay // Convert: 0 (Sun) -> 7 (Sun)
          const dateStr = formatDate(d)

          const recurringDay = schedule.weekly_recurring.find(
            (r) => r.day_of_week === jsonDayOfWeek,
          )
          if (recurringDay && recurringDay.slots) {
            recurringDay.slots.forEach((slot) => {
              events.push({
                id: `db-recurring-${idCounter++}`,
                title: slot.label,
                date: dateStr,
                start_time: slot.start_time,
                end_time: slot.end_time,
                owner: ownerLabel,
                owner_id: tb.time_table_id,
                is_class: isClass,
                color: colorMap.value[tb.time_table_id],
              })
            })
          }
        }
      }
    })

    return events
  })

  // Derived state: events that are active/checked in the filter checkboxes
  const visibleEvents = computed(() => {
    return flatEvents.value.filter((event) => selectedSchedules.value.includes(event.owner_id))
  })

  return {
    sessionData,
    activeSessionId,
    selectedSchedules,
    isLoading,
    error,
    colorMap,
    availableSchedules,
    flatEvents,
    visibleEvents,
    fetchSessionData,
    fetchActiveSession,
  }
})
