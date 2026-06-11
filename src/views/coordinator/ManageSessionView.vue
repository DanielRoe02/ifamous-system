<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import AppHeader from '@/components/AppHeader.vue'
import NavigationButton from '@/components/NavigationButton.vue'
import CreateSessionModal from '@/components/CreateSessionModal.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import AppFooter from '@/components/AppFooter.vue'

const { user } = useAuth()
const router = useRouter()

const isModalOpen = ref(false)

const handleSessionCreated = async () => {
  isModalOpen.value = false
  await fetchSessions() // Refresh the table
}

const sessions = ref([])
const isLoading = ref(true)
const error = ref('')

const fetchSessions = async () => {
  isLoading.value = true
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
    const res = await fetch(`${apiUrl}/api/sessions`)
    if (!res.ok) throw new Error('Failed to fetch sessions')
    sessions.value = await res.json()
  } catch (err) {
    error.value = err.message
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchSessions()
})

const editingId = ref(null)
const editValue = ref('')

const startEdit = (session) => {
  editingId.value = session.fyp_session_id
  editValue.value = session.fyp_session_id
}

const cancelEdit = () => {
  editingId.value = null
  editValue.value = ''
}

const saveEdit = async (oldId) => {
  if (!editValue.value || editValue.value == oldId) {
    cancelEdit()
    return
  }

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
    const res = await fetch(`${apiUrl}/api/sessions/${oldId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_session_id: parseInt(editValue.value, 10) }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to update session')
    }

    await fetchSessions()
    cancelEdit()
  } catch (err) {
    alert(err.message)
  }
}

const deleteSession = async (id) => {
  if (!confirm(`Are you sure you want to delete SESSION ${id}?`)) return

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
    const res = await fetch(`${apiUrl}/api/sessions/${id}`, {
      method: 'DELETE',
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to delete session')
    }

    await fetchSessions()
  } catch (err) {
    alert(err.message)
  }
}

const setActiveSession = async (id) => {
  if (!confirm(`Are you sure you want to set SESSION ${id} as the active semester?`)) return

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
    const res = await fetch(`${apiUrl}/api/sessions/${id}/active`, {
      method: 'PUT',
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to set active session')
    }

    localStorage.setItem('activeSessionId', id)
    await fetchSessions()
  } catch (err) {
    alert(err.message)
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[#e7ded3] w-full font-['Inter'] text-black">
    <AppHeader />

    <!-- Access Denied View for Non-Coordinators -->
    <div
      v-if="!user || Number(user.is_coordinator) !== 1"
      class="flex-1 flex flex-col items-center justify-center text-center px-4"
    >
      <h1 class="text-4xl font-bold text-[#5c001f] mb-4">Access Restricted</h1>
      <p class="text-xl text-gray-700">
        You do not have coordinator permissions to view this page.
      </p>
    </div>

    <!-- Main Content -->
    <div v-else class="flex flex-1 w-full relative">
      <!-- Side Navigation -->
      <AppSidebar />

      <!-- Main Dashboard Content -->
      <main class="flex-1 flex flex-col px-[50px] py-[30px] gap-8 overflow-y-auto">
        <!-- Heading -->
        <div class="flex items-center justify-between w-full">
          <h1 class="font-['Inter'] font-bold text-[40px] text-black uppercase">Manage Sessions</h1>
          <button
            @click="isModalOpen = true"
            class="bg-[#5c001f] text-white px-[24px] py-[16px] rounded-[8px] font-medium text-[16px] hover:bg-[#4a0019] transition-colors shadow-lg border-none"
          >
            Create New Session
          </button>
        </div>

        <!-- Divider -->
        <hr class="border-[#2f2f2f] w-full" />

        <!-- Data Table Container -->
        <div
          class="bg-white rounded-[25px] p-[30px] flex flex-col gap-[15px] shadow-lg w-full mb-10"
        >
          <h2 class="font-['Inter'] font-bold text-[32px] text-black">All Sessions</h2>

          <div v-if="isLoading" class="text-gray-500 py-4 font-medium">Loading sessions...</div>
          <div v-else-if="error" class="text-red-500 py-4 font-medium">{{ error }}</div>

          <div v-else class="border-2 border-black rounded-[5px] overflow-hidden mt-4">
            <!-- Table Header -->
            <div class="bg-white flex justify-between p-[16px] border-b-2 border-black">
              <div class="flex-[2] font-bold text-[14px] text-black pl-4">Session Number</div>
              <div class="flex-1 font-bold text-[14px] text-black text-center">Status</div>
              <div class="flex-1 font-bold text-[14px] text-black text-center">Actions</div>
            </div>

            <!-- Table Rows -->
            <div
              v-for="(session, index) in sessions"
              :key="session.fyp_session_id"
              class="flex justify-between items-center p-[16px]"
              :class="index % 2 === 0 ? 'bg-[#f7f6fe]' : 'bg-white'"
            >
              <div class="flex-[2] text-[16px] font-medium text-black pl-4">
                <template v-if="editingId === session.fyp_session_id">
                  <div class="flex items-center gap-2">
                    <span class="text-gray-500">SESSION</span>
                    <input
                      v-model="editValue"
                      type="number"
                      class="border border-gray-400 rounded px-2 py-1 w-[150px] outline-none focus:border-[#5c001f] focus:ring-1 focus:ring-[#5c001f]"
                      @keyup.enter="saveEdit(session.fyp_session_id)"
                      @keyup.esc="cancelEdit"
                      autoFocus
                    />
                  </div>
                </template>
                <template v-else> SESSION {{ session.fyp_session_id }} </template>
              </div>

              <!-- Status Column -->
              <div class="flex-1 flex justify-center items-center">
                <span
                  v-if="session.is_active == 1"
                  class="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase tracking-wide border border-green-200"
                >
                  Active
                </span>
                <button
                  v-else
                  @click="setActiveSession(session.fyp_session_id)"
                  class="px-3 py-1 bg-gray-100 text-gray-500 text-xs font-bold rounded-full uppercase tracking-wide border border-gray-300 hover:bg-[#5c001f] hover:text-white hover:border-[#5c001f] transition-colors"
                >
                  Inactive
                </button>
              </div>

              <div class="flex-1 flex justify-center gap-6">
                <template v-if="editingId === session.fyp_session_id">
                  <button
                    @click="saveEdit(session.fyp_session_id)"
                    class="text-green-600 font-bold hover:underline transition-colors"
                  >
                    Save
                  </button>
                  <button
                    @click="cancelEdit"
                    class="text-gray-500 font-bold hover:underline transition-colors"
                  >
                    Cancel
                  </button>
                </template>
                <template v-else>
                  <button
                    @click="startEdit(session)"
                    class="text-blue-600 font-bold hover:underline transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    @click="deleteSession(session.fyp_session_id)"
                    class="text-red-600 font-bold hover:underline transition-colors"
                  >
                    Delete
                  </button>
                </template>
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="sessions.length === 0" class="p-8 text-center text-gray-500 bg-white">
              No sessions found. Go to the Dashboard to create one!
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
