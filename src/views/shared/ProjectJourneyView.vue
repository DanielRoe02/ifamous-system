<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  GitBranch,
  Loader2,
  MessageSquareText,
  Plus,
  Route as RouteIcon,
  Sparkles,
  Upload,
} from 'lucide-vue-next'
import AppHeader from '@/components/AppHeader.vue'
import RoleSidebar from '@/components/RoleSidebar.vue'
import EmailActionConfirmModal from '@/components/EmailActionConfirmModal.vue'
import { api, feedbackFileUrl, fileUrl, roleFlags } from '@/services/ifamousApi'
import { formatMalaysiaDate, formatMalaysiaDateTime } from '@/utils/dateTime'

const route = useRoute()
const router = useRouter()
const roles = roleFlags()
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const journeyUnavailable = ref(false)
const data = ref(null)
const selectedFile = ref(null)
const attachment = ref(null)
const supervisorCandidates = ref([])
const emailConfirmation = ref(null)

const projectId = ref(Number(route.query.projectId || 0))
const project = computed(() => data.value?.project || {})
const isStudent = computed(() => project.value.accessRole === 'student')
const canEditLinks = computed(() => isStudent.value)
const canReview = computed(() => ['supervisor', 'coordinator'].includes(project.value.accessRole))
const canFillDemo = computed(() => isStudent.value && ['Active', 'Development in Progress', 'Revision Required', 'Final Correction Required', 'Final Deliverables Submitted'].includes(String(project.value.status || '')))
const canGiveFeedback = computed(() => ['supervisor', 'examiner', 'coordinator'].includes(project.value.accessRole))

const links = reactive({ githubUrl: '', googleDriveUrl: '' })
const uploadForm = reactive({ title: '', submissionType: 'progress_report' })
const milestoneForm = reactive({ title: '', description: '', dueDate: '' })
const progressForm = reactive({ progressPercent: 0, workCompleted: '', nextWork: '', blockers: '', evidenceUrl: '' })
const logbookForm = reactive({ meetingDate: '', meetingType: 'Physical', topics: '', progress: '', problems: '', advice: '', nextMeetingDate: '' })
const feedbackForm = reactive({ submissionId: '', comment: '' })
const actionForm = reactive({ task: '', dueDate: '', assignedToUserId: '' })
const nominationForm = reactive({ supervisorUserId: '', preferenceRank: 1, note: '' })

const statusBadge = (status) => {
  const value = String(status || '').toLowerCase()
  if (value.includes('complete') || value.includes('approved') || value.includes('released')) return 'bg-green-100 text-green-800'
  if (value.includes('risk') || value.includes('reject') || value.includes('overdue')) return 'bg-red-100 text-red-800'
  if (value.includes('revision') || value.includes('attention') || value.includes('pending')) return 'bg-amber-100 text-amber-800'
  return 'bg-blue-100 text-blue-800'
}

async function resolveProjectId() {
  if (projectId.value) return
  if (roles.isStudent) {
    const response = await api.get('/student/my-fyp')
    projectId.value = Number(response.data.records?.[0]?.project_id || 0)
  }
}

async function loadJourney() {
  loading.value = true
  error.value = ''
  journeyUnavailable.value = false
  try {
    await resolveProjectId()
    if (!projectId.value) throw new Error('No FYP project is available for this account.')
    const [response, readinessResponse] = await Promise.all([
      api.get(`/projects/${projectId.value}/journey`),
      api.get(`/projects/${projectId.value}/readiness`),
    ])
    data.value = { ...response.data, readiness: readinessResponse.data }
    links.githubUrl = project.value.github_url || ''
    links.googleDriveUrl = project.value.google_drive_url || ''
    progressForm.progressPercent = Number(project.value.progress_percent || 0)
    if (project.value.accessRole === 'student' && !project.value.supervisor_user_id) {
      supervisorCandidates.value = (await api.get(`/projects/${projectId.value}/supervisor-candidates`)).data.candidates || []
    }
  } catch (err) {
    journeyUnavailable.value = err.response?.data?.code === 'JOURNEY_NOT_AVAILABLE'
    error.value = err.response?.data?.error || err.message
  } finally {
    loading.value = false
  }
}

async function run(action) {
  saving.value = true
  error.value = ''
  try {
    await action()
    await loadJourney()
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  } finally {
    saving.value = false
  }
}

const saveLinks = () => run(() => api.patch(`/projects/${projectId.value}/links`, links))

const uploadSubmission = () => run(async () => {
  if (!selectedFile.value) throw new Error('Choose a file first.')
  const form = new FormData()
  form.append('file', selectedFile.value)
  form.append('title', uploadForm.title || selectedFile.value.name)
  form.append('submissionType', uploadForm.submissionType)
  await api.post(`/projects/${projectId.value}/submissions`, form)
  selectedFile.value = null
  uploadForm.title = ''
})

const addMilestone = () => run(async () => {
  await api.post(`/projects/${projectId.value}/milestones`, milestoneForm)
  Object.assign(milestoneForm, { title: '', description: '', dueDate: '' })
})

const updateMilestone = (milestoneId, status) => run(() =>
  api.patch(`/projects/${projectId.value}/milestones/${milestoneId}`, { status }),
)

const addProgress = () => run(async () => {
  await api.post(`/projects/${projectId.value}/progress`, progressForm)
  Object.assign(progressForm, { progressPercent: project.value.progress_percent || 0, workCompleted: '', nextWork: '', blockers: '', evidenceUrl: '' })
})

const addLogbook = () => run(async () => {
  await api.post(`/projects/${projectId.value}/logbooks`, logbookForm)
  Object.assign(logbookForm, { meetingDate: '', meetingType: 'Physical', topics: '', progress: '', problems: '', advice: '', nextMeetingDate: '' })
})

const reviewLogbook = (logbookId, status) => run(() =>
  api.patch(`/projects/${projectId.value}/logbooks/${logbookId}/review`, { status }),
)

const addFeedback = (sendEmail = true) => run(async () => {
  const form = new FormData()
  form.append('comment', feedbackForm.comment)
  if (feedbackForm.submissionId) form.append('submissionId', feedbackForm.submissionId)
  if (attachment.value) form.append('attachment', attachment.value)
  form.append('sendEmail', String(sendEmail))
  await api.post(`/projects/${projectId.value}/feedback`, form)
  feedbackForm.comment = ''
  feedbackForm.submissionId = ''
  attachment.value = null
})

const addActionItem = () => run(async () => {
  await api.post(`/projects/${projectId.value}/action-items`, {
    ...actionForm,
    assignedToUserId: actionForm.assignedToUserId || project.value.student_user_id,
  })
  Object.assign(actionForm, { task: '', dueDate: '', assignedToUserId: '' })
})

const nominateSupervisor = () => run(async () => {
  await api.post(`/projects/${projectId.value}/supervisor-nomination`, nominationForm)
  Object.assign(nominationForm, { supervisorUserId: '', preferenceRank: 1, note: '' })
})

const updateActionItem = (actionItemId, status) => run(() =>
  api.patch(`/projects/${projectId.value}/action-items/${actionItemId}`, { status }),
)

const finalDecision = (decision, sendEmail = true) => run(() =>
  api.post(`/projects/${projectId.value}/final-decision`, {
    decision,
    feedback: feedbackForm.comment,
    sendEmail,
  }),
)

const fillDemoJourney = () => run(async () => {
  const response = await api.post(`/projects/${projectId.value}/demo-journey`)
  window.alert(response.data.message || 'Demo journey data created.')
})

function requestFeedbackSubmission() {
  if (!feedbackForm.comment?.trim() && !attachment.value) {
    error.value = 'Write a feedback comment or choose an attachment first.'
    return
  }
  emailConfirmation.value = {
    kind: 'feedback',
    title: 'Send project feedback?',
    description: 'The related project member will receive this feedback inside I-FAMOUS.',
    recipient: project.value.student_email || project.value.student_name || 'Related project member',
    confirmLabel: 'Send feedback',
  }
}

function requestFinalDecision(decision) {
  const approving = decision === 'approve_for_examination'
  emailConfirmation.value = {
    kind: 'final-decision',
    decision,
    title: approving ? 'Approve for examination?' : 'Request final correction?',
    description: approving
      ? 'The student and coordinator will be notified that the project is ready for examiner assignment.'
      : 'The student will be notified that the final submission requires correction.',
    recipient: approving ? 'Project student and I-FAMOUS coordinator(s)' : (project.value.student_email || project.value.student_name || 'Project student'),
    confirmLabel: approving ? 'Approve for examination' : 'Request correction',
  }
}

async function confirmEmailAction(sendEmail) {
  const pending = emailConfirmation.value
  if (!pending) return
  if (pending.kind === 'feedback') {
    await addFeedback(sendEmail)
  } else if (pending.kind === 'final-decision') {
    await finalDecision(pending.decision, sendEmail)
  }
  emailConfirmation.value = null
}

onMounted(loadJourney)
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3] text-[#241616]">
    <AppHeader />
    <div class="flex">
      <RoleSidebar :role="project.accessRole === 'student' ? 'Student' : project.accessRole === 'coordinator' ? 'Coordinator' : 'Staff'" />
      <main class="flex-1 p-7 lg:p-9 space-y-7 min-w-0">
        <section class="rounded-[30px] bg-[#5c001f] text-white p-8 shadow-xl relative overflow-hidden">
          <div class="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-[#f8be17]/20" />
          <div class="relative">
            <p class="text-[#f8be17] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
              <RouteIcon class="w-5 h-5" /> FYP Development Journey
            </p>
            <h1 class="text-3xl lg:text-4xl font-bold mt-2">{{ project.project_title || 'Project Journey' }}</h1>
            <p class="text-white/75 mt-2">Proposal approval, progress, meetings, evidence, final submission and examination readiness in one place.</p>
          </div>
        </section>

        <div v-if="loading" class="bg-white rounded-[24px] p-10 text-center shadow">
          <Loader2 class="w-9 h-9 mx-auto animate-spin text-[#5c001f]" />
          <p class="font-bold mt-3">Loading the FYP journey…</p>
        </div>

        <div v-else-if="error && !data" class="bg-red-50 border border-red-200 text-red-800 rounded-[24px] p-6">
          <p class="font-bold flex items-center gap-2"><AlertTriangle class="w-5 h-5" /> {{ error }}</p>
          <p v-if="error.includes('migration')" class="mt-2 text-sm">The code update is installed, but the database migration still needs to be applied later.</p>
          <button
            v-if="journeyUnavailable && projectId"
            @click="router.push({ path: roles.isStudent ? '/student-project-details' : '/supervisor-review', query: { projectId } })"
            class="mt-4 rounded-xl bg-[#5c001f] px-5 py-2.5 font-bold text-white"
          >
            Open proposal details
          </button>
        </div>

        <template v-else-if="data">
          <div v-if="error" class="bg-red-50 border border-red-200 text-red-800 rounded-[18px] p-4 font-bold">{{ error }}</div>

          <section class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="bg-white rounded-[22px] p-5 shadow border border-black/5">
              <p class="text-xs font-bold uppercase text-gray-500">Current phase</p>
              <p class="font-bold text-lg mt-2">{{ project.current_phase || project.status }}</p>
            </div>
            <div class="bg-white rounded-[22px] p-5 shadow border border-black/5">
              <p class="text-xs font-bold uppercase text-gray-500">Progress</p>
              <p class="font-bold text-2xl mt-2">{{ Number(project.progress_percent || 0) }}%</p>
              <div class="h-2 bg-gray-200 rounded-full mt-3 overflow-hidden"><div class="h-full bg-[#5c001f]" :style="{ width: `${Math.min(100, Number(project.progress_percent || 0))}%` }" /></div>
            </div>
            <div class="bg-white rounded-[22px] p-5 shadow border border-black/5">
              <p class="text-xs font-bold uppercase text-gray-500">Risk</p>
              <span :class="statusBadge(project.risk_status)" class="inline-flex px-3 py-1 rounded-full font-bold mt-2">{{ project.risk_status || 'On Track' }}</span>
            </div>
            <div class="bg-white rounded-[22px] p-5 shadow border border-black/5">
              <p class="text-xs font-bold uppercase text-gray-500">Status</p>
              <span :class="statusBadge(project.status)" class="inline-flex px-3 py-1 rounded-full font-bold mt-2">{{ project.status }}</span>
            </div>
          </section>

          <section v-if="isStudent" class="bg-white rounded-[26px] p-6 shadow border border-black/5 flex flex-wrap items-center justify-between gap-5">
            <div>
              <h2 class="text-xl font-bold flex items-center gap-2"><Sparkles class="w-5 h-5 text-[#5c001f]" /> Demo workflow helper</h2>
              <p class="text-gray-500 mt-1 max-w-3xl">For local testing only. It creates demo links, progress, milestones, an approved logbook, a progress report and a final deliverable, then sends the test package to your supervisor.</p>
            </div>
            <button
              @click="fillDemoJourney"
              :disabled="saving || !canFillDemo"
              class="rounded-xl bg-[#f8be17] text-[#5c001f] px-5 py-3 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ saving ? 'Filling demo data...' : 'Fill Demo Journey Data' }}
            </button>
            <p v-if="!canFillDemo" class="w-full text-sm text-amber-700 font-bold">The proposal must be approved and a supervisor must be assigned before demo journey data can be created.</p>
          </section>

          <section v-if="project.accessRole === 'student' && !project.supervisor_user_id" class="bg-white rounded-[26px] p-6 shadow border border-black/5">
            <h2 class="text-2xl font-bold">Nominate a preferred supervisor</h2>
            <p class="text-gray-500 mt-1">This is a preference only. The coordinator makes the final assignment using expertise and capacity.</p>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-5">
              <select v-model="nominationForm.supervisorUserId" class="border rounded-xl px-4 py-3"><option value="">Select available supervisor</option><option v-for="candidate in supervisorCandidates" :key="candidate.user_id" :value="candidate.user_id" :disabled="!candidate.available">{{ candidate.full_name }} — {{ candidate.expertise || candidate.research_expertise }} ({{ candidate.current_capacity }}/{{ candidate.sv_capacity }})</option></select>
              <select v-model.number="nominationForm.preferenceRank" class="border rounded-xl px-4 py-3"><option :value="1">First preference</option><option :value="2">Second preference</option><option :value="3">Third preference</option></select>
              <input v-model="nominationForm.note" class="border rounded-xl px-4 py-3" placeholder="Why this supervisor?" />
            </div>
            <button @click="nominateSupervisor" class="mt-4 bg-[#5c001f] text-white rounded-xl px-5 py-2.5 font-bold">Submit nomination</button>
            <div v-if="data.nominations?.length" class="mt-4 space-y-2"><p class="font-bold">Submitted preferences</p><p v-for="item in data.nominations" :key="item.nomination_id" class="text-sm bg-[#f7f1ea] rounded-xl p-3">#{{ item.preference_rank }} {{ item.supervisor_name }} — {{ item.status }}</p></div>
          </section>

          <section v-if="canReview" class="rounded-[20px] bg-blue-50 border border-blue-200 p-4 text-blue-900">
            <p class="font-bold">Supervisor review mode</p>
            <p class="text-sm mt-1">Student data-entry forms are hidden. You can view or download evidence, review milestones and logbooks, send feedback with attachments, grade the project and make the final readiness decision.</p>
          </section>

          <section class="bg-white rounded-[26px] p-6 shadow border border-black/5">
            <h2 class="text-2xl font-bold flex items-center gap-2"><GitBranch class="w-6 h-6 text-[#5c001f]" /> Project links</h2>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
              <label class="space-y-2"><span class="font-bold text-sm">GitHub repository</span><input v-model="links.githubUrl" :disabled="!canEditLinks" class="w-full border rounded-xl px-4 py-3" placeholder="https://github.com/..." /></label>
              <label class="space-y-2"><span class="font-bold text-sm">Google Drive folder</span><input v-model="links.googleDriveUrl" :disabled="!canEditLinks" class="w-full border rounded-xl px-4 py-3" placeholder="https://drive.google.com/..." /></label>
            </div>
            <div class="flex flex-wrap gap-3 mt-4">
              <button v-if="canEditLinks" @click="saveLinks" :disabled="saving" class="bg-[#5c001f] text-white rounded-xl px-5 py-2.5 font-bold">Save links</button>
              <a v-if="links.githubUrl" :href="links.githubUrl" target="_blank" class="border rounded-xl px-4 py-2.5 font-bold inline-flex gap-2"><ExternalLink class="w-4 h-4" /> Open GitHub</a>
              <a v-if="links.googleDriveUrl" :href="links.googleDriveUrl" target="_blank" class="border rounded-xl px-4 py-2.5 font-bold inline-flex gap-2"><ExternalLink class="w-4 h-4" /> Open Drive</a>
            </div>
          </section>

          <section class="bg-white rounded-[26px] p-6 shadow border border-black/5">
            <div class="flex items-center justify-between gap-4 flex-wrap">
              <h2 class="text-2xl font-bold flex items-center gap-2"><FileText class="w-6 h-6 text-[#5c001f]" /> Submission versions</h2>
              <span class="text-sm text-gray-500">Approved examination files are locked and preserved.</span>
            </div>
            <div class="mt-5 space-y-3">
              <div v-for="item in data.submissions" :key="item.submission_id" class="border rounded-[18px] p-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p class="font-bold">{{ item.original_file_name || item.submission_title }}</p>
                  <p class="text-sm text-gray-500">{{ item.submission_type }} · Version {{ item.version_number || 1 }} · {{ item.status }} <span v-if="item.is_locked">· 🔒 Locked</span></p>
                </div>
                <div class="flex gap-2">
                  <a :href="fileUrl(projectId, item.submission_id)" target="_blank" class="border rounded-xl px-3 py-2 font-bold">Preview</a>
                  <a :href="fileUrl(projectId, item.submission_id, true)" class="border rounded-xl px-3 py-2 font-bold inline-flex gap-2"><Download class="w-4 h-4" /> Download</a>
                </div>
              </div>
              <p v-if="!data.submissions.length" class="text-gray-500">No journey submissions yet.</p>
            </div>

            <div v-if="isStudent" class="mt-6 bg-[#f7f1ea] rounded-[18px] p-5">
              <h3 class="font-bold text-lg flex items-center gap-2"><Upload class="w-5 h-5" /> Upload a new version or deliverable</h3>
              <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4">
                <input v-model="uploadForm.title" class="border rounded-xl px-4 py-3" placeholder="Submission title" />
                <select v-model="uploadForm.submissionType" class="border rounded-xl px-4 py-3">
                  <option value="proposal">Proposal / Revised Proposal</option><option value="progress_report">Progress Report</option><option value="presentation">Progress Presentation</option><option value="prototype">Prototype</option><option value="testing_evidence">Testing Evidence</option><option value="final_deliverable">Final Deliverable</option><option value="administrative">Administrative Document</option>
                </select>
                <input type="file" @change="selectedFile = $event.target.files[0]" class="border rounded-xl px-4 py-2.5 bg-white" />
              </div>
              <button @click="uploadSubmission" :disabled="saving" class="mt-4 bg-[#5c001f] text-white rounded-xl px-5 py-2.5 font-bold">Upload submission</button>
            </div>
          </section>

          <section class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div class="bg-white rounded-[26px] p-6 shadow border border-black/5">
              <h2 class="text-2xl font-bold flex items-center gap-2"><CheckCircle2 class="w-6 h-6 text-[#5c001f]" /> Milestones</h2>
              <div class="space-y-3 mt-5">
                <div v-for="item in data.milestones" :key="item.milestone_id" class="border rounded-[16px] p-4">
                  <div class="flex justify-between gap-3"><p class="font-bold">{{ item.title }}</p><span :class="statusBadge(item.status)" class="px-2.5 py-1 rounded-full text-xs font-bold">{{ item.status }}</span></div>
                  <p class="text-sm text-gray-500 mt-1">Due {{ formatMalaysiaDate(item.due_date) }}</p>
                  <p v-if="item.description" class="text-sm mt-2">{{ item.description }}</p>
                  <select @change="updateMilestone(item.milestone_id, $event.target.value)" :value="item.status" class="border rounded-lg px-3 py-2 text-sm mt-3">
                    <option>Not Started</option><option>In Progress</option><option>Submitted</option><option v-if="canReview">Revision Required</option><option v-if="canReview">Completed</option>
                  </select>
                </div>
                <p v-if="!data.milestones.length" class="text-gray-500">No milestones have been created.</p>
              </div>
              <div v-if="isStudent" class="mt-5 bg-[#f7f1ea] rounded-[16px] p-4 space-y-3">
                <input v-model="milestoneForm.title" class="w-full border rounded-xl px-4 py-3" placeholder="Milestone title" />
                <textarea v-model="milestoneForm.description" class="w-full border rounded-xl px-4 py-3" placeholder="Description" />
                <input v-model="milestoneForm.dueDate" type="date" class="w-full border rounded-xl px-4 py-3" />
                <button @click="addMilestone" class="bg-[#5c001f] text-white rounded-xl px-4 py-2.5 font-bold inline-flex gap-2"><Plus class="w-4 h-4" /> Add milestone</button>
              </div>
            </div>

            <div class="bg-white rounded-[26px] p-6 shadow border border-black/5">
              <h2 class="text-2xl font-bold">Progress updates</h2>
              <div class="space-y-3 mt-5 max-h-[420px] overflow-auto">
                <div v-for="item in data.progress" :key="item.progress_id" class="border rounded-[16px] p-4">
                  <div class="flex justify-between"><p class="font-bold">{{ item.progress_percent }}% progress</p><span class="text-xs text-gray-500">{{ formatMalaysiaDateTime(item.created_at, { includeYear: true }) }}</span></div>
                  <p class="text-sm mt-3"><strong>Completed:</strong> {{ item.work_completed }}</p>
                  <p class="text-sm mt-2"><strong>Next:</strong> {{ item.next_work }}</p>
                  <p v-if="item.blockers" class="text-sm mt-2 text-red-700"><strong>Blocker:</strong> {{ item.blockers }}</p>
                  <a v-if="item.evidence_url" :href="item.evidence_url" target="_blank" class="text-[#5c001f] font-bold text-sm mt-2 inline-flex gap-1"><ExternalLink class="w-4 h-4" /> Evidence</a>
                </div>
              </div>
              <div v-if="isStudent" class="mt-5 bg-[#f7f1ea] rounded-[16px] p-4 space-y-3">
                <input v-model.number="progressForm.progressPercent" type="number" min="0" max="100" class="w-full border rounded-xl px-4 py-3" placeholder="Progress %" />
                <textarea v-model="progressForm.workCompleted" class="w-full border rounded-xl px-4 py-3" placeholder="Work completed" />
                <textarea v-model="progressForm.nextWork" class="w-full border rounded-xl px-4 py-3" placeholder="Next work" />
                <textarea v-model="progressForm.blockers" class="w-full border rounded-xl px-4 py-3" placeholder="Problems or blockers" />
                <input v-model="progressForm.evidenceUrl" class="w-full border rounded-xl px-4 py-3" placeholder="GitHub commit / evidence URL" />
                <button @click="addProgress" class="bg-[#5c001f] text-white rounded-xl px-4 py-2.5 font-bold">Submit progress update</button>
              </div>
            </div>
          </section>

          <section class="bg-white rounded-[26px] p-6 shadow border border-black/5">
            <h2 class="text-2xl font-bold flex items-center gap-2"><BookOpenCheck class="w-6 h-6 text-[#5c001f]" /> Digital logbook</h2>
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
              <div class="space-y-3">
                <div v-for="item in data.logbooks" :key="item.logbook_id" class="border rounded-[16px] p-4">
                  <div class="flex justify-between gap-3"><p class="font-bold">{{ formatMalaysiaDateTime(item.meeting_date, { includeYear: true }) }}</p><span :class="statusBadge(item.status)" class="px-2.5 py-1 rounded-full text-xs font-bold">{{ item.status }}</span></div>
                  <p class="text-sm mt-2"><strong>Topics:</strong> {{ item.topics_discussed }}</p>
                  <p v-if="item.progress_summary" class="text-sm mt-2"><strong>Progress:</strong> {{ item.progress_summary }}</p>
                  <p v-if="item.supervisor_comment" class="text-sm mt-2 text-[#5c001f]"><strong>Supervisor:</strong> {{ item.supervisor_comment }}</p>
                  <div v-if="canReview && item.status === 'Pending'" class="flex gap-2 mt-3"><button @click="reviewLogbook(item.logbook_id, 'Approved')" class="bg-green-700 text-white rounded-lg px-3 py-2 text-sm font-bold">Approve</button><button @click="reviewLogbook(item.logbook_id, 'Request Edit')" class="bg-amber-600 text-white rounded-lg px-3 py-2 text-sm font-bold">Request edit</button></div>
                </div>
              </div>
              <div v-if="isStudent" class="bg-[#f7f1ea] rounded-[18px] p-5 space-y-3">
                <input v-model="logbookForm.meetingDate" type="datetime-local" class="w-full border rounded-xl px-4 py-3" />
                <select v-model="logbookForm.meetingType" class="w-full border rounded-xl px-4 py-3"><option>Physical</option><option>Google Meet</option><option>Microsoft Teams</option><option>Other Online</option></select>
                <textarea v-model="logbookForm.topics" class="w-full border rounded-xl px-4 py-3" placeholder="Topics discussed" />
                <textarea v-model="logbookForm.progress" class="w-full border rounded-xl px-4 py-3" placeholder="Progress summary" />
                <textarea v-model="logbookForm.problems" class="w-full border rounded-xl px-4 py-3" placeholder="Problems identified" />
                <textarea v-model="logbookForm.advice" class="w-full border rounded-xl px-4 py-3" placeholder="Supervisor advice / notes" />
                <input v-model="logbookForm.nextMeetingDate" type="datetime-local" class="w-full border rounded-xl px-4 py-3" />
                <button @click="addLogbook" class="bg-[#5c001f] text-white rounded-xl px-4 py-2.5 font-bold">Save logbook entry</button>
              </div>
            </div>
          </section>

          <section class="bg-white rounded-[26px] p-6 shadow border border-black/5">
            <h2 class="text-2xl font-bold">Meeting action items</h2>
            <p class="text-gray-500 mt-1">Track tasks, due dates and unresolved work from supervisor meetings.</p>
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
              <div class="space-y-3">
                <div v-for="item in data.actionItems" :key="item.action_item_id" class="border rounded-[16px] p-4">
                  <div class="flex justify-between gap-3"><p class="font-bold">{{ item.title }}</p><span :class="statusBadge(item.status)" class="px-2.5 py-1 rounded-full text-xs font-bold">{{ item.status }}</span></div>
                  <p class="text-sm text-gray-500 mt-1">Due {{ formatMalaysiaDate(item.due_date) }}</p>
                  <select :value="item.status" @change="updateActionItem(item.action_item_id, $event.target.value)" class="border rounded-lg px-3 py-2 text-sm mt-3"><option>Pending</option><option>In Progress</option><option>Completed</option><option>Overdue</option><option>Cancelled</option></select>
                </div>
                <p v-if="!data.actionItems.length" class="text-gray-500">No meeting action items yet.</p>
              </div>
              <div v-if="isStudent" class="bg-[#f7f1ea] rounded-[18px] p-5 space-y-3">
                <input v-model="actionForm.task" class="w-full border rounded-xl px-4 py-3" placeholder="Action item / task" />
                <input v-model="actionForm.dueDate" type="date" class="w-full border rounded-xl px-4 py-3" />
                <button @click="addActionItem" class="bg-[#5c001f] text-white rounded-xl px-4 py-2.5 font-bold">Add action item</button>
              </div>
            </div>
          </section>

          <section class="bg-white rounded-[26px] p-6 shadow border border-black/5">
            <h2 class="text-2xl font-bold flex items-center gap-2"><MessageSquareText class="w-6 h-6 text-[#5c001f]" /> Feedback and attachments</h2>
            <div class="space-y-3 mt-5">
              <div v-for="item in data.feedback" :key="item.feedback_id" class="border rounded-[16px] p-4">
                <p class="font-bold">{{ item.author_role }} feedback</p><p class="mt-2 whitespace-pre-line">{{ item.comment }}</p>
                <a v-if="item.attachment_path" :href="feedbackFileUrl(projectId, item.feedback_id, true)" class="inline-flex gap-2 mt-3 font-bold text-[#5c001f]"><Download class="w-4 h-4" /> {{ item.attachment_name }}</a>
              </div>
            </div>
            <div v-if="canGiveFeedback" class="mt-5 bg-[#f7f1ea] rounded-[18px] p-5 space-y-3">
              <select v-model="feedbackForm.submissionId" class="w-full border rounded-xl px-4 py-3"><option value="">General project feedback</option><option v-for="item in data.submissions" :key="item.submission_id" :value="item.submission_id">{{ item.original_file_name || item.submission_title }}</option></select>
              <textarea v-model="feedbackForm.comment" class="w-full border rounded-xl px-4 py-3" placeholder="Comment, correction or highlighted issue" />
              <input type="file" @change="attachment = $event.target.files[0]" class="w-full border rounded-xl px-4 py-2 bg-white" />
              <button @click="requestFeedbackSubmission" class="bg-[#5c001f] text-white rounded-xl px-4 py-2.5 font-bold">Send feedback</button>
            </div>
          </section>

          <section class="bg-white rounded-[26px] p-6 shadow border border-black/5">
            <h2 class="text-2xl font-bold">Final submission readiness</h2>
            <p class="text-gray-500 mt-1">The project is ready only when all required journey items are available.</p>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
              <div v-for="(value,key) in data.readiness?.checklist" :key="key" class="border rounded-[14px] p-4 flex items-center gap-3"><CheckCircle2 class="w-5 h-5" :class="Number(value) === 1 ? 'text-green-600' : 'text-gray-300'" /><span class="font-bold capitalize">{{ String(key).replaceAll('_',' ') }}</span></div>
            </div>
            <p class="mt-4 font-bold" :class="data.readiness?.ready ? 'text-green-700' : 'text-amber-700'">{{ data.readiness?.ready ? 'Ready for supervisor final review.' : 'Some required items are still missing.' }}</p>
          </section>

          <section v-if="data.releasedResult" class="bg-white rounded-[26px] p-6 shadow border-2 border-green-300">
            <h2 class="text-2xl font-bold text-green-800">Released result and feedback</h2>
            <p class="text-4xl font-bold mt-4 text-[#5c001f]">{{ data.releasedResult.finalScore ?? '-' }}%</p>
            <p v-if="data.releasedResult.finalGrade" class="font-bold mt-1">Grade: {{ data.releasedResult.finalGrade }}</p>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
              <div v-for="item in data.releasedResult.supervisorAssessments" :key="`s-${item.supervisor_user_id}`" class="bg-[#f7f1ea] rounded-[16px] p-4"><p class="font-bold">Supervisor assessment — {{ item.percentage }}%</p><p class="mt-2 whitespace-pre-line">{{ item.comments || 'No overall comment.' }}</p></div>
              <div v-for="item in data.releasedResult.examinerEvaluations" :key="`e-${item.examiner_user_id}`" class="bg-[#f7f1ea] rounded-[16px] p-4"><p class="font-bold">Examiner assessment — {{ item.percentage }}%</p><p class="mt-2"><strong>Strengths:</strong> {{ item.strengths || '-' }}</p><p class="mt-2"><strong>Improvement:</strong> {{ item.improvements || '-' }}</p><p class="mt-2"><strong>Recommendations:</strong> {{ item.recommendations || '-' }}</p><p class="mt-2"><strong>Overall:</strong> {{ item.overall_comments || '-' }}</p></div>
            </div>
          </section>

          <section v-if="canReview" class="rounded-[26px] bg-[#2f1820] text-white p-6 shadow">
            <h2 class="text-2xl font-bold">Final readiness decision</h2>
            <p class="text-white/70 mt-2">Use this only after the final deliverables have been submitted. Approval locks the latest final version and sends the project to the coordinator examiner queue.</p>
            <div class="flex flex-wrap gap-3 mt-5"><button @click="router.push({ path: '/supervisor-assessment', query: { projectId } })" class="bg-white text-[#5c001f] rounded-xl px-5 py-3 font-bold">Open supervisor grading rubric</button><button @click="requestFinalDecision('correction')" class="bg-amber-500 text-black rounded-xl px-5 py-3 font-bold">Request final correction</button><button @click="requestFinalDecision('approve_for_examination')" class="bg-[#f8be17] text-[#5c001f] rounded-xl px-5 py-3 font-bold">Approve for examination</button></div>
          </section>
        </template>
      </main>
    </div>

    <EmailActionConfirmModal
      :open="Boolean(emailConfirmation)"
      :title="emailConfirmation?.title || 'Confirm action'"
      :description="emailConfirmation?.description || ''"
      :recipient="emailConfirmation?.recipient || ''"
      :confirm-label="emailConfirmation?.confirmLabel || 'Confirm'"
      :busy="saving"
      @cancel="emailConfirmation = null"
      @confirm="confirmEmailAction"
    />
  </div>
</template>
