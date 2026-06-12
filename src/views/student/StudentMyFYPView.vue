<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CloudUpload,
  Eye,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  Pencil,
  Plus,
  Send,
  XCircle,
} from 'lucide-vue-next'

const router = useRouter()
const mode = ref('records')
const isExtracting = ref(false)
const isSubmitted = ref(false)
const selectedFileName = ref('')
const isDragging = ref(false)
const fileInput = ref(null)

const fypRecords = ref([
  {
    id: 1,
    title: 'Old Smart Attendance System',
    type: 'Development',
    status: 'Rejected',
    supervisor: '-',
    lastUpdated: '2 Apr 2026',
  },
  {
    id: 2,
    title: 'Smart Academic Advisor Audit System',
    type: 'Development',
    status: 'Pending Review',
    supervisor: 'Not Assigned',
    lastUpdated: '20 May 2026',
  },
])

const hasBlockedFyp = computed(() => {
  return fypRecords.value.some((item) =>
    ['Pending Review', 'Pending AI Matching', 'Pending Supervisor Assignment', 'Pending Supervisor Approval', 'Active', 'Revision Required'].includes(item.status)
  )
})

const canCreateFyp = computed(() => !hasBlockedFyp.value)

const form = ref({
  projectTitle: 'Software Engineering Smart Academic Advisor (AA) Audit System',
  projectType: 'Development',
  abstract: 'This system aims to develop a smart academic advisor audit system to monitor and analyze academic advising activities, academic progress, missing subjects, failed subjects and graduation readiness.',
  keywords: 'AI, Academic Advisor, Audit System, Software Engineering, Vue.js',
  members: '1. Ahmad Daniel Tamingsari Bin Ramlan (A24MJ5074)',
})

const statusClass = (status) => {
  if (status === 'Active') return 'bg-green-100 text-green-800'
  if (status === 'Rejected') return 'bg-red-100 text-red-800'
  if (status === 'Revision Required') return 'bg-orange-100 text-orange-800'
  if (status.includes('Pending')) return 'bg-[#fff3c4] text-[#5c001f]'
  return 'bg-gray-100 text-gray-700'
}

const startCreateFlow = () => {
  if (!canCreateFyp.value) return
  mode.value = 'create'
  isSubmitted.value = false
}

const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt']

const processProposalFile = (file) => {
  if (!file) return

  const fileName = file.name.toLowerCase()
  const validExtension = allowedExtensions.some((extension) => fileName.endsWith(extension))

  if (!validExtension) {
    alert('Only PDF, DOC, DOCX, or TXT proposal files are allowed.')
    return
  }

  selectedFileName.value = file.name
  isExtracting.value = true

  setTimeout(() => {
    isExtracting.value = false
    mode.value = 'review'
  }, 700)
}

const handleUpload = async (event) => {
  const file = event.target.files?.[0]
  processProposalFile(file)
}

const handleDrop = (event) => {
  isDragging.value = false
  const file = event.dataTransfer.files?.[0]
  processProposalFile(file)
}

const submitProposal = () => {
  isSubmitted.value = true
  mode.value = 'submitted'
}
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
          <button @click="router.push('/student-dashboard')" class="w-full hover:bg-white text-[#2b1b1b] rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold">
            <LayoutDashboard class="w-5 h-5 text-[#5c001f]" /> Dashboard
          </button>
          <button class="w-full bg-[#5c001f] text-white rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold">
            <FolderKanban class="w-5 h-5 text-[#f8be17]" /> My FYP
          </button>
          <button @click="router.push('/student-logbook')" class="w-full hover:bg-white text-[#2b1b1b] rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold">
            <BookOpenCheck class="w-5 h-5 text-[#5c001f]" /> Logbook
          </button>
        </nav>
      </aside>

      <main class="flex-1 p-8 space-y-7">
        <section class="rounded-[32px] bg-[#5c001f] text-white p-8 shadow-xl relative overflow-hidden">
          <div class="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[#f8be17]/20"></div>
          <p class="text-[#f8be17] font-bold uppercase tracking-[0.2em]">Student Module</p>
          <h1 class="text-[36px] font-bold mt-2">My FYP</h1>
          <p class="text-white/80 mt-2">Create FYP only when you have no active or pending FYP. Rejected projects remain as history.</p>
        </section>

        <section v-if="mode === 'records'" class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">FYP Records</p>
              <h2 class="text-[28px] font-bold mt-1">My FYP Attempts</h2>
              <p class="text-gray-600 mt-1">A student can only have one pending or active FYP at a time.</p>
            </div>
            <button
              @click="startCreateFlow"
              :disabled="!canCreateFyp"
              :class="canCreateFyp ? 'bg-[#5c001f] text-white hover:bg-[#4a0019]' : 'bg-gray-200 text-gray-500 cursor-not-allowed'"
              class="px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-colors"
            >
              <Plus class="w-5 h-5" /> Create FYP
            </button>
          </div>

          <div v-if="!canCreateFyp" class="mb-6 rounded-[20px] bg-[#fff3c4] border border-[#f8be17] p-5 text-[#5c001f] flex gap-3">
            <AlertTriangle class="w-6 h-6 shrink-0" />
            <div>
              <p class="font-bold">Create FYP is locked.</p>
              <p class="text-sm mt-1">You already have a pending or active FYP. Wait for review, approval, or final rejection before creating a new FYP proposal.</p>
            </div>
          </div>

          <div class="overflow-x-auto rounded-[22px] border border-[#e1d5cc]">
            <table class="w-full text-sm">
              <thead class="bg-[#f7f1ea] text-left">
                <tr>
                  <th class="px-5 py-4">No.</th>
                  <th>Project Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Supervisor</th>
                  <th>Last Updated</th>
                  <th class="text-right pr-5">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(record, index) in fypRecords" :key="record.id" class="border-t border-[#e1d5cc]">
                  <td class="px-5 py-4 font-bold">{{ index + 1 }}</td>
                  <td class="font-bold max-w-[260px]">{{ record.title }}</td>
                  <td>{{ record.type }}</td>
                  <td><span :class="statusClass(record.status)" class="px-3 py-1 rounded-full font-bold text-xs">{{ record.status }}</span></td>
                  <td>{{ record.supervisor }}</td>
                  <td>{{ record.lastUpdated }}</td>
                  <td class="text-right pr-5"><button class="inline-flex items-center gap-2 text-[#5c001f] font-bold"><Eye class="w-4 h-4" /> View</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="mode === 'create'" class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
          <div class="flex items-center justify-between mb-6">
            <div>
              <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">Create FYP</p>
              <h2 class="text-[28px] font-bold">Step 1: Enter Basic FYP Information</h2>
            </div>
            <button @click="mode = 'records'" class="text-[#5c001f] font-bold">Back to records</button>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label class="block text-sm font-bold mb-2">Project Type</label>
              <select v-model="form.projectType" class="w-full rounded-[16px] border border-[#d8c9bd] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f8be17]"><option>Development</option><option>Research</option></select>
            </div>
            <div>
              <label class="block text-sm font-bold mb-2">Project Title / Working Title</label>
              <input v-model="form.projectTitle" class="w-full rounded-[16px] border border-[#d8c9bd] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f8be17]" />
            </div>
          </div>
          <div class="mt-5">
            <label class="block text-sm font-bold mb-2">Short Description</label>
            <textarea v-model="form.abstract" rows="4" class="w-full rounded-[16px] border border-[#d8c9bd] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f8be17]"></textarea>
          </div>
          <div class="mt-7 flex justify-end"><button @click="mode = 'upload'" class="bg-[#5c001f] text-white px-6 py-3 rounded-full font-bold flex items-center gap-2">Next <ChevronRight class="w-5 h-5" /></button></div>
        </section>

        <section v-if="mode === 'upload'" class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
          <div
            class="rounded-[26px] border-2 border-dashed p-10 text-center transition-all duration-200"
            :class="isDragging ? 'border-[#5c001f] bg-[#fff3c4] scale-[1.01]' : 'border-[#d4bfae] bg-[#f7f1ea]'"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
          >
            <CloudUpload class="w-16 h-16 mx-auto text-[#5c001f]" />
            <h2 class="text-2xl font-bold mt-4">Step 2: Upload Proposal Document</h2>
            <p class="text-sm text-gray-600 mt-2">Supported: .pdf, .doc, .docx, .txt. Drag and drop your file here or choose manually.</p>
            <input ref="fileInput" class="hidden" type="file" accept=".pdf,.doc,.docx,.txt" @change="handleUpload" />
            <button
              type="button"
              @click="fileInput?.click()"
              class="mt-6 inline-flex items-center gap-2 bg-[#5c001f] text-white px-6 py-3 rounded-full font-bold cursor-pointer"
            >
              <Loader2 v-if="isExtracting" class="w-5 h-5 animate-spin text-[#f8be17]" />
              <FileText v-else class="w-5 h-5" />
              {{ isExtracting ? 'Extracting...' : 'Choose File' }}
            </button>
            <p class="mt-4 text-sm text-gray-600">Drop proposal file anywhere inside this box.</p>
            <p v-if="selectedFileName" class="mt-4 text-sm font-bold text-[#5c001f]">Selected: {{ selectedFileName }}</p>
          </div>
          <div class="mt-7 flex justify-between"><button @click="mode = 'create'" class="bg-[#e7ded3] text-[#5c001f] px-6 py-3 rounded-full font-bold">Back</button></div>
        </section>

        <section v-if="mode === 'review'" class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
          <div class="flex items-center justify-between gap-4 mb-6">
            <div>
              <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">Review Extracted Details</p>
              <h2 class="text-[28px] font-bold">Step 3: Confirm Project Information</h2>
            </div>
            <span class="px-4 py-2 rounded-full bg-[#fff3c4] text-[#5c001f] font-bold text-sm">AI Extracted</span>
          </div>
          <div class="space-y-5">
            <div><label class="block text-sm font-bold mb-2">Project Title</label><input v-model="form.projectTitle" class="w-full rounded-[16px] border border-[#d8c9bd] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f8be17]" /></div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div><label class="block text-sm font-bold mb-2">Project Type</label><select v-model="form.projectType" class="w-full rounded-[16px] border border-[#d8c9bd] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f8be17]"><option>Development</option><option>Research</option></select></div>
              <div><label class="block text-sm font-bold mb-2">Keywords</label><input v-model="form.keywords" class="w-full rounded-[16px] border border-[#d8c9bd] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f8be17]" /></div>
            </div>
            <div><label class="block text-sm font-bold mb-2">Project Members</label><textarea v-model="form.members" rows="4" class="w-full rounded-[16px] border border-[#d8c9bd] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f8be17]"></textarea></div>
            <div><label class="block text-sm font-bold mb-2">Abstract / Problem Statement</label><textarea v-model="form.abstract" rows="6" class="w-full rounded-[16px] border border-[#d8c9bd] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f8be17]"></textarea></div>
          </div>
          <div class="mt-7 flex justify-between"><button @click="mode = 'upload'" class="bg-[#e7ded3] text-[#5c001f] px-6 py-3 rounded-full font-bold">Back</button><button @click="submitProposal" class="bg-[#5c001f] text-white px-6 py-3 rounded-full font-bold flex items-center gap-2"><Send class="w-4 h-4 text-[#f8be17]" /> Submit to Coordinator</button></div>
        </section>

        <section v-if="mode === 'submitted'" class="bg-white rounded-[28px] p-10 shadow-lg border border-black/10 text-center">
          <CheckCircle2 class="w-20 h-20 mx-auto text-green-700" />
          <h2 class="text-[30px] font-bold mt-4">Proposal Submitted</h2>
          <p class="text-gray-600 mt-2">Your proposal has been sent to coordinator review.</p>
          <div class="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#fff3c4] text-[#5c001f] font-bold"><ClipboardList class="w-5 h-5" /> Status: Pending Review</div>
          <div class="mt-7"><button @click="mode = 'records'" class="bg-[#5c001f] text-white px-6 py-3 rounded-full font-bold">Go to My FYP</button></div>
        </section>
      </main>
    </div>
  </div>
</template>
