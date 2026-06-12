<script setup>
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import {
  Bell,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
} from 'lucide-vue-next'

const router = useRouter()

const overviewCards = [
  { label: 'My FYP Status', value: 'Pending', note: 'Waiting for coordinator review' },
  { label: 'Pending Review', value: 1, note: 'Proposal submitted' },
  { label: 'Notifications', value: 2, note: 'Latest updates' },
  { label: 'Logbook', value: '-', note: 'Available after approval' },
]

const activities = [
  { text: 'Proposal submitted successfully.', date: '20 May 2026' },
  { text: 'Waiting for coordinator review.', date: '20 May 2026' },
]
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3] text-black font-['Inter']">
    <AppHeader />

    <div class="flex">
      <aside class="w-[240px] bg-[#f7f1ea] border-r border-[#d8c9bd] min-h-[calc(100vh-70px)] p-4">
        <div class="bg-white/80 border border-[#e1d5cc] rounded-[18px] p-4 mb-4">
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5c001f]">Student</p>
          <p class="text-sm text-gray-600 mt-1">FYP Workspace</p>
        </div>

        <nav class="space-y-2">
          <button class="w-full bg-[#5c001f] text-white rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold">
            <LayoutDashboard class="w-5 h-5 text-[#f8be17]" /> Dashboard
          </button>
          <button @click="router.push('/student-fyp')" class="w-full hover:bg-white text-[#2b1b1b] rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold">
            <FolderKanban class="w-5 h-5 text-[#5c001f]" /> My FYP
          </button>
          <button @click="router.push('/student-logbook')" class="w-full hover:bg-white text-[#2b1b1b] rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold">
            <BookOpenCheck class="w-5 h-5 text-[#5c001f]" /> Logbook
          </button>
        </nav>
      </aside>

      <main class="flex-1 p-8 space-y-7">
        <section class="rounded-[32px] bg-[#5c001f] text-white p-8 shadow-xl relative overflow-hidden">
          <div class="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[#f8be17]/20"></div>
          <p class="text-[#f8be17] font-bold uppercase tracking-[0.2em]">I-FAMOUS Student</p>
          <h1 class="text-[36px] font-bold mt-2">Welcome, Ahmad Daniel</h1>
          <p class="text-white/80 mt-2">Track your FYP progress, proposal status, supervisor assignment, logbook and feedback.</p>
        </section>

        <section class="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div v-for="card in overviewCards" :key="card.label" class="bg-white rounded-[24px] p-6 shadow-lg border border-black/10">
            <p class="text-sm font-bold text-gray-500">{{ card.label }}</p>
            <p class="text-[28px] font-bold text-[#5c001f] mt-2">{{ card.value }}</p>
            <p class="text-xs text-gray-500 mt-1">{{ card.note }}</p>
          </div>
        </section>

        <section class="grid grid-cols-1 xl:grid-cols-3 gap-7">
          <div class="xl:col-span-2 bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">Current FYP</p>
                <h2 class="text-[28px] font-bold mt-1">Smart Academic Advisor Audit System</h2>
                <p class="text-gray-600 mt-2">Proposal is submitted and waiting for coordinator review.</p>
              </div>
              <span class="px-4 py-2 rounded-full bg-[#fff3c4] text-[#5c001f] font-bold text-sm">Pending Review</span>
            </div>

            <div class="mt-7 rounded-[24px] bg-[#f7f1ea] border border-[#e1d5cc] p-6">
              <h3 class="font-bold text-xl">FYP Progress</h3>
              <div class="mt-6 grid grid-cols-5 items-center text-center gap-3">
                <div class="space-y-2">
                  <div class="mx-auto w-11 h-11 rounded-full bg-[#5c001f] text-white flex items-center justify-center font-bold">1</div>
                  <p class="text-xs font-bold">Proposal</p>
                </div>
                <div class="space-y-2">
                  <div class="mx-auto w-11 h-11 rounded-full bg-white border border-[#d8c9bd] flex items-center justify-center font-bold">2</div>
                  <p class="text-xs font-bold">Review</p>
                </div>
                <div class="space-y-2">
                  <div class="mx-auto w-11 h-11 rounded-full bg-white border border-[#d8c9bd] flex items-center justify-center font-bold">3</div>
                  <p class="text-xs font-bold">Progress</p>
                </div>
                <div class="space-y-2">
                  <div class="mx-auto w-11 h-11 rounded-full bg-white border border-[#d8c9bd] flex items-center justify-center font-bold">4</div>
                  <p class="text-xs font-bold">Final</p>
                </div>
                <div class="space-y-2">
                  <div class="mx-auto w-11 h-11 rounded-full bg-white border border-[#d8c9bd] flex items-center justify-center font-bold">5</div>
                  <p class="text-xs font-bold">Completed</p>
                </div>
              </div>
            </div>

            <div class="mt-7 grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div class="rounded-[22px] border border-[#e1d5cc] p-5">
                <p class="text-sm font-bold uppercase tracking-[0.15em] text-[#5c001f]">My FYP Summary</p>
                <div class="mt-4 space-y-2 text-sm">
                  <p><b>Type:</b> Development</p>
                  <p><b>Supervisor:</b> Not Assigned Yet</p>
                  <p><b>Examiner:</b> Not Assigned Yet</p>
                  <p><b>Next Action:</b> Wait for coordinator review</p>
                </div>
                <button @click="router.push('/student-fyp')" class="mt-5 bg-[#5c001f] text-white px-5 py-3 rounded-full font-bold">Open My FYP</button>
              </div>
              <div class="rounded-[22px] border border-[#e1d5cc] p-5">
                <p class="text-sm font-bold uppercase tracking-[0.15em] text-[#5c001f]">Submission Status</p>
                <div class="mt-4 divide-y divide-[#e1d5cc] text-sm">
                  <p class="py-3 flex justify-between"><span>Proposal Document</span><b class="text-green-700">Submitted</b></p>
                  <p class="py-3 flex justify-between"><span>Admin Form</span><b class="text-green-700">Submitted</b></p>
                  <p class="py-3 flex justify-between"><span>Proposal Presentation</span><b class="text-gray-500">Not Submitted</b></p>
                  <p class="py-3 flex justify-between"><span>Progress Report</span><b class="text-gray-500">Not Submitted</b></p>
                  <p class="py-3 flex justify-between"><span>Final Report</span><b class="text-gray-500">Not Submitted</b></p>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-bold">Latest Activities</h2>
              <Bell class="w-5 h-5 text-[#5c001f]" />
            </div>
            <div class="mt-5 space-y-4 text-sm">
              <div v-for="item in activities" :key="item.text" class="rounded-[18px] bg-[#f7f1ea] border border-[#e1d5cc] p-4 flex gap-3">
                <CheckCircle2 class="w-5 h-5 text-green-700 shrink-0" />
                <div><p class="font-bold">{{ item.text }}</p><p class="text-xs text-gray-500 mt-1">{{ item.date }}</p></div>
              </div>
              <div class="rounded-[18px] bg-[#fff3c4] border border-[#f8be17] p-4 flex gap-3 text-[#5c001f]">
                <Clock3 class="w-5 h-5 shrink-0" />
                <div><p class="font-bold">Coordinator review pending.</p><p class="text-xs mt-1">No new upload is allowed while a proposal is pending.</p></div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
