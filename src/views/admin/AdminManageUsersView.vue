<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { Users,
LayoutDashboard, ShieldCheck, KeyRound, Save, X } from 'lucide-vue-next'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const router = useRouter()

const users = ref([])
const isLoading = ref(false)
const errorMessage = ref('')
const selectedUser = ref(null)
const resetPasswordUser = ref(null)
const newPassword = ref('Temp1234!')

const roleForm = ref({
  is_admin: false,
  is_coordinator: false,
  is_supervisor: false,
  is_examiner: false,
  is_student: false,
  metric_number: '',
  cgpa: 3.0,
  credit_hours_completed: 90,
  proof_of_credit_hours: 'Updated by admin',
  research_expertise: '',
  sv_capacity: 5,
  industry_background: '',
})

const getToken = () => localStorage.getItem('token') || ''

const loadUsers = async () => {
  try {
    isLoading.value = true
    errorMessage.value = ''

    const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    const data = await response.json()

    if (!response.ok) throw new Error(data.error || 'Failed to load users')
    users.value = data.users || []
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    isLoading.value = false
  }
}

const openRoleEditor = (user) => {
  selectedUser.value = user
  roleForm.value = {
    is_admin: Number(user.is_admin) === 1,
    is_coordinator: Number(user.is_coordinator) === 1,
    is_supervisor: Number(user.is_supervisor) === 1,
    is_examiner: Number(user.is_examiner) === 1,
    is_student: Number(user.is_student) === 1,
    metric_number: user.metric_number || '',
    cgpa: user.CGPA || 3.0,
    credit_hours_completed: user.credit_hours_completed || 90,
    proof_of_credit_hours: user.proof_of_credit_hours || 'Updated by admin',
    research_expertise: user.research_expertise || user.expertise || '',
    sv_capacity: user.sv_capacity || 5,
    industry_background: user.industry_background || user.affiliation || '',
  }
}

const closeRoleEditor = () => {
  selectedUser.value = null
}

const saveRoles = async () => {
  if (!selectedUser.value) return

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/users/${selectedUser.value.user_id}/roles`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(roleForm.value),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to save roles')

    alert('Roles updated successfully.')
    closeRoleEditor()
    loadUsers()
  } catch (error) {
    alert(error.message)
  }
}

const openResetPassword = (user) => {
  resetPasswordUser.value = user
  newPassword.value = 'Temp1234!'
}

const resetPassword = async () => {
  if (!resetPasswordUser.value) return

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/users/${resetPasswordUser.value.user_id}/password`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ newPassword: newPassword.value }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to reset password')

    alert('Password reset successfully.')
    resetPasswordUser.value = null
  } catch (error) {
    alert(error.message)
  }
}

const roleLabel = (user) => {
  const roles = []
  if (Number(user.is_admin) === 1) roles.push('Admin')
  if (Number(user.is_coordinator) === 1) roles.push('Coordinator')
  if (Number(user.is_supervisor) === 1) roles.push('Supervisor')
  if (Number(user.is_examiner) === 1) roles.push('Examiner')
  if (Number(user.is_student) === 1) roles.push('Student')
  return roles.length ? roles.join(', ') : 'External'
}

const sortedUsers = computed(() => users.value.slice().sort((a, b) => String(a.full_name).localeCompare(String(b.full_name))))

onMounted(loadUsers)
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3] text-black font-sans">
    <AppHeader />

    <div class="flex">
      <aside class="w-[240px] bg-[#f7f1ea] border-r border-[#d8c9bd] min-h-[calc(100vh-70px)] p-4">
        <div class="bg-white/70 border border-[#e1d5cc] rounded-[18px] p-4 mb-4">
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5c001f]">Admin</p>
          <p class="text-sm text-gray-600 mt-1">System Control</p>
        </div>

        <button @click="router.push('/admin-dashboard')" class="w-full flex items-center gap-3 px-4 py-3 rounded-[14px] hover:bg-white font-bold text-[#2b1b1b] mb-2">
          <LayoutDashboard class="w-5 h-5 text-[#5c001f]" /> Dashboard
        </button>
        <button class="w-full flex items-center gap-3 px-4 py-3 rounded-[14px] bg-[#5c001f] text-white font-bold">
          <Users class="w-5 h-5" /> Manage Users
        </button>
      </aside>

      <main class="flex-1 px-10 py-8 space-y-6">
        <section class="rounded-[28px] bg-[#5c001f] text-white p-8 shadow-lg">
          <p class="uppercase tracking-[0.25em] text-[#f8be17] text-sm font-bold">Admin Module</p>
          <h1 class="text-4xl font-extrabold mt-2">Manage Users & Roles</h1>
          <p class="mt-3 text-white/80">Edit account roles, student details, supervisor capacity, examiner data and reset passwords.</p>
        </section>

        <section class="bg-white rounded-[24px] border border-[#d8c9bd] shadow-md overflow-hidden">
          <div class="px-6 py-4 border-b border-[#d8c9bd] flex items-center justify-between">
            <div>
              <h2 class="text-2xl font-extrabold">User Directory</h2>
              <p class="text-sm text-gray-600">Admin can manage role records stored in students, supervisor, examiners, coordinator and admin tables.</p>
            </div>
            <button @click="loadUsers" class="px-5 py-2 rounded-full bg-[#f8be17] text-[#5c001f] font-bold">Refresh</button>
          </div>

          <div v-if="errorMessage" class="m-6 rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 font-semibold">{{ errorMessage }}</div>
          <div v-if="isLoading" class="p-6 text-gray-600">Loading users...</div>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm text-left">
              <thead class="bg-[#f7f1ea] text-[#5c001f]">
                <tr>
                  <th class="p-4">Name</th>
                  <th class="p-4">Email</th>
                  <th class="p-4">Roles</th>
                  <th class="p-4">Metric / Capacity</th>
                  <th class="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in sortedUsers" :key="item.user_id" class="border-t border-[#eee2d8] hover:bg-[#fffaf0]">
                  <td class="p-4 font-bold">{{ item.full_name }}</td>
                  <td class="p-4 text-gray-600">{{ item.email }}</td>
                  <td class="p-4">
                    <span class="rounded-full bg-[#fff3c4] text-[#5c001f] px-3 py-1 font-bold text-xs">{{ roleLabel(item) }}</span>
                  </td>
                  <td class="p-4 text-gray-600">
                    <span v-if="item.metric_number">{{ item.metric_number }}</span>
                    <span v-else-if="item.sv_capacity">{{ item.current_capacity || 0 }} / {{ item.sv_capacity }}</span>
                    <span v-else>-</span>
                  </td>
                  <td class="p-4 text-right space-x-2">
                    <button @click="openRoleEditor(item)" class="px-4 py-2 rounded-full bg-[#5c001f] text-white font-bold">Edit Role</button>
                    <button @click="openResetPassword(item)" class="px-4 py-2 rounded-full bg-[#eadfd7] text-[#5c001f] font-bold">Reset Pass</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>

    <div v-if="selectedUser" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-[24px] shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-7">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h2 class="text-2xl font-extrabold text-[#5c001f]">Edit Roles</h2>
            <p class="text-sm text-gray-600">{{ selectedUser.full_name }} · {{ selectedUser.email }}</p>
          </div>
          <button @click="closeRoleEditor" class="p-2 text-gray-500 hover:text-red-600"><X /></button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <label class="flex items-center gap-3 rounded-xl border border-[#d8c9bd] p-4 font-bold"><input v-model="roleForm.is_admin" type="checkbox" /> Admin</label>
          <label class="flex items-center gap-3 rounded-xl border border-[#d8c9bd] p-4 font-bold"><input v-model="roleForm.is_coordinator" type="checkbox" /> Coordinator</label>
          <label class="flex items-center gap-3 rounded-xl border border-[#d8c9bd] p-4 font-bold"><input v-model="roleForm.is_supervisor" type="checkbox" /> Supervisor</label>
          <label class="flex items-center gap-3 rounded-xl border border-[#d8c9bd] p-4 font-bold"><input v-model="roleForm.is_examiner" type="checkbox" /> Examiner</label>
          <label class="flex items-center gap-3 rounded-xl border border-[#d8c9bd] p-4 font-bold"><input v-model="roleForm.is_student" type="checkbox" /> Student</label>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div v-if="roleForm.is_student" class="space-y-3 rounded-xl bg-[#f7f1ea] p-4">
            <h3 class="font-extrabold text-[#5c001f]">Student Details</h3>
            <input v-model="roleForm.metric_number" placeholder="Metric number" class="w-full border rounded-lg px-3 py-2" />
            <input v-model="roleForm.cgpa" type="number" step="0.01" placeholder="CGPA" class="w-full border rounded-lg px-3 py-2" />
            <input v-model="roleForm.credit_hours_completed" type="number" placeholder="Completed credit hours" class="w-full border rounded-lg px-3 py-2" />
            <input v-model="roleForm.proof_of_credit_hours" placeholder="Proof filename/link" class="w-full border rounded-lg px-3 py-2" />
          </div>

          <div v-if="roleForm.is_supervisor" class="space-y-3 rounded-xl bg-[#f7f1ea] p-4">
            <h3 class="font-extrabold text-[#5c001f]">Supervisor Details</h3>
            <textarea v-model="roleForm.research_expertise" placeholder="Research expertise" class="w-full border rounded-lg px-3 py-2 min-h-[90px]"></textarea>
            <input v-model="roleForm.sv_capacity" type="number" placeholder="Supervisor capacity" class="w-full border rounded-lg px-3 py-2" />
          </div>

          <div v-if="roleForm.is_examiner" class="space-y-3 rounded-xl bg-[#f7f1ea] p-4">
            <h3 class="font-extrabold text-[#5c001f]">Examiner Details</h3>
            <textarea v-model="roleForm.industry_background" placeholder="Industry background / examiner expertise" class="w-full border rounded-lg px-3 py-2 min-h-[90px]"></textarea>
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-7">
          <button @click="closeRoleEditor" class="px-5 py-3 rounded-full bg-gray-100 font-bold">Cancel</button>
          <button @click="saveRoles" class="px-6 py-3 rounded-full bg-[#5c001f] text-white font-bold flex items-center gap-2"><Save class="w-4 h-4" /> Save Roles</button>
        </div>
      </div>
    </div>

    <div v-if="resetPasswordUser" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-[24px] shadow-xl w-full max-w-md p-7">
        <h2 class="text-2xl font-extrabold text-[#5c001f] mb-2">Reset Password</h2>
        <p class="text-sm text-gray-600 mb-5">{{ resetPasswordUser.full_name }}</p>
        <input v-model="newPassword" type="text" class="w-full border rounded-lg px-4 py-3 mb-5" />
        <div class="flex justify-end gap-3">
          <button @click="resetPasswordUser = null" class="px-5 py-3 rounded-full bg-gray-100 font-bold">Cancel</button>
          <button @click="resetPassword" class="px-6 py-3 rounded-full bg-[#5c001f] text-white font-bold flex items-center gap-2"><KeyRound class="w-4 h-4" /> Reset</button>
        </div>
      </div>
    </div>
  </div>
</template>
