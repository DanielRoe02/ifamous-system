<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { ArrowLeft, CheckCircle2, Download, FileText, MessageSquare, XCircle } from 'lucide-vue-next'
const router = useRouter()
const decision = ref('')
const feedback = ref('The proposal is well structured and the objectives are clear. Please consider enhancing the methodology section.')
const submitDecision = (type) => { decision.value = type }
</script>
<template>
  <div class="min-h-screen bg-[#e7ded3] font-['Inter'] text-black">
    <AppHeader />
    <main class="p-8 max-w-[1180px] mx-auto space-y-7">
      <button @click="router.push('/supervisor-projects')" class="flex items-center gap-2 text-[#5c001f] font-bold"><ArrowLeft class="w-5 h-5" /> Back to Assigned Projects</button>
      <section class="rounded-[32px] bg-[#5c001f] text-white p-8 shadow-xl"><p class="text-[#f8be17] font-bold uppercase tracking-[0.2em]">Review & Decision</p><h1 class="text-[34px] font-bold mt-2">Smart Academic Advisor Audit System</h1><p class="text-white/80 mt-2">Supervisor reviews assigned proposal and decides whether to approve, reject or request revision.</p></section>
      <section class="grid grid-cols-1 xl:grid-cols-3 gap-7">
        <div class="xl:col-span-2 bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
          <h2 class="text-[28px] font-bold">Proposal Document</h2>
          <div class="mt-5 rounded-[24px] border border-[#e1d5cc] bg-[#f7f1ea] p-6">
            <div class="flex items-center justify-between gap-4"><div class="flex items-center gap-3"><FileText class="w-6 h-6 text-[#5c001f]" /><div><p class="font-bold">proposal_daniel.pdf</p><p class="text-sm text-gray-600">Student: Ahmad Daniel · A24MJ5074</p></div></div><button class="bg-[#5c001f] text-white px-4 py-2 rounded-full font-bold flex items-center gap-2"><Download class="w-4 h-4" /> Download</button></div>
            <div class="mt-6 bg-white rounded-[20px] p-5 text-sm text-gray-700 leading-relaxed"><p class="font-bold text-[#5c001f] mb-2">Abstract Preview</p>This system aims to develop a smart academic advisor audit system to monitor academic progress, missing subjects, failed subjects and graduation readiness.</div>
          </div>
          <div class="mt-6"><label class="block text-sm font-bold mb-2">Comments / Feedback</label><textarea v-model="feedback" rows="6" class="w-full rounded-[18px] border border-[#d8c9bd] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f8be17]"></textarea></div>
          <div class="mt-6 flex flex-wrap gap-3"><button @click="submitDecision('Approved')" class="bg-green-600 text-white px-6 py-3 rounded-full font-bold">Approve</button><button @click="submitDecision('Revision Required')" class="bg-[#f8be17] text-[#5c001f] px-6 py-3 rounded-full font-bold">Request Revision</button><button @click="submitDecision('Rejected')" class="bg-red-600 text-white px-6 py-3 rounded-full font-bold">Reject</button></div>
        </div>
        <div class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
          <h2 class="text-xl font-bold">Decision Status</h2>
          <div v-if="decision" class="mt-5 rounded-[20px] bg-green-50 border border-green-200 p-5 text-green-800"><CheckCircle2 class="w-8 h-8 mb-3" /><p class="font-bold">Decision submitted: {{ decision }}</p><p class="text-sm mt-1">Student and coordinator will be notified.</p></div>
          <div v-else class="mt-5 rounded-[20px] bg-[#f7f1ea] border border-[#e1d5cc] p-5 text-gray-700"><MessageSquare class="w-8 h-8 text-[#5c001f] mb-3" /><p class="font-bold">Waiting for supervisor decision.</p><p class="text-sm mt-1">Approve, reject, or request revision after reviewing the proposal.</p></div>
          <div class="mt-6 rounded-[20px] bg-[#fff3c4] border border-[#f8be17] p-5 text-[#5c001f] text-sm"><p class="font-bold">Logbook Approval</p><p class="mt-1">Pending logbook review can be handled after project supervision starts.</p></div>
        </div>
      </section>
    </main>
  </div>
</template>
