<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import AppFooter from '@/components/AppFooter.vue'
import { apiService } from '@/services/api'

const { user } = useAuth()
const router = useRouter()

const pagination = ref({
  students: { page: 1, totalPages: 1, data: [] },
  lecturers: { page: 1, totalPages: 1, data: [] },
  outsiders: { page: 1, totalPages: 1, data: [] },
})

const isLoadingUsers = ref(false)

const loadCategory = async (category) => {
  try {
    const res = await apiService.getPaginatedUsers(category, pagination.value[category].page)
    pagination.value[category].data = res.data
    pagination.value[category].totalPages = res.totalPages || 1
  } catch (err) {
    console.error(`Failed to load ${category}:`, err)
  }
}

const loadRecentUsers = async () => {
  isLoadingUsers.value = true
  await Promise.all([
    loadCategory('students'),
    loadCategory('lecturers'),
    loadCategory('outsiders'),
  ])
  isLoadingUsers.value = false
}

const changePage = (category, dir) => {
  const current = pagination.value[category]
  if (dir === -1 && current.page > 1) {
    current.page--
    loadCategory(category)
  } else if (dir === 1 && current.page < current.totalPages) {
    current.page++
    loadCategory(category)
  }
}

const confirmDelete = async (user) => {
  if (confirm(`Are you sure you want to delete ${user.full_name}?`)) {
    try {
      await apiService.deleteUser(user.user_id)
      alert('User deleted successfully!')
      loadRecentUsers()
    } catch (e) {
      console.error(e)
      alert('Failed to delete user.')
    }
  }
}

onMounted(() => {
  if (user.value && Number(user.value.is_coordinator) === 1) {
    loadRecentUsers()
  }
})

import CreateUserForm from '@/components/CreateUserForm.vue'
import EditUserModal from '@/components/EditUserModal.vue'

const isEditModalOpen = ref(false)
const selectedUserToEdit = ref(null)

const openEditModal = (userToEdit) => {
  selectedUserToEdit.value = userToEdit
  isEditModalOpen.value = true
}

const closeEditModal = () => {
  isEditModalOpen.value = false
  selectedUserToEdit.value = null
}

const onUserUpdatedOrCreated = () => {
  closeEditModal()
  loadRecentUsers()
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[#e7ded3] w-full font-['Inter'] text-black">
    <AppHeader />

    <div
      v-if="!user || Number(user.is_coordinator) !== 1"
      class="flex-1 flex flex-col items-center justify-center text-center px-4"
    >
      <h1 class="text-4xl font-bold text-[#5c001f] mb-4">Access Restricted</h1>
      <p class="text-xl text-gray-700 mb-6">
        You do not have coordinator permissions to manage users.
      </p>
    </div>

    <div v-else class="flex flex-1 w-full relative">
      <AppSidebar />

      <main class="flex-1 flex flex-col px-[50px] py-[30px] gap-8 overflow-y-auto">
        <div>
          <h1 class="font-['Inter'] font-bold text-[40px] text-[#5c001f] uppercase">Manage User</h1>
          <p class="text-gray-700 mt-2">
            Create new internal or external users, and view recently joined users.
          </p>
        </div>

        <div class="flex flex-col xl:flex-row gap-8">
          <!-- Create User Form (Left Panel) -->
          <CreateUserForm @user-created="onUserUpdatedOrCreated" />

          <!-- Recent Users Tables (Right Panel) -->
          <div class="flex-[1.5] flex flex-col gap-8">
            <div v-if="isLoadingUsers" class="text-gray-600">Loading recent users...</div>
            <template v-else>
              <!-- LECTURERS TABLE -->
              <div class="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
                <div
                  class="bg-[#5c001f] text-white px-4 py-3 font-bold text-lg flex justify-between items-center"
                >
                  <span>Recent Lecturers / Staff</span>
                  <span class="text-sm bg-white/20 px-2 py-1 rounded">Last 20</span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-sm">
                    <thead class="bg-gray-100 border-b border-gray-200 text-gray-700">
                      <tr>
                        <th class="p-3 font-semibold">Name</th>
                        <th class="p-3 font-semibold">Email</th>
                        <th class="p-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="l in pagination.lecturers.data"
                        :key="l.user_id"
                        class="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td class="p-3">{{ l.full_name }}</td>
                        <td class="p-3 text-gray-500">{{ l.email }}</td>
                        <td class="p-3">
                          <button
                            @click="openEditModal(l)"
                            class="text-blue-600 font-semibold hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            @click="confirmDelete(l)"
                            class="text-red-600 font-semibold hover:underline ml-3"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                      <tr v-if="pagination.lecturers.data.length === 0">
                        <td colspan="3" class="p-4 text-center text-gray-500">
                          No lecturers found.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div
                    class="bg-gray-50 px-4 py-2 border-t border-gray-200 flex justify-between items-center text-sm text-gray-600"
                  >
                    <button
                      @click="changePage('lecturers', -1)"
                      :disabled="pagination.lecturers.page === 1"
                      class="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      &lt; Prev
                    </button>
                    <span
                      >Page {{ pagination.lecturers.page }} of
                      {{ pagination.lecturers.totalPages }}</span
                    >
                    <button
                      @click="changePage('lecturers', 1)"
                      :disabled="pagination.lecturers.page === pagination.lecturers.totalPages"
                      class="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next &gt;
                    </button>
                  </div>
                </div>
              </div>

              <!-- STUDENTS TABLE -->
              <div class="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
                <div
                  class="bg-blue-800 text-white px-4 py-3 font-bold text-lg flex justify-between items-center"
                >
                  <span>Recent Students</span>
                  <span class="text-sm bg-white/20 px-2 py-1 rounded">Last 20</span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-sm">
                    <thead class="bg-gray-100 border-b border-gray-200 text-gray-700">
                      <tr>
                        <th class="p-3 font-semibold">Name</th>
                        <th class="p-3 font-semibold">Metric</th>
                        <th class="p-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="s in pagination.students.data"
                        :key="s.user_id"
                        class="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td class="p-3">{{ s.full_name }}</td>
                        <td class="p-3 text-gray-500">{{ s.metric_number }}</td>
                        <td class="p-3">
                          <button
                            @click="openEditModal(s)"
                            class="text-blue-600 font-semibold hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            @click="confirmDelete(s)"
                            class="text-red-600 font-semibold hover:underline ml-3"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                      <tr v-if="pagination.students.data.length === 0">
                        <td colspan="3" class="p-4 text-center text-gray-500">
                          No students found.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div
                    class="bg-gray-50 px-4 py-2 border-t border-gray-200 flex justify-between items-center text-sm text-gray-600"
                  >
                    <button
                      @click="changePage('students', -1)"
                      :disabled="pagination.students.page === 1"
                      class="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      &lt; Prev
                    </button>
                    <span
                      >Page {{ pagination.students.page }} of
                      {{ pagination.students.totalPages }}</span
                    >
                    <button
                      @click="changePage('students', 1)"
                      :disabled="pagination.students.page === pagination.students.totalPages"
                      class="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next &gt;
                    </button>
                  </div>
                </div>
              </div>

              <!-- OUTSIDERS TABLE -->
              <div class="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
                <div
                  class="bg-green-700 text-white px-4 py-3 font-bold text-lg flex justify-between items-center"
                >
                  <span>Recent Outsiders</span>
                  <span class="text-sm bg-white/20 px-2 py-1 rounded">Last 20</span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-sm">
                    <thead class="bg-gray-100 border-b border-gray-200 text-gray-700">
                      <tr>
                        <th class="p-3 font-semibold">Name</th>
                        <th class="p-3 font-semibold">Email / Org</th>
                        <th class="p-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="o in pagination.outsiders.data"
                        :key="o.user_id"
                        class="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td class="p-3">{{ o.full_name }}</td>
                        <td class="p-3 text-gray-500">
                          {{ o.email }} <br />
                          <span class="text-xs text-gray-400">{{ o.co_org_name }}</span>
                        </td>
                        <td class="p-3">
                          <button
                            @click="openEditModal(o)"
                            class="text-blue-600 font-semibold hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            @click="confirmDelete(o)"
                            class="text-red-600 font-semibold hover:underline ml-3"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                      <tr v-if="pagination.outsiders.data.length === 0">
                        <td colspan="3" class="p-4 text-center text-gray-500">
                          No outsiders found.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div
                    class="bg-gray-50 px-4 py-2 border-t border-gray-200 flex justify-between items-center text-sm text-gray-600"
                  >
                    <button
                      @click="changePage('outsiders', -1)"
                      :disabled="pagination.outsiders.page === 1"
                      class="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      &lt; Prev
                    </button>
                    <span
                      >Page {{ pagination.outsiders.page }} of
                      {{ pagination.outsiders.totalPages }}</span
                    >
                    <button
                      @click="changePage('outsiders', 1)"
                      :disabled="pagination.outsiders.page === pagination.outsiders.totalPages"
                      class="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next &gt;
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </main>
    </div>
    <AppFooter />

    <EditUserModal
      v-if="isEditModalOpen"
      :user="selectedUserToEdit"
      @close="closeEditModal"
      @user-updated="onUserUpdatedOrCreated"
    />
  </div>
</template>
