<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import AppFooter from '@/components/AppFooter.vue'
import {
  UploadCloud,
  FileText,
  BrainCircuit,
  Users,
  AlertTriangle,
  ArrowRight,
  Search,
  Sparkles,
  ClipboardList,
  UserCheck,
  FolderKanban,
  Eye,
  Mail,
  Phone,
  Building2,
  BadgeCheck,
  BookOpen,
  Loader2,
  CheckCircle2,
  Plus,
  Trash2,
} from 'lucide-vue-next'

const router = useRouter()

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const activeTab = ref('upload')
const isMatching = ref(false)
const isExtracting = ref(false)
const matchError = ref('')
const extractError = ref('')
const extractSuccess = ref('')
const matchSource = ref('demo')
const extractionSource = ref('none')

const proposalForm = ref({
  members: [],
  memberText: '',
  studentName: '',
  matricNo: '',
  projectTitle: '',
  projectType: 'Development',
  abstract: '',
  keywords: '',
})

const selectedFileName = ref('')

const recommendedSupervisors = ref([
  {
    rank: 1,
    name: 'Ts. Dr. Wong Mei Ling',
    title: 'Senior Lecturer',
    faculty: 'Faculty of Computing',
    department: 'Software Engineering',
    email: 'wong.meiling@utm.my',
    phone: '+60 13-555 6789',
    expertise: 'Artificial Intelligence, Machine Learning, Data Analytics',
    score: 94,
    workload: 'Available',
    recentProjects: [
      'AI-Based Academic Recommendation System',
      'Student Performance Prediction Dashboard',
      'Smart Assessment Analytics Platform',
    ],
    reason:
      'Strong match with AI-based analysis, prediction, and intelligent academic workflow automation.',
    status: 'Best Match',
  },
  {
    rank: 2,
    name: 'Dr. David Kumar',
    title: 'Senior Lecturer',
    faculty: 'Faculty of Computing',
    department: 'Software Engineering',
    email: 'david.kumar@utm.my',
    phone: '+60 12-444 8912',
    expertise: 'Software Engineering, Web Application, System Architecture',
    score: 87,
    workload: 'Available',
    recentProjects: [
      'Web-Based Academic Management System',
      'Modular Assessment Workflow Platform',
      'Software Architecture for Student Portal',
    ],
    reason:
      'Suitable for projects involving web-based platforms, backend workflow, dashboard design, and software architecture.',
    status: 'Recommended',
  },
  {
    rank: 3,
    name: 'Dr. Lim Wei Jie',
    title: 'Lecturer',
    faculty: 'Faculty of Computing',
    department: 'Information Systems',
    email: 'lim.weijie@utm.my',
    phone: '+60 11-222 7634',
    expertise: 'Database Systems, Academic Information Systems, Automation',
    score: 81,
    workload: 'Moderate',
    recentProjects: [
      'Database-Driven Academic Record System',
      'Automated Course Registration Workflow',
      'Academic Information Management Dashboard',
    ],
    reason:
      'Good match for projects requiring structured data management, automated academic processes, and database-driven system design.',
    status: 'Alternative',
  },
])

const selectedSupervisor = ref(recommendedSupervisors.value[0])

const sampleProjects = ref([
  {
    members: '4 Members',
    title: 'Software Engineering Smart Academic Advisor Audit System',
    supervisor: 'Pending',
    status: 'Needs Match',
  },
  {
    members: '2 Members',
    title: 'Smart Timetable Conflict Detection',
    supervisor: 'Ts. Dr. Wong Mei Ling',
    status: 'Assigned',
  },
  {
    members: '1 Member',
    title: 'IoT-Based Academic Monitoring System',
    supervisor: 'Dr. Lim Wei Jie',
    status: 'In Review',
  },
])

const updateMemberText = () => {
  proposalForm.value.memberText = proposalForm.value.members
    .filter((member) => member.name || member.matricNo)
    .map((member, index) => `${index + 1}. ${member.name || 'Unnamed'} (${member.matricNo || 'No matric'})`)
    .join('\n')

  proposalForm.value.studentName = proposalForm.value.members[0]?.name || ''
  proposalForm.value.matricNo = proposalForm.value.members[0]?.matricNo || ''
}

const addMember = () => {
  proposalForm.value.members.push({
    name: '',
    matricNo: '',
  })
  updateMemberText()
}

const removeMember = (index) => {
  proposalForm.value.members.splice(index, 1)
  updateMemberText()
}

const handleFileUpload = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  selectedFileName.value = file.name
  extractError.value = ''
  extractSuccess.value = ''
  extractionSource.value = 'none'

  try {
    isExtracting.value = true

    const formData = new FormData()
    formData.append('proposal', file)

    const response = await fetch(`${API_BASE_URL}/api/supervisor-matching/extract-proposal`, {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to extract proposal file.')
    }

    const extracted = data.extracted || {}
    const members = Array.isArray(extracted.members) ? extracted.members : []

    proposalForm.value = {
      members,
      memberText:
        extracted.memberText ||
        members
          .map((member, index) => `${index + 1}. ${member.name || ''} (${member.matricNo || ''})`)
          .join('\n'),
      studentName: extracted.studentName || members[0]?.name || '',
      matricNo: extracted.matricNo || members[0]?.matricNo || '',
      projectTitle: extracted.projectTitle || proposalForm.value.projectTitle,
      projectType: extracted.projectType || proposalForm.value.projectType || 'Development',
      abstract: extracted.abstract || proposalForm.value.abstract,
      keywords: extracted.keywords || proposalForm.value.keywords,
    }

    extractionSource.value = data.extractionSource || 'unknown'
    extractSuccess.value = `Proposal extracted successfully from ${file.name}.`
  } catch (error) {
    console.error('Proposal extraction error:', error)
    extractError.value =
      error.message || 'Failed to extract proposal. Please use .txt, .docx, or text-based .pdf.'
  } finally {
    isExtracting.value = false
  }
}

const fillSampleProposal = () => {
  proposalForm.value = {
    members: [
      { name: 'Shaikh Amir Husaini Bin Sh.Mohd Saifuddeen', matricNo: 'A24MJ5068' },
      { name: 'Ahmad Fadzril Bin Ahmad Badril', matricNo: 'A24MJ5050' },
      { name: 'Ahmad Daniel Tamingsari Bin Ramlan', matricNo: 'A24MJ5074' },
      { name: 'Adlan Hazim Bin Abdul Rahman', matricNo: 'A24MJ5056' },
    ],
    memberText:
      '1. Shaikh Amir Husaini Bin Sh.Mohd Saifuddeen (A24MJ5068)\n2. Ahmad Fadzril Bin Ahmad Badril (A24MJ5050)\n3. Ahmad Daniel Tamingsari Bin Ramlan (A24MJ5074)\n4. Adlan Hazim Bin Abdul Rahman (A24MJ5056)',
    studentName: 'Shaikh Amir Husaini Bin Sh.Mohd Saifuddeen',
    matricNo: 'A24MJ5068',
    projectTitle: 'Software Engineering Smart Academic Advisor (AA) Audit System',
    projectType: 'Development',
    abstract:
      'Managing academic progression is a significant challenge for students who must navigate complex course structures while tracking failed or missed subjects. Traditional methods of checking graduation eligibility are manual and prone to human error, often leading to delayed graduations due to missing credit hours. The system addresses this by implementing a Vue.js-based Credit Audit Dashboard that identifies failed or missed subjects and calculates remaining credit hours in real time.',
    keywords:
      'Vue.js, Academic Advisor, Credit Audit Dashboard, Reactive State Management, Pinia, Academic Progression, Graduation Eligibility',
  }

  extractSuccess.value = 'Demo group proposal data filled successfully.'
  extractError.value = ''
}

const runAIMatch = async () => {
  matchError.value = ''

  if (
    !proposalForm.value.projectTitle &&
    !proposalForm.value.abstract &&
    !proposalForm.value.keywords
  ) {
    matchError.value = 'Please enter or upload proposal details before running AI matching.'
    activeTab.value = 'matching'
    return
  }

  try {
    isMatching.value = true
    activeTab.value = 'matching'

    const response = await fetch(`${API_BASE_URL}/api/supervisor-matching/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(proposalForm.value),
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to run AI supervisor matching.')
    }

    recommendedSupervisors.value = data.recommendations || []
    selectedSupervisor.value = recommendedSupervisors.value[0] || selectedSupervisor.value
    matchSource.value = data.source || 'unknown'
  } catch (error) {
    console.error('AI supervisor matching error:', error)
    matchError.value =
      error.message || 'AI matching failed. Please make sure the backend is running.'
  } finally {
    isMatching.value = false
  }
}

const viewSupervisorProfile = (supervisor) => {
  selectedSupervisor.value = supervisor
  activeTab.value = 'profile'
}

const assignSupervisor = (supervisorName) => {
  alert(`${supervisorName} has been selected as the recommended supervisor for this project.`)
}

const goToDashboard = () => {
  router.push('/dashboard')
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[#e7ded3] w-full font-['Inter'] text-black">
    <AppHeader />

    <div class="flex flex-1 w-full relative">
      <AppSidebar />

      <main class="flex-1 flex flex-col px-[50px] py-[30px] gap-8 overflow-y-auto">
        <!-- Page Header -->
        <section
          class="relative overflow-hidden rounded-[32px] bg-[#5c001f] text-white shadow-xl border border-black/10"
        >
          <div class="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[#f8be17]/20"></div>
          <div class="absolute right-20 bottom-[-70px] w-40 h-40 rounded-full bg-white/10"></div>

          <div class="relative p-8 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
            <div>
              <div class="flex items-center gap-3 mb-4">
                <div
                  class="w-12 h-12 rounded-2xl bg-[#f8be17] flex items-center justify-center shadow-md"
                >
                  <FolderKanban class="w-7 h-7 text-[#5c001f]" />
                </div>

                <div>
                  <p class="text-[#f8be17] font-bold text-sm uppercase tracking-[0.2em]">
                    Coordinator Module
                  </p>
                  <h1 class="font-bold text-[36px] leading-tight">Manage FYP Proposals</h1>
                </div>
              </div>

              <p class="text-white/80 max-w-3xl text-[16px] leading-relaxed">
                Upload individual or group proposal files, extract project members and proposal
                content, then run AI supervisor matching.
              </p>
            </div>

            <div class="flex flex-col sm:flex-row gap-3">
              <button
                @click="fillSampleProposal"
                class="bg-[#f8be17] text-[#5c001f] px-6 py-3 rounded-full font-bold hover:bg-[#ffd45a] transition-colors shadow-md border-none flex items-center gap-2"
              >
                <Sparkles class="w-5 h-5" />
                Fill Demo Data
              </button>

              <button
                @click="goToDashboard"
                class="bg-white/10 text-white px-6 py-3 rounded-full font-bold hover:bg-white/20 transition-colors border border-white/20 flex items-center gap-2"
              >
                Back Dashboard
                <ArrowRight class="w-5 h-5" />
              </button>
            </div>
          </div>
        </section>

        <!-- Workflow Cards -->
        <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div class="bg-white rounded-[26px] p-6 shadow-lg border border-black/10">
            <div class="w-14 h-14 rounded-2xl bg-[#5c001f] p-3 flex items-center justify-center">
              <UploadCloud class="w-7 h-7 text-[#f8be17]" />
            </div>
            <p class="text-gray-500 font-semibold mt-5">Step 1</p>
            <h3 class="text-xl font-bold text-black mt-1">Upload Proposal</h3>
            <p class="text-sm text-gray-500 mt-2">
              Upload .txt, .docx, or text-based .pdf proposal file.
            </p>
          </div>

          <div class="bg-white rounded-[26px] p-6 shadow-lg border border-black/10">
            <div class="w-14 h-14 rounded-2xl bg-[#5c001f] p-3 flex items-center justify-center">
              <Users class="w-7 h-7 text-[#f8be17]" />
            </div>
            <p class="text-gray-500 font-semibold mt-5">Step 2</p>
            <h3 class="text-xl font-bold text-black mt-1">Extract Members</h3>
            <p class="text-sm text-gray-500 mt-2">
              Detect individual or group project members automatically.
            </p>
          </div>

          <div class="bg-white rounded-[26px] p-6 shadow-lg border border-black/10">
            <div class="w-14 h-14 rounded-2xl bg-[#5c001f] p-3 flex items-center justify-center">
              <BrainCircuit class="w-7 h-7 text-[#f8be17]" />
            </div>
            <p class="text-gray-500 font-semibold mt-5">Step 3</p>
            <h3 class="text-xl font-bold text-black mt-1">AI Matching</h3>
            <p class="text-sm text-gray-500 mt-2">
              Compare project content with lecturer expertise.
            </p>
          </div>

          <div class="bg-white rounded-[26px] p-6 shadow-lg border border-black/10">
            <div class="w-14 h-14 rounded-2xl bg-[#5c001f] p-3 flex items-center justify-center">
              <UserCheck class="w-7 h-7 text-[#f8be17]" />
            </div>
            <p class="text-gray-500 font-semibold mt-5">Step 4</p>
            <h3 class="text-xl font-bold text-black mt-1">Assign Supervisor</h3>
            <p class="text-sm text-gray-500 mt-2">
              Coordinator confirms the recommended supervisor.
            </p>
          </div>
        </section>

        <!-- Main Panel -->
        <section class="bg-white rounded-[28px] shadow-lg border border-black/10 overflow-hidden">
          <!-- Tabs -->
          <div class="bg-[#f7f1ea] px-7 pt-7 border-b border-[#e1d5cc]">
            <div class="flex flex-wrap gap-3">
              <button
                @click="activeTab = 'upload'"
                :class="[
                  'px-5 py-3 rounded-t-[18px] font-bold flex items-center gap-2 transition-colors',
                  activeTab === 'upload'
                    ? 'bg-[#5c001f] text-white'
                    : 'bg-white text-[#5c001f] hover:bg-[#fff8df]',
                ]"
              >
                <UploadCloud class="w-5 h-5" />
                Upload Proposal
              </button>

              <button
                @click="activeTab = 'matching'"
                :class="[
                  'px-5 py-3 rounded-t-[18px] font-bold flex items-center gap-2 transition-colors',
                  activeTab === 'matching'
                    ? 'bg-[#5c001f] text-white'
                    : 'bg-white text-[#5c001f] hover:bg-[#fff8df]',
                ]"
              >
                <BrainCircuit class="w-5 h-5" />
                AI Matching Result
              </button>

              <button
                @click="activeTab = 'profile'"
                :class="[
                  'px-5 py-3 rounded-t-[18px] font-bold flex items-center gap-2 transition-colors',
                  activeTab === 'profile'
                    ? 'bg-[#5c001f] text-white'
                    : 'bg-white text-[#5c001f] hover:bg-[#fff8df]',
                ]"
              >
                <Users class="w-5 h-5" />
                Lecturer Profile
              </button>

              <button
                @click="activeTab = 'records'"
                :class="[
                  'px-5 py-3 rounded-t-[18px] font-bold flex items-center gap-2 transition-colors',
                  activeTab === 'records'
                    ? 'bg-[#5c001f] text-white'
                    : 'bg-white text-[#5c001f] hover:bg-[#fff8df]',
                ]"
              >
                <ClipboardList class="w-5 h-5" />
                Project Records
              </button>
            </div>
          </div>

          <!-- Upload Tab -->
          <div v-if="activeTab === 'upload'" class="p-7 grid grid-cols-1 2xl:grid-cols-3 gap-7">
            <!-- Upload Area -->
            <div class="2xl:col-span-1">
              <div
                class="h-full rounded-[26px] border-2 border-dashed border-[#d4bfae] bg-[#f7f1ea] p-7 flex flex-col items-center justify-center text-center"
              >
                <div
                  class="w-20 h-20 rounded-[26px] bg-[#5c001f] flex items-center justify-center shadow-md"
                >
                  <UploadCloud class="w-10 h-10 text-[#f8be17]" />
                </div>

                <h3 class="text-2xl font-bold mt-5">Upload Proposal File</h3>
                <p class="text-gray-600 mt-2 text-sm leading-relaxed">
                  Upload Word, PDF, or text proposal. The system extracts project members,
                  title, abstract, and keywords automatically.
                </p>

                <label
                  class="mt-6 bg-[#5c001f] text-white px-6 py-3 rounded-full font-bold hover:bg-[#4a0019] transition-colors cursor-pointer flex items-center gap-2"
                  :class="{ 'opacity-60 cursor-not-allowed': isExtracting }"
                >
                  <Loader2 v-if="isExtracting" class="w-5 h-5 text-[#f8be17] animate-spin" />
                  <FileText v-else class="w-5 h-5" />
                  {{ isExtracting ? 'Extracting...' : 'Choose File' }}
                  <input
                    type="file"
                    class="hidden"
                    accept=".pdf,.docx,.txt"
                    :disabled="isExtracting"
                    @change="handleFileUpload"
                  />
                </label>

                <p v-if="selectedFileName" class="mt-4 text-sm font-bold text-[#5c001f]">
                  Selected: {{ selectedFileName }}
                </p>

                <div
                  v-if="extractSuccess"
                  class="mt-5 w-full rounded-[18px] bg-green-50 border border-green-200 p-4 text-left"
                >
                  <div class="flex gap-3">
                    <CheckCircle2 class="w-5 h-5 text-green-700 shrink-0" />
                    <div>
                      <p class="text-sm font-bold text-green-700">Extraction Complete</p>
                      <p class="text-xs text-green-700 mt-1">{{ extractSuccess }}</p>
                      <p class="text-xs text-green-700 mt-1">
                        Source:
                        {{ extractionSource === 'groq' ? 'Groq AI' : 'Fallback extraction' }}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  v-if="extractError"
                  class="mt-5 w-full rounded-[18px] bg-red-50 border border-red-200 p-4 text-left"
                >
                  <div class="flex gap-3">
                    <AlertTriangle class="w-5 h-5 text-red-700 shrink-0" />
                    <div>
                      <p class="text-sm font-bold text-red-700">Extraction Failed</p>
                      <p class="text-xs text-red-700 mt-1">{{ extractError }}</p>
                    </div>
                  </div>
                </div>

                <div class="mt-8 w-full rounded-[20px] bg-white border border-[#e1d5cc] p-4">
                  <p class="text-sm font-bold text-[#5c001f]">Supported Files</p>
                  <p class="text-xs text-gray-600 mt-1">
                    .txt, .docx, and text-based .pdf. Scanned PDF needs OCR later.
                  </p>
                </div>
              </div>
            </div>

            <!-- Form Area -->
            <div class="2xl:col-span-2">
              <div class="rounded-[26px] border border-[#e1d5cc] p-7">
                <div class="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
                      Proposal Information
                    </p>
                    <h2 class="text-[28px] font-bold mt-1">Project Details</h2>
                  </div>

                  <button
                    @click="fillSampleProposal"
                    class="bg-[#fff3c4] text-[#5c001f] px-5 py-2.5 rounded-full font-bold hover:bg-[#f8be17] transition-colors border-none flex items-center gap-2"
                  >
                    <Sparkles class="w-4 h-4" />
                    Demo Fill
                  </button>
                </div>

                <!-- Project Members -->
                <div class="rounded-[24px] bg-[#f7f1ea] border border-[#e1d5cc] p-5 mb-6">
                  <div class="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
                        Project Members
                      </p>
                      <p class="text-sm text-gray-600 mt-1">
                        Supports individual and group FYP proposals.
                      </p>
                    </div>

                    <button
                      @click="addMember"
                      class="bg-[#5c001f] text-white px-4 py-2 rounded-full font-bold hover:bg-[#4a0019] transition-colors border-none flex items-center gap-2"
                    >
                      <Plus class="w-4 h-4 text-[#f8be17]" />
                      Add Member
                    </button>
                  </div>

                  <div v-if="proposalForm.members.length === 0" class="text-sm text-gray-500">
                    No members extracted yet. Upload a proposal or add members manually.
                  </div>

                  <div v-else class="space-y-3">
                    <div
                      v-for="(member, index) in proposalForm.members"
                      :key="index"
                      class="grid grid-cols-1 xl:grid-cols-[1fr_220px_45px] gap-3 items-center"
                    >
                      <input
                        v-model="member.name"
                        @input="updateMemberText"
                        type="text"
                        placeholder="Member name"
                        class="w-full rounded-[16px] border border-[#d8c9bd] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f8be17]"
                      />

                      <input
                        v-model="member.matricNo"
                        @input="updateMemberText"
                        type="text"
                        placeholder="Matric No"
                        class="w-full rounded-[16px] border border-[#d8c9bd] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f8be17]"
                      />

                      <button
                        @click="removeMember(index)"
                        class="w-11 h-11 rounded-[14px] bg-red-50 text-red-700 hover:bg-red-100 flex items-center justify-center"
                      >
                        <Trash2 class="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  <div>
                    <label class="block text-sm font-bold text-gray-700 mb-2">Project Type</label>
                    <select
                      v-model="proposalForm.projectType"
                      class="w-full rounded-[16px] border border-[#d8c9bd] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f8be17]"
                    >
                      <option>Development</option>
                      <option>Research</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-sm font-bold text-gray-700 mb-2">Keywords</label>
                    <input
                      v-model="proposalForm.keywords"
                      type="text"
                      placeholder="AI, IoT, Web, Database"
                      class="w-full rounded-[16px] border border-[#d8c9bd] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f8be17]"
                    />
                  </div>
                </div>

                <div class="mt-5">
                  <label class="block text-sm font-bold text-gray-700 mb-2">Project Title</label>
                  <input
                    v-model="proposalForm.projectTitle"
                    type="text"
                    placeholder="Enter FYP project title"
                    class="w-full rounded-[16px] border border-[#d8c9bd] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f8be17]"
                  />
                </div>

                <div class="mt-5">
                  <label class="block text-sm font-bold text-gray-700 mb-2">Abstract / Problem Statement</label>
                  <textarea
                    v-model="proposalForm.abstract"
                    rows="7"
                    placeholder="Paste or type the proposal abstract here..."
                    class="w-full rounded-[16px] border border-[#d8c9bd] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f8be17] resize-none"
                  ></textarea>
                </div>

                <div class="mt-6 flex flex-col sm:flex-row gap-3 justify-end">
                  <button
                    class="bg-[#e7ded3] text-[#5c001f] px-6 py-3 rounded-full font-bold hover:bg-[#d8c9bd] transition-colors border-none flex items-center justify-center gap-2"
                  >
                    Save Draft
                  </button>

                  <button
                    @click="runAIMatch"
                    :disabled="isMatching || isExtracting"
                    class="bg-[#5c001f] text-white px-6 py-3 rounded-full font-bold hover:bg-[#4a0019] transition-colors border-none flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Loader2 v-if="isMatching" class="w-5 h-5 text-[#f8be17] animate-spin" />
                    <BrainCircuit v-else class="w-5 h-5 text-[#f8be17]" />
                    {{ isMatching ? 'Running AI Matching...' : 'Run AI Supervisor Matching' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Matching Tab -->
          <div v-if="activeTab === 'matching'" class="p-7">
            <div class="grid grid-cols-1 2xl:grid-cols-3 gap-7">
              <div class="2xl:col-span-1">
                <div class="rounded-[26px] bg-[#5c001f] text-white p-7 shadow-lg">
                  <div class="w-16 h-16 rounded-2xl bg-[#f8be17] flex items-center justify-center">
                    <BrainCircuit class="w-9 h-9 text-[#5c001f]" />
                  </div>

                  <h2 class="text-[28px] font-bold mt-5">AI Matching Summary</h2>
                  <p class="text-white/75 mt-3 text-sm leading-relaxed">
                    The system ranks supervisors by comparing project title, problem statement,
                    keywords, and lecturer expertise.
                  </p>

                  <div class="mt-6 space-y-4">
                    <div class="bg-white/10 rounded-[18px] p-4 border border-white/10">
                      <p class="text-xs text-[#f8be17] font-bold uppercase">Project Title</p>
                      <p class="font-semibold mt-1">
                        {{ proposalForm.projectTitle || 'No project title yet' }}
                      </p>
                    </div>

                    <div class="bg-white/10 rounded-[18px] p-4 border border-white/10">
                      <p class="text-xs text-[#f8be17] font-bold uppercase">Project Members</p>
                      <p class="font-semibold mt-1">
                        {{ proposalForm.members.length }} member(s)
                      </p>
                    </div>

                    <div class="bg-white/10 rounded-[18px] p-4 border border-white/10">
                      <p class="text-xs text-[#f8be17] font-bold uppercase">Matching Source</p>
                      <p class="font-semibold mt-1">
                        {{
                          matchSource === 'groq'
                            ? 'Groq AI'
                            : matchSource === 'fallback'
                              ? 'Fallback Similarity'
                              : 'Demo'
                        }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="2xl:col-span-2">
                <div class="flex items-center justify-between mb-5">
                  <div>
                    <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
                      Recommendation
                    </p>
                    <h2 class="text-[28px] font-bold">Suggested Supervisors</h2>
                  </div>

                  <button
                    @click="activeTab = 'upload'"
                    class="bg-[#e7ded3] text-[#5c001f] px-5 py-2.5 rounded-full font-bold hover:bg-[#d8c9bd] transition-colors"
                  >
                    Edit Proposal
                  </button>
                </div>

                <div v-if="isMatching" class="rounded-[24px] border border-[#e1d5cc] p-8 text-center">
                  <Loader2 class="w-10 h-10 animate-spin text-[#5c001f] mx-auto" />
                  <h3 class="font-bold text-xl mt-4">Running AI Supervisor Matching...</h3>
                  <p class="text-gray-600 mt-2">
                    Please wait while the system analyzes the project and lecturer expertise.
                  </p>
                </div>

                <div v-else-if="matchError" class="rounded-[24px] bg-red-50 border border-red-200 p-6">
                  <div class="flex gap-3">
                    <AlertTriangle class="w-6 h-6 text-red-600 shrink-0" />
                    <div>
                      <h3 class="font-bold text-red-700">AI Matching Failed</h3>
                      <p class="text-sm text-red-600 mt-1">{{ matchError }}</p>
                    </div>
                  </div>
                </div>

                <div v-else class="space-y-5">
                  <div
                    v-for="supervisor in recommendedSupervisors"
                    :key="supervisor.rank"
                    class="rounded-[24px] border border-[#e1d5cc] p-6 hover:shadow-lg transition-shadow"
                  >
                    <div class="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
                      <div class="flex gap-4">
                        <div
                          class="w-14 h-14 rounded-2xl bg-[#5c001f] text-[#f8be17] flex items-center justify-center text-xl font-bold"
                        >
                          {{ supervisor.rank }}
                        </div>

                        <div>
                          <div class="flex items-center gap-3 flex-wrap">
                            <h3 class="text-xl font-bold">{{ supervisor.name }}</h3>
                            <span
                              class="px-3 py-1 rounded-full bg-[#fff3c4] text-[#5c001f] text-xs font-bold"
                            >
                              {{ supervisor.status }}
                            </span>
                          </div>

                          <p class="text-sm text-gray-600 mt-1">
                            {{ supervisor.expertise }}
                          </p>

                          <p class="text-sm text-gray-700 mt-3 leading-relaxed">
                            {{ supervisor.reason }}
                          </p>
                        </div>
                      </div>

                      <div class="xl:text-right shrink-0">
                        <div class="text-[34px] font-bold text-[#5c001f]">
                          {{ supervisor.score }}%
                        </div>
                        <p class="text-xs text-gray-500 font-bold uppercase">Match Score</p>

                        <div class="mt-4 flex flex-col gap-2">
                          <button
                            @click="viewSupervisorProfile(supervisor)"
                            class="bg-[#fff3c4] text-[#5c001f] px-5 py-2.5 rounded-full font-bold hover:bg-[#f8be17] transition-colors border-none flex items-center justify-center gap-2"
                          >
                            <Eye class="w-4 h-4" />
                            View Profile
                          </button>

                          <button
                            @click="assignSupervisor(supervisor.name)"
                            class="bg-[#5c001f] text-white px-5 py-2.5 rounded-full font-bold hover:bg-[#4a0019] transition-colors border-none"
                          >
                            Assign
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="mt-6 rounded-[20px] bg-[#fff3c4] border border-[#f8be17] p-5">
                  <div class="flex gap-3">
                    <AlertTriangle class="w-6 h-6 text-[#5c001f] shrink-0" />
                    <p class="text-sm text-[#5c001f]">
                      Supervisor matching is performed at project level, so it supports both
                      individual and group FYP proposals.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Lecturer Profile Tab -->
          <div v-if="activeTab === 'profile'" class="p-7">
            <div class="grid grid-cols-1 2xl:grid-cols-3 gap-7">
              <div class="2xl:col-span-2 rounded-[26px] border border-[#e1d5cc] p-7 bg-white">
                <div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
                  <div class="flex gap-5">
                    <div
                      class="w-20 h-20 rounded-[24px] bg-[#5c001f] text-[#f8be17] flex items-center justify-center text-2xl font-bold shadow-md"
                    >
                      {{ selectedSupervisor.name.charAt(0) }}
                    </div>

                    <div>
                      <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
                        Lecturer Profile
                      </p>
                      <h2 class="text-[30px] font-bold mt-1">{{ selectedSupervisor.name }}</h2>
                      <p class="text-gray-600 mt-1">
                        {{ selectedSupervisor.title }} · {{ selectedSupervisor.faculty }}
                      </p>

                      <div class="mt-4 flex flex-wrap gap-2">
                        <span
                          class="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center gap-1"
                        >
                          <BadgeCheck class="w-4 h-4" />
                          {{ selectedSupervisor.workload }}
                        </span>

                        <span
                          class="px-3 py-1 rounded-full bg-[#fff3c4] text-[#5c001f] text-xs font-bold"
                        >
                          {{ selectedSupervisor.score }}% Expertise Match
                        </span>

                        <span
                          class="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold"
                        >
                          Supervisor Candidate
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    @click="assignSupervisor(selectedSupervisor.name)"
                    class="bg-[#5c001f] text-white px-6 py-3 rounded-full font-bold hover:bg-[#4a0019] transition-colors border-none flex items-center gap-2"
                  >
                    <UserCheck class="w-5 h-5 text-[#f8be17]" />
                    Assign Supervisor
                  </button>
                </div>

                <div class="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-5">
                  <div class="rounded-[20px] bg-[#f7f1ea] border border-[#e1d5cc] p-5">
                    <Mail class="w-6 h-6 text-[#5c001f]" />
                    <p class="text-xs font-bold text-gray-500 uppercase mt-3">Email</p>
                    <p class="font-bold mt-1">{{ selectedSupervisor.email }}</p>
                  </div>

                  <div class="rounded-[20px] bg-[#f7f1ea] border border-[#e1d5cc] p-5">
                    <Phone class="w-6 h-6 text-[#5c001f]" />
                    <p class="text-xs font-bold text-gray-500 uppercase mt-3">Phone</p>
                    <p class="font-bold mt-1">{{ selectedSupervisor.phone }}</p>
                  </div>

                  <div class="rounded-[20px] bg-[#f7f1ea] border border-[#e1d5cc] p-5">
                    <Building2 class="w-6 h-6 text-[#5c001f]" />
                    <p class="text-xs font-bold text-gray-500 uppercase mt-3">Department</p>
                    <p class="font-bold mt-1">{{ selectedSupervisor.department }}</p>
                  </div>
                </div>

                <div class="mt-8">
                  <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
                    Area of Expertise
                  </p>

                  <div class="mt-4 flex flex-wrap gap-3">
                    <span
                      v-for="skill in selectedSupervisor.expertise.split(',')"
                      :key="skill"
                      class="px-4 py-2 rounded-full bg-[#fff3c4] text-[#5c001f] text-sm font-bold border border-[#f8be17]"
                    >
                      {{ skill.trim() }}
                    </span>
                  </div>
                </div>

                <div class="mt-8">
                  <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
                    AI Matching Explanation
                  </p>

                  <div class="mt-4 rounded-[22px] bg-[#f7f1ea] border border-[#e1d5cc] p-5">
                    <p class="text-gray-700 leading-relaxed">
                      {{ selectedSupervisor.reason }}
                    </p>
                  </div>
                </div>

                <div class="mt-8">
                  <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
                    Recent Supervised Projects
                  </p>

                  <div class="mt-4 space-y-3">
                    <div
                      v-for="project in selectedSupervisor.recentProjects"
                      :key="project"
                      class="rounded-[18px] border border-[#e1d5cc] bg-white p-4 flex items-center gap-3"
                    >
                      <BookOpen class="w-5 h-5 text-[#5c001f] shrink-0" />
                      <p class="text-sm font-semibold text-gray-700">{{ project }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="rounded-[26px] bg-[#5c001f] text-white p-7 shadow-lg">
                <div class="w-16 h-16 rounded-2xl bg-[#f8be17] flex items-center justify-center">
                  <BookOpen class="w-8 h-8 text-[#5c001f]" />
                </div>

                <h2 class="text-[26px] font-bold mt-5">Profile Summary</h2>
                <p class="text-white/75 mt-3 text-sm leading-relaxed">
                  This page allows the coordinator to inspect the recommended lecturer before
                  confirming assignment.
                </p>

                <div class="mt-6 space-y-4">
                  <div class="bg-white/10 rounded-[18px] p-4 border border-white/10">
                    <p class="text-xs text-[#f8be17] font-bold uppercase">Recommendation Rank</p>
                    <p class="font-semibold mt-1">Rank {{ selectedSupervisor.rank }}</p>
                  </div>

                  <div class="bg-white/10 rounded-[18px] p-4 border border-white/10">
                    <p class="text-xs text-[#f8be17] font-bold uppercase">Similarity Score</p>
                    <p class="font-semibold mt-1">{{ selectedSupervisor.score }}%</p>
                  </div>

                  <div class="bg-white/10 rounded-[18px] p-4 border border-white/10">
                    <p class="text-xs text-[#f8be17] font-bold uppercase">Workload Status</p>
                    <p class="font-semibold mt-1">{{ selectedSupervisor.workload }}</p>
                  </div>
                </div>

                <button
                  @click="activeTab = 'matching'"
                  class="mt-6 w-full bg-white/10 text-white px-6 py-3 rounded-full font-bold hover:bg-white/20 transition-colors border border-white/20 flex items-center justify-center gap-2"
                >
                  Back to Recommendations
                </button>
              </div>
            </div>
          </div>

          <!-- Records Tab -->
          <div v-if="activeTab === 'records'" class="p-7">
            <div class="flex items-center justify-between gap-4 mb-6">
              <div>
                <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
                  Project Database
                </p>
                <h2 class="text-[28px] font-bold">FYP Project Records</h2>
              </div>

              <div class="relative">
                <Search class="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search project..."
                  class="rounded-full border border-[#d8c9bd] pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f8be17]"
                />
              </div>
            </div>

            <div class="overflow-hidden rounded-[20px] border border-gray-200">
              <table class="w-full text-left">
                <thead class="bg-[#5c001f] text-white">
                  <tr>
                    <th class="px-5 py-4 text-sm font-bold">Members</th>
                    <th class="px-5 py-4 text-sm font-bold">Project Title</th>
                    <th class="px-5 py-4 text-sm font-bold">Supervisor</th>
                    <th class="px-5 py-4 text-sm font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="project in sampleProjects"
                    :key="project.title"
                    class="border-b border-gray-100 bg-white hover:bg-[#fff8df] transition-colors"
                  >
                    <td class="px-5 py-4 font-semibold">{{ project.members }}</td>
                    <td class="px-5 py-4 text-gray-700">{{ project.title }}</td>
                    <td class="px-5 py-4 text-gray-700">{{ project.supervisor }}</td>
                    <td class="px-5 py-4">
                      <span
                        :class="[
                          'px-3 py-1 rounded-full text-xs font-bold',
                          project.status === 'Assigned'
                            ? 'bg-green-100 text-green-700'
                            : project.status === 'In Review'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-[#fff3c4] text-[#5c001f]',
                        ]"
                      >
                        {{ project.status }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>

    <AppFooter class="mt-auto -mb-[30px]" />
  </div>
</template>
