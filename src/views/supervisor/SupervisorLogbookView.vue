<script setup>
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { BookOpenCheck, FileSearch, LayoutDashboard } from 'lucide-vue-next'
const router = useRouter()
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
          <button @click="router.push('/supervisor-projects')" class="w-full hover:bg-white rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold"><FileSearch class="w-5 h-5 text-[#5c001f]" /> Assigned Projects</button>
          <button class="w-full bg-[#5c001f] text-white rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold"><BookOpenCheck class="w-5 h-5 text-[#f8be17]" /> Logbook</button>
        </nav>
      </aside>
      <main class="flex-1 p-8 space-y-7">
        <section class="rounded-[32px] bg-[#5c001f] text-white p-8 shadow-xl">
          <p class="text-[#f8be17] font-bold uppercase tracking-[0.2em]">Supervisor Logbook</p>
          <h1 class="text-[36px] font-bold mt-2">Logbook Approval</h1>
          <p class="text-white/80 mt-2">This module will list student weekly logbook submissions for approval.</p>
        </section>
        <section class="bg-white rounded-[28px] p-8 shadow-lg border border-black/10">
          <h2 class="text-[28px] font-bold">Coming Soon</h2>
          <p class="text-gray-600 mt-2">Pending logbook approval will be connected after the proposal and assigned-project workflow.</p>
        </section>
      </main>
    </div>
  </div>
</template>
