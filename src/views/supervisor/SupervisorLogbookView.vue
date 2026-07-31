<script setup>
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import RoleSidebar from '@/components/RoleSidebar.vue'
import { BookOpenCheck, FileSearch, LayoutDashboard } from 'lucide-vue-next'
const router = useRouter()
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3] font-['Inter'] text-black">
    <AppHeader />
    <div class="flex">
      <RoleSidebar role="Staff" />
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
