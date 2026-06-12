<script setup>
function getDisplayName() {
  try {
    const raw =
      localStorage.getItem("user") ||
      localStorage.getItem("ifamous_user") ||
      localStorage.getItem("currentUser");

    const user = raw ? JSON.parse(raw) : {};

    return (
      user.full_name ||
      user.fullName ||
      user.name ||
      localStorage.getItem("full_name") ||
      localStorage.getItem("userName") ||
      "Supervisor"
    );
  } catch (error) {
    return "Supervisor";
  }
}

import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import {
  Bell,
  BookOpenCheck,
  ClipboardCheck,
  FileSearch,
  LayoutDashboard,
  MessageSquare,
  Users,
} from 'lucide-vue-next'

const router = useRouter()

const cards = [
  { label: 'Workload', value: '3 / 5', note: 'maximum capacity' },
  { label: 'Pending Reviews', value: 2, note: 'proposal/report review' },
  { label: 'Pending Feedback', value: 5, note: 'comments to provide' },
  { label: 'Pending Logbooks', value: 4, note: 'weekly approval' },
]

const tasks = [
  'Review proposal - Ahmad Daniel',
  'Review progress report - Lim Wei Sheng',
  'Logbook approval - Farah Adlina',
]
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3] text-black font-['Inter']">
    <AppHeader />
    <div class="flex">
      <aside class="w-[240px] bg-[#f7f1ea] border-r border-[#d8c9bd] min-h-[calc(100vh-70px)] p-4">
        <div class="bg-white/80 border border-[#e1d5cc] rounded-[18px] p-4 mb-4">
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5c001f]">Supervisor</p>
          <p class="text-sm text-gray-600 mt-1">Review Workspace</p>
        </div>
        <nav class="space-y-2">
          <button class="w-full bg-[#5c001f] text-white rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold">
            <LayoutDashboard class="w-5 h-5 text-[#f8be17]" /> Dashboard
          </button>
          <button @click="router.push('/supervisor-projects')" class="w-full hover:bg-white rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold">
            <FileSearch class="w-5 h-5 text-[#5c001f]" /> Assigned Projects
          </button>
          <button @click="router.push('/supervisor-logbook')" class="w-full hover:bg-white rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold">
            <BookOpenCheck class="w-5 h-5 text-[#5c001f]" /> Logbook
          </button>
        </nav>
      </aside>

      <main class="flex-1 p-8 space-y-7">
        <section class="rounded-[32px] bg-[#5c001f] text-white p-8 shadow-xl relative overflow-hidden">
          <div class="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[#f8be17]/20"></div>
          <p class="text-[#f8be17] font-bold uppercase tracking-[0.2em]">I-FAMOUS Supervisor</p>
          <h1 class="text-[36px] font-bold mt-2">Welcome, {{ getDisplayName() }}</h1>
          <p class="text-white/80 mt-2">Review assigned projects, approve/reject submissions, give feedback and check logbooks.</p>
        </section>

        <section class="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div v-for="card in cards" :key="card.label" class="bg-white rounded-[24px] p-6 shadow-lg border border-black/10">
            <p class="text-sm font-bold text-gray-500">{{ card.label }}</p>
            <p class="text-[34px] font-bold text-[#5c001f] mt-2">{{ card.value }}</p>
            <p class="text-xs text-gray-500 mt-1">{{ card.note }}</p>
          </div>
        </section>

        <section class="grid grid-cols-1 xl:grid-cols-3 gap-7">
          <div class="xl:col-span-2 bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
            <div class="flex items-center justify-between">
              <h2 class="text-[28px] font-bold">My Pending Tasks</h2>
              <button @click="router.push('/supervisor-projects')" class="bg-[#5c001f] text-white px-5 py-3 rounded-full font-bold">View All Projects</button>
            </div>
            <div class="mt-6 space-y-4">
              <div v-for="task in tasks" :key="task" class="rounded-[20px] bg-[#f7f1ea] border border-[#e1d5cc] p-5 flex items-center justify-between">
                <div class="flex items-center gap-3"><ClipboardCheck class="w-5 h-5 text-[#5c001f]" /><p class="font-bold">{{ task }}</p></div>
                <button @click="task.includes('Logbook') ? router.push('/supervisor-logbook') : router.push('/supervisor-review')" class="bg-[#fff3c4] text-[#5c001f] px-4 py-2 rounded-full font-bold">Review</button>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
            <div class="flex items-center justify-between"><h2 class="text-xl font-bold">Notifications</h2><Bell class="w-5 h-5 text-[#5c001f]" /></div>
            <div class="mt-5 space-y-4 text-sm">
              <div class="rounded-[18px] bg-[#f7f1ea] p-4 border border-[#e1d5cc] flex gap-3"><MessageSquare class="w-5 h-5 text-[#5c001f]" /> New proposal assigned to you.</div>
              <div class="rounded-[18px] bg-[#f7f1ea] p-4 border border-[#e1d5cc] flex gap-3"><Users class="w-5 h-5 text-[#5c001f]" /> Logbook week 5 submitted.</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
