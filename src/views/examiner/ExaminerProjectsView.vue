<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ClipboardCheck, Loader2, Search } from 'lucide-vue-next'
import AppHeader from '@/components/AppHeader.vue'
import RoleSidebar from '@/components/RoleSidebar.vue'
import { api } from '@/services/ifamousApi'

const router = useRouter()
const loading = ref(true)
const error = ref('')
const projects = ref([])
const search = ref('')
const filtered = computed(() => projects.value.filter((p) => `${p.project_title} ${p.student_name} ${p.matric_no}`.toLowerCase().includes(search.value.toLowerCase())))

onMounted(async () => {
  try { projects.value = (await api.get('/examiner/projects')).data.projects || [] }
  catch (err) { error.value = err.response?.data?.error || err.message }
  finally { loading.value = false }
})
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3]"><AppHeader /><div class="flex"><RoleSidebar role="Staff" /><main class="flex-1 p-8 space-y-6">
    <section class="bg-[#5c001f] text-white rounded-[30px] p-8 shadow-xl"><p class="text-[#f8be17] font-bold uppercase tracking-[0.2em]">Examiner Module</p><h1 class="text-4xl font-bold mt-2">Assigned Grading FYP</h1><p class="text-white/75 mt-2">Only projects assigned to your examiner account are visible here.</p></section>
    <div class="bg-white rounded-[20px] p-4 flex items-center gap-3"><Search class="w-5 h-5 text-gray-500" /><input v-model="search" class="flex-1 outline-none" placeholder="Search assigned project or student" /></div>
    <div v-if="loading" class="bg-white rounded-2xl p-10"><Loader2 class="animate-spin mx-auto text-[#5c001f]" /></div><div v-else-if="error" class="bg-red-50 text-red-800 p-5 rounded-2xl font-bold">{{ error }}</div>
    <section v-else class="grid grid-cols-1 xl:grid-cols-2 gap-5"><article v-for="item in filtered" :key="item.project_id" class="bg-white rounded-[24px] p-6 shadow border border-black/5"><div class="flex justify-between gap-3"><ClipboardCheck class="w-7 h-7 text-[#5c001f]" /><span class="px-3 py-1 rounded-full text-xs font-bold" :class="item.evaluation_status === 'Submitted' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'">{{ item.evaluation_status || 'Pending' }}</span></div><h2 class="text-xl font-bold mt-4">{{ item.project_title }}</h2><p class="text-gray-600 mt-1">{{ item.student_name }} · {{ item.matric_no }}</p><p class="text-sm text-gray-500 mt-2">Supervisor: {{ item.supervisor_name }}</p><button @click="router.push({ path:'/examiner-review', query:{ projectId:item.project_id } })" class="mt-5 bg-[#5c001f] text-white rounded-xl px-5 py-2.5 font-bold">{{ item.evaluation_status === 'Submitted' ? 'View evaluation' : 'Review and grade' }}</button></article><p v-if="!filtered.length" class="text-gray-600">No assigned examination projects.</p></section>
  </main></div></div>
</template>
