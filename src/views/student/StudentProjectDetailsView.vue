<script setup>
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { ArrowLeft, CheckCircle2, Clock, FileText, UserRound } from 'lucide-vue-next'
const router = useRouter()
const timeline = ['Proposal Submitted', 'Pending Coordinator Review', 'Pending AI Matching', 'Pending Supervisor Assignment', 'Pending Supervisor Approval', 'Approved']
</script>
<template>
  <div class="min-h-screen bg-[#e7ded3] font-['Inter'] text-black">
    <AppHeader />
    <main class="p-8 max-w-[1180px] mx-auto space-y-7">
      <button @click="router.push('/student-dashboard')" class="flex items-center gap-2 text-[#5c001f] font-bold"><ArrowLeft class="w-5 h-5" /> Back to Dashboard</button>
      <section class="rounded-[32px] bg-[#5c001f] text-white p-8 shadow-xl">
        <p class="text-[#f8be17] font-bold uppercase tracking-[0.2em]">My Project Details</p>
        <h1 class="text-[34px] font-bold mt-2">Software Engineering Smart Academic Advisor Audit System</h1>
        <p class="text-white/80 mt-2">View proposal details, supervisor/examiner assignment, documents, timeline and feedback.</p>
      </section>
      <section class="grid grid-cols-1 xl:grid-cols-3 gap-7">
        <div class="xl:col-span-2 bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
          <h2 class="text-[28px] font-bold">Project Information</h2>
          <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div class="rounded-[20px] bg-[#f7f1ea] p-5 border border-[#e1d5cc]"><p class="text-sm text-gray-500 font-bold">Project Type</p><p class="font-bold mt-1">Development</p></div>
            <div class="rounded-[20px] bg-[#f7f1ea] p-5 border border-[#e1d5cc]"><p class="text-sm text-gray-500 font-bold">Current Status</p><p class="font-bold mt-1 text-[#5c001f]">Pending Coordinator Review</p></div>
            <div class="rounded-[20px] bg-[#f7f1ea] p-5 border border-[#e1d5cc]"><p class="text-sm text-gray-500 font-bold">Supervisor</p><p class="font-bold mt-1">Ts. Dr. Wong Mei Ling</p></div>
            <div class="rounded-[20px] bg-[#f7f1ea] p-5 border border-[#e1d5cc]"><p class="text-sm text-gray-500 font-bold">Examiner</p><p class="font-bold mt-1">Not Assigned Yet</p></div>
          </div>
          <div class="mt-6 rounded-[20px] border border-[#e1d5cc] p-5"><p class="font-bold text-[#5c001f]">Abstract</p><p class="text-gray-700 mt-2 leading-relaxed">This system supports academic advising by tracking student progress, failed subjects, missed courses, remaining credit hours and graduation readiness.</p></div>
          <div class="mt-6 rounded-[20px] border border-[#e1d5cc] p-5"><p class="font-bold text-[#5c001f]">Documents</p><div class="mt-3 space-y-3"><p class="flex gap-3"><FileText class="w-5 h-5 text-[#5c001f]" /> proposal_daniel.pdf</p><p class="flex gap-3"><FileText class="w-5 h-5 text-[#5c001f]" /> admin_form.pdf</p></div></div>
        </div>
        <div class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
          <h2 class="text-xl font-bold">Status Timeline</h2>
          <div class="mt-5 space-y-4">
            <div v-for="(item, index) in timeline" :key="item" class="flex gap-3">
              <div :class="index < 2 ? 'bg-green-600' : 'bg-gray-300'" class="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0">
                <CheckCircle2 v-if="index < 2" class="w-5 h-5" /><Clock v-else class="w-5 h-5" />
              </div>
              <div><p class="font-bold text-sm">{{ item }}</p><p class="text-xs text-gray-500">{{ index < 2 ? 'Completed' : 'Waiting' }}</p></div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
