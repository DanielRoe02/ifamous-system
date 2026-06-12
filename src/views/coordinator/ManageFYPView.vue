<script setup>
import { ref, onMounted } from 'vue'
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
  X,
  Check,
} from 'lucide-vue-next'

const router = useRouter()

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const activeTab = ref('queue')

const isExtracting = ref(false)
const isMatching = ref(false)
const isAssigning = ref(false)
const isLoadingRecords = ref(false)

const extractError = ref('')
const extractSuccess = ref('')
const matchError = ref('')
const assignError = ref('')
const recordsError = ref('')

const extractionSource = ref('none')
const matchSource = ref('demo')
const selectedFileName = ref('')

const showAssignModal = ref(false)
const pendingSupervisor = ref(null)
const lastAssignment = ref(null)

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

const recommendedSupervisors = ref([
  {
    rank: 1,
    user_id: 4017,
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
    user_id: 4019,
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
    user_id: 4020,
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
const projectRecords = ref([])

const setActiveTab = async (tabName) => {
  activeTab.value = tabName

  if (tabName === 'records') {
    await loadProjectRecords()
  }
}

const updateMemberText = () => {
  proposalForm.value.memberText = proposalForm.value.members
    .filter((member) => member.name || member.matricNo)
    .map(
      (member, index) =>
        `${index + 1}. ${member.name || 'Unnamed'} (${member.matricNo || 'No matric'})`,
    )
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
      projectTitle: extracted.projectTitle || '',
      projectType: extracted.projectType || 'Development',
      abstract: extracted.abstract || '',
      keywords: extracted.keywords || '',
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

const openAssignConfirmation = (supervisor) => {
  pendingSupervisor.value = supervisor
  assignError.value = ''
  showAssignModal.value = true
}

const closeAssignConfirmation = () => {
  if (isAssigning.value) return
  showAssignModal.value = false
  pendingSupervisor.value = null
}

const confirmAssignment = async () => {
  if (!pendingSupervisor.value) return

  assignError.value = ''

  try {
    isAssigning.value = true

    const response = await fetch(`${API_BASE_URL}/api/supervisor-matching/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project: proposalForm.value,
        supervisor: pendingSupervisor.value,
      }),
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to assign supervisor.')
    }

    lastAssignment.value = data.assignment
    showAssignModal.value = false
    pendingSupervisor.value = null
    activeTab.value = 'success'

    await loadProjectRecords()
  } catch (error) {
    console.error('Assign supervisor error:', error)
    assignError.value = error.message || 'Failed to assign supervisor.'
  } finally {
    isAssigning.value = false
  }
}

const loadProjectRecords = async () => {
  recordsError.value = ''

  try {
    isLoadingRecords.value = true

    const response = await fetch(`${API_BASE_URL}/api/supervisor-matching/projects`)
    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to load project records.')
    }

    projectRecords.value = data.projects || []
  } catch (error) {
    console.error('Load project records error:', error)
    recordsError.value = error.message || 'Failed to load project records.'
  } finally {
    isLoadingRecords.value = false
  }
}

const goToDashboard = () => {
  router.push('/dashboard')
}

onMounted(() => {
  loadProjectRecords()
})
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
                Review student-submitted proposal records, run AI supervisor matching, assign supervisors and examiners, and monitor project status.
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
            <h3 class="text-xl font-bold text-black mt-1">Proposal Queue</h3>
            <p class="text-sm text-gray-500 mt-2">
              Review proposal files submitted by students.
            </p>
          </div>

          <div class="bg-white rounded-[26px] p-6 shadow-lg border border-black/10">
            <div class="w-14 h-14 rounded-2xl bg-[#5c001f] p-3 flex items-center justify-center">
              <BrainCircuit class="w-7 h-7 text-[#f8be17]" />
            </div>
            <p class="text-gray-500 font-semibold mt-5">Step 2</p>
            <h3 class="text-xl font-bold text-black mt-1">AI Matching</h3>
            <p class="text-sm text-gray-500 mt-2">
              Compare project content with lecturer expertise.
            </p>
          </div>

          <div class="bg-white rounded-[26px] p-6 shadow-lg border border-black/10">
            <div class="w-14 h-14 rounded-2xl bg-[#5c001f] p-3 flex items-center justify-center">
              <UserCheck class="w-7 h-7 text-[#f8be17]" />
            </div>
            <p class="text-gray-500 font-semibold mt-5">Step 3</p>
            <h3 class="text-xl font-bold text-black mt-1">Assign Supervisor</h3>
            <p class="text-sm text-gray-500 mt-2">
              Coordinator confirms the recommended supervisor and examiner.
            </p>
          </div>

          <div class="bg-white rounded-[26px] p-6 shadow-lg border border-black/10">
            <div class="w-14 h-14 rounded-2xl bg-[#5c001f] p-3 flex items-center justify-center">
              <ClipboardList class="w-7 h-7 text-[#f8be17]" />
            </div>
            <p class="text-gray-500 font-semibold mt-5">Step 4</p>
            <h3 class="text-xl font-bold text-black mt-1">Track Records</h3>
            <p class="text-sm text-gray-500 mt-2">
              Assignment and approval status are monitored from one workspace.
            </p>
          </div>
        </section>

        <!-- Main Panel -->
        <section class="bg-white rounded-[28px] shadow-lg border border-black/10 overflow-hidden">
          <!-- Tabs -->
          <div class="bg-[#f7f1ea] px-7 pt-7 border-b border-[#e1d5cc]">
            <div class="flex flex-wrap gap-3">
              <button
                @click="setActiveTab('queue')"
                :class="[
                  'px-5 py-3 rounded-t-[18px] font-bold flex items-center gap-2 transition-colors',
                  activeTab === 'queue'
                    ? 'bg-[#5c001f] text-white'
                    : 'bg-white text-[#5c001f] hover:bg-[#fff8df]',
                ]"
              >
                <UploadCloud class="w-5 h-5" />
                Submitted Proposal Queue
              </button>

              <button
                @click="setActiveTab('matching')"
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
                @click="setActiveTab('profile')"
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
                @click="setActiveTab('records')"
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

          <!-- Submitted Proposal Queue Tab -->
          <div v-if="activeTab === 'queue'" class="p-7">
            <div class="flex items-center justify-between gap-4 mb-6">
              <div>
                <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
                  Coordinator Review
                </p>
                <h2 class="text-[28px] font-bold">Submitted Proposal Queue</h2>
                <p class="text-gray-600 mt-2 max-w-3xl">
                  Proposals are uploaded by students from the Student Document Submission Center.
                  Coordinator reviews each proposal, runs AI matching, and assigns the most suitable supervisor.
                </p>
              </div>

              <button
                @click="fillSampleProposal"
                class="bg-[#fff3c4] text-[#5c001f] px-5 py-2.5 rounded-full font-bold hover:bg-[#f8be17] transition-colors border-none flex items-center gap-2"
              >
                <Sparkles class="w-4 h-4" />
                Load Demo Proposal
              </button>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-7">
              <div class="rounded-[24px] bg-[#f7f1ea] border border-[#e1d5cc] p-6">
                <p class="text-sm text-gray-500 font-bold">Submitted Proposals</p>
                <p class="text-[34px] font-bold text-[#5c001f] mt-1">12</p>
                <p class="text-xs text-gray-500 mt-1">Waiting in coordinator queue</p>
              </div>
              <div class="rounded-[24px] bg-[#f7f1ea] border border-[#e1d5cc] p-6">
                <p class="text-sm text-gray-500 font-bold">Pending AI Matching</p>
                <p class="text-[34px] font-bold text-[#5c001f] mt-1">8</p>
                <p class="text-xs text-gray-500 mt-1">Ready for supervisor recommendation</p>
              </div>
              <div class="rounded-[24px] bg-[#f7f1ea] border border-[#e1d5cc] p-6">
                <p class="text-sm text-gray-500 font-bold">Pending Supervisor Approval</p>
                <p class="text-[34px] font-bold text-[#5c001f] mt-1">3</p>
                <p class="text-xs text-gray-500 mt-1">Assigned but waiting response</p>
              </div>
            </div>

            <div class="overflow-x-auto rounded-[24px] border border-[#e1d5cc]">
              <table class="w-full text-sm bg-white">
                <thead class="bg-[#5c001f] text-white">
                  <tr class="text-left">
                    <th class="px-5 py-4">Student / Members</th>
                    <th class="px-5 py-4">Project Title</th>
                    <th class="px-5 py-4">Proposal Status</th>
                    <th class="px-5 py-4">AI Status</th>
                    <th class="px-5 py-4">Supervisor</th>
                    <th class="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-b border-[#eee3db] hover:bg-[#fffaf0]">
                    <td class="px-5 py-4 font-bold">Ahmad Daniel<br /><span class="text-xs text-gray-500 font-medium">A24MJ5074</span></td>
                    <td class="px-5 py-4">Smart Academic Advisor Audit System</td>
                    <td class="px-5 py-4"><span class="px-3 py-1 rounded-full bg-[#fff3c4] text-[#5c001f] font-bold text-xs">Proposal Submitted</span></td>
                    <td class="px-5 py-4"><span class="px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-bold text-xs">Pending AI Matching</span></td>
                    <td class="px-5 py-4">Not Assigned</td>
                    <td class="px-5 py-4 text-right">
                      <button @click="fillSampleProposal(); setActiveTab('matching')" class="bg-[#5c001f] text-white px-4 py-2 rounded-full font-bold hover:bg-[#4a0019]">
                        Review / Run AI
                      </button>
                    </td>
                  </tr>
                  <tr class="border-b border-[#eee3db] hover:bg-[#fffaf0]">
                    <td class="px-5 py-4 font-bold">Nur Syafiqah<br /><span class="text-xs text-gray-500 font-medium">A24MJ5081</span></td>
                    <td class="px-5 py-4">AI-Based Attendance Monitoring System</td>
                    <td class="px-5 py-4"><span class="px-3 py-1 rounded-full bg-[#fff3c4] text-[#5c001f] font-bold text-xs">Proposal Submitted</span></td>
                    <td class="px-5 py-4"><span class="px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-bold text-xs">AI Completed</span></td>
                    <td class="px-5 py-4">Ts. Dr. Wong Mei Ling</td>
                    <td class="px-5 py-4 text-right"><button @click="setActiveTab('records')" class="bg-[#fff3c4] text-[#5c001f] px-4 py-2 rounded-full font-bold">View Status</button></td>
                  </tr>
                  <tr class="hover:bg-[#fffaf0]">
                    <td class="px-5 py-4 font-bold">Lim Wei Sheng<br /><span class="text-xs text-gray-500 font-medium">A24MJ5092</span></td>
                    <td class="px-5 py-4">Mobile Learning Platform</td>
                    <td class="px-5 py-4"><span class="px-3 py-1 rounded-full bg-green-100 text-green-700 font-bold text-xs">Supervisor Approved</span></td>
                    <td class="px-5 py-4"><span class="px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-bold text-xs">AI Completed</span></td>
                    <td class="px-5 py-4">Dr. David Kumar</td>
                    <td class="px-5 py-4 text-right"><button @click="setActiveTab('records')" class="bg-[#fff3c4] text-[#5c001f] px-4 py-2 rounded-full font-bold">View Record</button></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-6 rounded-[20px] bg-[#fff3c4] border border-[#f8be17] p-5 text-[#5c001f]">
              <p class="font-bold">Updated workflow reminder</p>
              <p class="text-sm mt-1">
                Student uploads proposal first. Coordinator only reviews submitted proposals, runs AI supervisor matching, assigns supervisor/examiner, and tracks status.
              </p>
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
                          matchSource === 'ollama'
                            ? 'Ollama Cloud'
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
                    @click="setActiveTab('queue')"
                    class="bg-[#e7ded3] text-[#5c001f] px-5 py-2.5 rounded-full font-bold hover:bg-[#d8c9bd] transition-colors"
                  >
                    Back to Proposal Queue
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
                            @click="openAssignConfirmation(supervisor)"
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
                    @click="openAssignConfirmation(selectedSupervisor)"
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
                  @click="setActiveTab('matching')"
                  class="mt-6 w-full bg-white/10 text-white px-6 py-3 rounded-full font-bold hover:bg-white/20 transition-colors border border-white/20 flex items-center justify-center gap-2"
                >
                  Back to Recommendations
                </button>
              </div>
            </div>
          </div>

          <!-- Assignment Success Screen -->
          <div v-if="activeTab === 'success'" class="p-7">
            <div
              class="rounded-[28px] bg-white border border-[#e1d5cc] p-10 min-h-[420px] flex items-center justify-center text-center"
            >
              <div class="max-w-2xl">
                <div
                  class="w-24 h-24 rounded-full bg-green-100 mx-auto flex items-center justify-center border border-green-200"
                >
                  <Check class="w-12 h-12 text-green-700" />
                </div>

                <h2 class="text-[32px] font-bold mt-6 text-[#5c001f]">
                  Supervisor Assigned Successfully!
                </h2>

                <p class="text-gray-600 mt-3 leading-relaxed">
                  The assignment has been saved into Aiven MySQL. Notification records have also
                  been created for the supervisor and project members.
                </p>

                <div v-if="lastAssignment" class="mt-7 rounded-[24px] bg-[#f7f1ea] border border-[#e1d5cc] p-6 text-left">
                  <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
                    Assignment Summary
                  </p>

                  <div class="mt-4 space-y-3 text-sm">
                    <p>
                      <span class="font-bold">Project:</span>
                      {{ lastAssignment.projectTitle }}
                    </p>
                    <p>
                      <span class="font-bold">Supervisor:</span>
                      {{ lastAssignment.supervisorName }}
                    </p>
                    <p>
                      <span class="font-bold">Match Score:</span>
                      {{ lastAssignment.matchScore }}%
                    </p>
                    <p>
                      <span class="font-bold">Status:</span>
                      {{ lastAssignment.status }}
                    </p>
                    <p>
                      <span class="font-bold">Members:</span>
                      {{ lastAssignment.members?.length || 0 }}
                    </p>
                  </div>
                </div>

                <div class="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    @click="setActiveTab('records')"
                    class="bg-[#5c001f] text-white px-7 py-3 rounded-full font-bold hover:bg-[#4a0019] transition-colors border-none"
                  >
                    View Updated Project List
                  </button>

                  <button
                    @click="setActiveTab('queue')"
                    class="bg-[#e7ded3] text-[#5c001f] px-7 py-3 rounded-full font-bold hover:bg-[#d8c9bd] transition-colors border-none"
                  >
                    Back to Proposal Queue
                  </button>
                </div>
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

              <div class="flex gap-3 items-center">
                <button
                  @click="loadProjectRecords"
                  class="bg-[#5c001f] text-white px-5 py-3 rounded-full font-bold hover:bg-[#4a0019] transition-colors border-none"
                >
                  Refresh
                </button>

                <div class="relative">
                  <Search class="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search project..."
                    class="rounded-full border border-[#d8c9bd] pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f8be17]"
                  />
                </div>
              </div>
            </div>

            <div v-if="isLoadingRecords" class="rounded-[24px] border border-[#e1d5cc] p-8 text-center">
              <Loader2 class="w-10 h-10 animate-spin text-[#5c001f] mx-auto" />
              <p class="font-bold mt-4">Loading project records...</p>
            </div>

            <div v-else-if="recordsError" class="rounded-[24px] bg-red-50 border border-red-200 p-6">
              <div class="flex gap-3">
                <AlertTriangle class="w-6 h-6 text-red-600 shrink-0" />
                <div>
                  <h3 class="font-bold text-red-700">Failed to Load Records</h3>
                  <p class="text-sm text-red-600 mt-1">{{ recordsError }}</p>
                </div>
              </div>
            </div>

            <div v-else-if="projectRecords.length === 0" class="rounded-[24px] border border-[#e1d5cc] p-8 text-center">
              <ClipboardList class="w-12 h-12 text-[#5c001f] mx-auto" />
              <h3 class="font-bold text-xl mt-4">No Assigned Projects Yet</h3>
              <p class="text-gray-600 mt-2">
                Assigned projects will appear here after the coordinator confirms a supervisor.
              </p>
            </div>

            <div v-else class="overflow-hidden rounded-[20px] border border-gray-200">
              <table class="w-full text-left">
                <thead class="bg-[#5c001f] text-white">
                  <tr>
                    <th class="px-5 py-4 text-sm font-bold">No.</th>
                    <th class="px-5 py-4 text-sm font-bold">Members</th>
                    <th class="px-5 py-4 text-sm font-bold">Project Title</th>
                    <th class="px-5 py-4 text-sm font-bold">Supervisor</th>
                    <th class="px-5 py-4 text-sm font-bold">Score</th>
                    <th class="px-5 py-4 text-sm font-bold">Status</th>
                  </tr>
                </thead>

                <tbody>
                  <tr
                    v-for="project in projectRecords"
                    :key="project.project_id"
                    class="border-b border-gray-100 bg-white hover:bg-[#fff8df] transition-colors"
                  >
                    <td class="px-5 py-4 font-semibold">
                      {{ project.project_id }}
                    </td>

                    <td class="px-5 py-4">
                      <p class="font-bold">{{ project.memberCount }} member(s)</p>
                      <p
                        v-for="member in project.members.slice(0, 2)"
                        :key="member.member_id"
                        class="text-xs text-gray-500 mt-1"
                      >
                        {{ member.name }} ({{ member.matricNo }})
                      </p>
                      <p v-if="project.members.length > 2" class="text-xs text-gray-500 mt-1">
                        +{{ project.members.length - 2 }} more
                      </p>
                    </td>

                    <td class="px-5 py-4 text-gray-700 max-w-[360px]">
                      {{ project.projectTitle }}
                    </td>

                    <td class="px-5 py-4 text-gray-700">
                      <p class="font-bold">{{ project.supervisor.name }}</p>
                      <p class="text-xs text-gray-500">{{ project.supervisor.email }}</p>
                    </td>

                    <td class="px-5 py-4">
                      <span class="font-bold text-[#5c001f]">{{ project.matchScore }}%</span>
                    </td>

                    <td class="px-5 py-4">
                      <span
                        class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700"
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

    <!-- Assign Confirmation Modal -->
    <div
      v-if="showAssignModal"
      class="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-6"
    >
      <div class="bg-white rounded-[28px] shadow-2xl max-w-3xl w-full border border-[#e1d5cc] overflow-hidden">
        <div class="bg-[#5c001f] text-white p-6 flex items-center justify-between">
          <div>
            <p class="text-[#f8be17] font-bold text-sm uppercase tracking-[0.18em]">
              Assign Supervisor
            </p>
            <h2 class="text-[28px] font-bold mt-1">Confirm Assignment</h2>
          </div>

          <button
            @click="closeAssignConfirmation"
            class="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          >
            <X class="w-6 h-6" />
          </button>
        </div>

        <div class="p-7 grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div class="rounded-[22px] bg-[#f7f1ea] border border-[#e1d5cc] p-5">
            <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
              Student & Project
            </p>

            <div class="mt-4 space-y-3 text-sm">
              <p>
                <span class="font-bold">Project Title:</span>
                {{ proposalForm.projectTitle }}
              </p>

              <p>
                <span class="font-bold">Project Type:</span>
                {{ proposalForm.projectType }}
              </p>

              <p>
                <span class="font-bold">Members:</span>
                {{ proposalForm.members.length }} member(s)
              </p>

              <div class="pt-2">
                <p
                  v-for="member in proposalForm.members"
                  :key="member.matricNo"
                  class="text-xs text-gray-600 mt-1"
                >
                  {{ member.name }} ({{ member.matricNo }})
                </p>
              </div>
            </div>
          </div>

          <div class="rounded-[22px] bg-[#fff3c4] border border-[#f8be17] p-5">
            <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
              Selected Supervisor
            </p>

            <div v-if="pendingSupervisor" class="mt-4">
              <h3 class="text-xl font-bold text-[#5c001f]">{{ pendingSupervisor.name }}</h3>
              <p class="text-sm text-gray-700 mt-1">{{ pendingSupervisor.title }}</p>
              <p class="text-sm text-gray-700 mt-3">
                {{ pendingSupervisor.expertise }}
              </p>

              <div class="mt-5 bg-white rounded-[18px] p-4 border border-[#e1d5cc]">
                <p class="text-xs font-bold text-gray-500 uppercase">Expertise Match</p>
                <p class="text-[32px] font-bold text-[#5c001f]">{{ pendingSupervisor.score }}%</p>
              </div>
            </div>
          </div>
        </div>

        <div v-if="assignError" class="mx-7 mb-5 rounded-[18px] bg-red-50 border border-red-200 p-4">
          <div class="flex gap-3">
            <AlertTriangle class="w-5 h-5 text-red-700 shrink-0" />
            <p class="text-sm text-red-700">{{ assignError }}</p>
          </div>
        </div>

        <div class="p-7 pt-0 flex flex-col sm:flex-row gap-3 justify-end">
          <button
            @click="closeAssignConfirmation"
            :disabled="isAssigning"
            class="bg-[#e7ded3] text-[#5c001f] px-6 py-3 rounded-full font-bold hover:bg-[#d8c9bd] transition-colors border-none disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            @click="confirmAssignment"
            :disabled="isAssigning"
            class="bg-[#5c001f] text-white px-6 py-3 rounded-full font-bold hover:bg-[#4a0019] transition-colors border-none flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Loader2 v-if="isAssigning" class="w-5 h-5 text-[#f8be17] animate-spin" />
            <UserCheck v-else class="w-5 h-5 text-[#f8be17]" />
            {{ isAssigning ? 'Assigning...' : 'Confirm Assignment' }}
          </button>
        </div>
      </div>
    </div>

    <AppFooter class="mt-auto -mb-[30px]" />
  </div>
</template>
