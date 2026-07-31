<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ClipboardCheck, FolderKanban, Loader2, UsersRound } from 'lucide-vue-next'
import AppHeader from '@/components/AppHeader.vue'
import RoleSidebar from '@/components/RoleSidebar.vue'
import { api } from '@/services/ifamousApi'
import { openSupervisorProject } from '@/utils/supervisorProjectNavigation'

const router = useRouter()
const loading = ref(true)
const error = ref('')
const dashboard = ref({ stats: {}, supervised: [], examinations: [] })

onMounted(async () => {
  try {
    dashboard.value = (await api.get('/staff/dashboard')).data
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3]">
    <AppHeader />
    <div class="flex">
      <RoleSidebar role="Staff" />
      <main class="flex-1 p-8 space-y-7">
        <section class="rounded-[30px] bg-[#5c001f] text-white p-8 shadow-xl">
          <p class="text-[#f8be17] uppercase tracking-[0.2em] font-bold">Combined Staff Workspace</p>
          <h1 class="text-4xl font-bold mt-2">Supervision and Examination</h1>
          <p class="text-white/75 mt-2">One account can supervise and examine different FYP projects without exposing unrelated projects.</p>
        </section>

        <div v-if="loading" class="bg-white rounded-2xl p-10 text-center"><Loader2 class="w-8 h-8 animate-spin mx-auto text-[#5c001f]" /></div>
        <div v-else-if="error" class="bg-red-50 text-red-800 border border-red-200 p-5 rounded-2xl font-bold">{{ error }}</div>
        <template v-else>
          <section class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-white rounded-[22px] p-5 shadow"><FolderKanban class="w-7 h-7 text-[#5c001f]" /><p class="text-sm text-gray-500 mt-3">Supervised FYPs</p><p class="text-3xl font-bold">{{ dashboard.stats.supervised || 0 }}</p></div>
            <div class="bg-white rounded-[22px] p-5 shadow"><ClipboardCheck class="w-7 h-7 text-[#5c001f]" /><p class="text-sm text-gray-500 mt-3">Pending examinations</p><p class="text-3xl font-bold">{{ dashboard.stats.pendingExaminations || 0 }}</p></div>
            <div class="bg-white rounded-[22px] p-5 shadow"><UsersRound class="w-7 h-7 text-[#5c001f]" /><p class="text-sm text-gray-500 mt-3">Completed examinations</p><p class="text-3xl font-bold">{{ dashboard.stats.completedExaminations || 0 }}</p></div>
          </section>

          <section class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div class="bg-white rounded-[26px] p-6 shadow">
              <div class="flex items-center justify-between"><h2 class="text-2xl font-bold">Your supervised FYP</h2><button @click="router.push('/supervisor-projects')" class="text-[#5c001f] font-bold">View all</button></div>
              <div class="space-y-3 mt-5"><button v-for="item in dashboard.supervised.slice(0,5)" :key="item.project_id" @click="openSupervisorProject(router, item)" class="w-full border rounded-2xl p-4 text-left hover:bg-[#f7f1ea]"><p class="font-bold">{{ item.project_title }}</p><p class="text-sm text-gray-500">{{ item.student_name }} · {{ item.status }}</p></button><p v-if="!dashboard.supervised.length" class="text-gray-500">No supervised projects.</p></div>
            </div>
            <div class="bg-white rounded-[26px] p-6 shadow">
              <div class="flex items-center justify-between"><h2 class="text-2xl font-bold">Pending examination FYP</h2><button @click="router.push('/examiner-projects')" class="text-[#5c001f] font-bold">View all</button></div>
              <div class="space-y-3 mt-5"><button v-for="item in dashboard.examinations.slice(0,5)" :key="item.project_id" @click="router.push({ path:'/examiner-review', query:{ projectId:item.project_id } })" class="w-full border rounded-2xl p-4 text-left hover:bg-[#f7f1ea]"><p class="font-bold">{{ item.project_title }}</p><p class="text-sm text-gray-500">{{ item.student_name }} · {{ item.evaluation_status || 'Pending' }}</p></button><p v-if="!dashboard.examinations.length" class="text-gray-500">No examiner assignments.</p></div>
            </div>
          </section>
        </template>
      </main>
    </div>
  </div>
</template>
