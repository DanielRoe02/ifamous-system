<script setup>
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { BookOpenCheck, Eye, FileSearch, LayoutDashboard } from 'lucide-vue-next'

const router = useRouter()
const projects = [
  { student: 'Ahmad Daniel', title: 'Smart Academic Advisor Audit System', status: 'Pending Approval', updated: '20 May 2026' },
  { student: 'Nur Syafiqah', title: 'AI-Based Attendance Monitoring System', status: 'Pending Review', updated: '19 May 2026' },
  { student: 'Lim Wei Sheng', title: 'Mobile Learning Platform', status: 'In Progress', updated: '18 May 2026' },
]
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3] font-['Inter'] text-black">
    <AppHeader />
    <div class="flex">
      <aside class="w-[240px] bg-[#f7f1ea] border-r border-[#d8c9bd] min-h-[calc(100vh-70px)] p-4">
        <div class="bg-white/80 border border-[#e1d5cc] rounded-[18px] p-4 mb-4">
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5c001f]">Supervisor</p>
          <p class="text-sm text-gray-600 mt-1">Review Workspace</p>
        </div>
        <nav class="space-y-2">
          <button @click="router.push('/supervisor-dashboard')" class="w-full hover:bg-white rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold"><LayoutDashboard class="w-5 h-5 text-[#5c001f]" /> Dashboard</button>
          <button class="w-full bg-[#5c001f] text-white rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold"><FileSearch class="w-5 h-5 text-[#f8be17]" /> Assigned Projects</button>
          <button @click="router.push('/supervisor-logbook')" class="w-full hover:bg-white rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold"><BookOpenCheck class="w-5 h-5 text-[#5c001f]" /> Logbook</button>
        </nav>
      </aside>

      <main class="flex-1 p-8 space-y-7">
        <section class="rounded-[32px] bg-[#5c001f] text-white p-8 shadow-xl">
          <p class="text-[#f8be17] font-bold uppercase tracking-[0.2em]">Assigned Projects</p>
          <h1 class="text-[34px] font-bold mt-2">Projects Assigned to Me</h1>
          <p class="text-white/80 mt-2">Review proposals, reports, submissions and student details. Proposal review is opened from the Review button.</p>
        </section>

        <section class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left border-b border-[#e1d5cc]"><th class="py-4">Student</th><th>Project Title</th><th>Status</th><th>Last Updated</th><th class="text-right">Action</th></tr>
            </thead>
            <tbody>
              <tr v-for="project in projects" :key="project.title" class="border-b border-[#f0e7df]">
                <td class="py-4 font-bold">{{ project.student }}</td>
                <td>{{ project.title }}</td>
                <td><span class="px-3 py-1 rounded-full bg-[#fff3c4] text-[#5c001f] font-bold text-xs">{{ project.status }}</span></td>
                <td>{{ project.updated }}</td>
                <td class="text-right"><button @click="router.push('/supervisor-review')" class="bg-[#5c001f] text-white px-4 py-2 rounded-full font-bold inline-flex items-center gap-2"><Eye class="w-4 h-4" /> Review</button></td>
              </tr>
            </tbody>
          </table>
        </section>
      </main>
    </div>
  </div>
</template>
