<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  XCircle,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  UserCheck,
} from 'lucide-vue-next'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import EmailActionConfirmModal from '@/components/EmailActionConfirmModal.vue'
import { api, fileUrl } from '@/services/ifamousApi'
import { formatMalaysiaDateTime } from '@/utils/dateTime'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref('')
const data = ref(null)
const nominationAction = ref(0)
const actionMessage = ref('')
const pendingNomination = ref(null)

const projectId = computed(() => Number(route.query.projectId || 0))
const project = computed(() => data.value?.project || {})
const submissions = computed(() => data.value?.submissions || [])
const nominations = computed(() => data.value?.nominations || [])
const proposalDocuments = computed(() =>
  submissions.value.filter((item) => String(item.submission_type || '').toLowerCase() === 'proposal'),
)

const loadProject = async () => {
  loading.value = true
  error.value = ''
  try {
    if (!projectId.value) throw new Error('Missing project ID.')
    data.value = (await api.get(`/projects/${projectId.value}/journey`)).data
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  } finally {
    loading.value = false
  }
}

const runAi = () => {
  router.push({ path: '/manage-fyp', query: { projectId: projectId.value, action: 'ai' } })
}

const setNominationStatus = async (item, status) => {
  await api.patch(`/projects/${projectId.value}/supervisor-nominations/${item.nomination_id}`, { status })
}

const rejectNomination = async (item) => {
  nominationAction.value = Number(item.nomination_id)
  actionMessage.value = ''
  try {
    await setNominationStatus(item, 'Not Selected')
    actionMessage.value = `${item.supervisor_name} was marked as not selected.`
    pendingNomination.value = null
    await loadProject()
  } catch (err) {
    actionMessage.value = err.response?.data?.error || err.message
  } finally {
    nominationAction.value = 0
  }
}

const requestAcceptNomination = (item) => {
  pendingNomination.value = item
}

const acceptNomination = async (item, sendEmail = true) => {
  nominationAction.value = Number(item.nomination_id)
  actionMessage.value = ''
  try {
    await api.post('/supervisor-matching/assign', {
      projectId: projectId.value,
      project: {
        projectTitle: project.value.project_title,
        projectType: project.value.project_type,
        abstract: project.value.abstract,
        keywords: project.value.keywords,
        members: [{ name: project.value.student_name, matricNo: project.value.matric_no }],
      },
      sendEmail,
      supervisor: {
        user_id: item.supervisor_user_id,
        name: item.supervisor_name,
        email: item.supervisor_email,
        expertise: item.research_expertise || 'General academic supervision',
        score: project.value.match_score || 0,
      },
    })
    await setNominationStatus(item, 'Accepted')
    actionMessage.value = `${item.supervisor_name} was assigned as the project supervisor.`
    pendingNomination.value = null
    await loadProject()
  } catch (err) {
    actionMessage.value = err.response?.data?.error || err.message
  } finally {
    nominationAction.value = 0
  }
}

onMounted(loadProject)
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3] text-[#241616]">
    <AppHeader />
    <div class="flex">
      <AppSidebar />
      <main class="flex-1 p-7 lg:p-9 space-y-7 min-w-0">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button
            @click="router.push('/manage-fyp')"
            class="inline-flex items-center gap-2 font-bold text-[#5c001f]"
          >
            <ArrowLeft class="w-5 h-5" /> Back to Manage FYP
          </button>
          <button
            @click="runAi"
            class="inline-flex items-center gap-2 rounded-xl bg-[#5c001f] px-5 py-3 font-bold text-white"
          >
            <Sparkles class="w-5 h-5 text-[#f8be17]" /> Run AI Matching
          </button>
        </div>

        <section class="rounded-[30px] bg-[#5c001f] text-white p-8 shadow-xl relative overflow-hidden">
          <div class="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-[#f8be17]/20" />
          <div class="relative">
            <p class="text-[#f8be17] font-bold uppercase tracking-[0.2em]">Coordinator Project Review</p>
            <h1 class="text-3xl lg:text-4xl font-bold mt-2">{{ project.project_title || 'Project Details' }}</h1>
            <p class="text-white/75 mt-2">Review the proposal record and open or download the exact submitted file before running AI matching.</p>
          </div>
        </section>

        <section v-if="loading" class="bg-white rounded-[26px] p-10 text-center shadow">
          <Loader2 class="w-9 h-9 mx-auto animate-spin text-[#5c001f]" />
          <p class="font-bold mt-3">Loading project details...</p>
        </section>

        <section v-else-if="error" class="bg-red-50 border border-red-200 text-red-800 rounded-[24px] p-6 font-bold">
          {{ error }}
        </section>

        <template v-else-if="data">
          <section class="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div class="xl:col-span-2 bg-white rounded-[26px] p-6 shadow border border-black/5">
              <h2 class="text-2xl font-bold">Project information</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                <div class="rounded-[16px] bg-[#f7f1ea] p-4 border border-[#e1d5cc]">
                  <p class="text-xs uppercase font-bold text-gray-500">Student</p>
                  <p class="font-bold mt-2">{{ project.student_name || 'Student' }}</p>
                  <p class="text-sm text-gray-500">{{ project.matric_no || '-' }}</p>
                </div>
                <div class="rounded-[16px] bg-[#f7f1ea] p-4 border border-[#e1d5cc]">
                  <p class="text-xs uppercase font-bold text-gray-500">Status</p>
                  <p class="font-bold mt-2">{{ project.status || '-' }}</p>
                </div>
                <div class="rounded-[16px] bg-[#f7f1ea] p-4 border border-[#e1d5cc]">
                  <p class="text-xs uppercase font-bold text-gray-500">Project type</p>
                  <p class="font-bold mt-2">{{ project.project_type || 'Development' }}</p>
                </div>
                <div class="rounded-[16px] bg-[#f7f1ea] p-4 border border-[#e1d5cc]">
                  <p class="text-xs uppercase font-bold text-gray-500">Supervisor</p>
                  <p class="font-bold mt-2">{{ project.supervisor_name || 'Not Assigned' }}</p>
                  <p class="text-sm text-gray-500">{{ project.supervisor_email || '' }}</p>
                </div>
              </div>

              <div class="rounded-[16px] border border-[#e1d5cc] p-5 mt-5">
                <p class="font-bold text-[#5c001f]">Abstract</p>
                <p class="mt-3 whitespace-pre-line leading-relaxed text-gray-700">{{ project.abstract || 'No abstract available.' }}</p>
              </div>
              <div class="rounded-[16px] border border-[#e1d5cc] p-5 mt-4">
                <p class="font-bold text-[#5c001f]">Keywords</p>
                <p class="mt-3 text-gray-700">{{ project.keywords || '-' }}</p>
              </div>
            </div>

            <aside class="bg-white rounded-[26px] p-6 shadow border border-black/5 h-fit">
              <h2 class="text-xl font-bold flex items-center gap-2"><UserCheck class="w-5 h-5 text-[#5c001f]" /> Assignment</h2>
              <div class="mt-4 space-y-3 text-sm">
                <p><strong>Supervisor:</strong> {{ project.supervisor_name || 'Not Assigned' }}</p>
                <p><strong>Examiner:</strong> {{ project.assigned_examiner_name || project.examiner_name || 'Not Assigned' }}</p>
                <p><strong>Created:</strong> {{ formatMalaysiaDateTime(project.created_at) }}</p>
                <p><strong>Updated:</strong> {{ formatMalaysiaDateTime(project.updated_at) }}</p>
              </div>
            </aside>
          </section>

          <section class="bg-white rounded-[26px] p-6 shadow border border-black/5">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 class="text-2xl font-bold flex items-center gap-2"><Sparkles class="w-6 h-6 text-[#5c001f]" /> Student supervisor nominations</h2>
                <p class="text-gray-500 mt-1">The student preferences are advisory. Review suitability, workload and capacity before accepting one.</p>
              </div>
              <button @click="runAi" class="inline-flex items-center gap-2 rounded-xl bg-[#5c001f] px-4 py-2.5 font-bold text-white">
                <Sparkles class="w-4 h-4 text-[#f8be17]" /> Rerun AI / choose another
              </button>
            </div>

            <p v-if="actionMessage" class="mt-4 rounded-xl border border-[#e1d5cc] bg-[#f7f1ea] p-3 font-bold text-[#5c001f]">{{ actionMessage }}</p>

            <div v-if="nominations.length" class="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-5">
              <article v-for="item in nominations" :key="item.nomination_id" class="rounded-[18px] border border-[#e1d5cc] p-5">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-xs uppercase tracking-[0.15em] font-bold text-[#5c001f]">Preference #{{ item.preference_rank }}</p>
                    <h3 class="text-lg font-bold mt-1">{{ item.supervisor_name }}</h3>
                    <p class="text-sm text-gray-500">{{ item.supervisor_email }}</p>
                  </div>
                  <span class="rounded-full px-3 py-1 text-xs font-bold" :class="item.status === 'Accepted' ? 'bg-green-100 text-green-800' : item.status === 'Not Selected' ? 'bg-red-100 text-red-800' : 'bg-[#fff3c4] text-[#5c001f]'">{{ item.status }}</span>
                </div>
                <p class="text-sm mt-3"><strong>Expertise:</strong> {{ item.research_expertise || 'General academic supervision' }}</p>
                <p class="text-sm mt-2"><strong>Capacity:</strong> {{ item.current_capacity || 0 }} / {{ item.sv_capacity || 5 }}</p>
                <p v-if="item.note" class="text-xs text-gray-500 mt-3">{{ item.note }}</p>
                <div v-if="!project.supervisor_user_id && item.status === 'Nominated'" class="flex flex-wrap gap-2 mt-4">
                  <button @click="requestAcceptNomination(item)" :disabled="nominationAction === item.nomination_id" class="rounded-xl bg-green-700 px-4 py-2 font-bold text-white inline-flex items-center gap-2 disabled:opacity-60">
                    <CheckCircle2 class="w-4 h-4" /> Accept & assign
                  </button>
                  <button @click="rejectNomination(item)" :disabled="nominationAction === item.nomination_id" class="rounded-xl border border-red-300 px-4 py-2 font-bold text-red-700 inline-flex items-center gap-2 disabled:opacity-60">
                    <XCircle class="w-4 h-4" /> Not suitable
                  </button>
                </div>
              </article>
            </div>
            <div v-else class="mt-5 rounded-[18px] bg-[#f7f1ea] border border-[#e1d5cc] p-5 text-gray-600">
              No student nomination was submitted. Use AI matching or manual assignment.
            </div>
          </section>

          <section class="bg-white rounded-[26px] p-6 shadow border border-black/5">
            <div class="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 class="text-2xl font-bold flex items-center gap-2"><FileText class="w-6 h-6 text-[#5c001f]" /> Proposal documents</h2>
                <p class="text-gray-500 mt-1">PDF, DOC, DOCX, TXT and supported files are shown here.</p>
              </div>
            </div>

            <div v-if="proposalDocuments.length" class="space-y-3 mt-5">
              <div
                v-for="item in proposalDocuments"
                :key="item.submission_id"
                class="rounded-[18px] border border-[#e1d5cc] p-4 flex items-center justify-between gap-4 flex-wrap"
              >
                <div>
                  <p class="font-bold">{{ item.original_file_name || item.submission_title }}</p>
                  <p class="text-sm text-gray-500">{{ item.mime_type || 'Document' }} · {{ item.status }} · {{ formatMalaysiaDateTime(item.submitted_at) }}</p>
                </div>
                <div class="flex gap-2">
                  <a
                    :href="fileUrl(projectId, item.submission_id)"
                    target="_blank"
                    rel="noopener"
                    class="inline-flex items-center gap-2 rounded-xl border border-[#5c001f] px-4 py-2 font-bold text-[#5c001f]"
                  >
                    <Eye class="w-4 h-4" /> View
                  </a>
                  <a
                    :href="fileUrl(projectId, item.submission_id, true)"
                    class="inline-flex items-center gap-2 rounded-xl bg-[#5c001f] px-4 py-2 font-bold text-white"
                  >
                    <Download class="w-4 h-4" /> Download
                  </a>
                </div>
              </div>
            </div>
            <div v-else class="mt-5 rounded-[18px] bg-amber-50 border border-amber-200 p-5 text-amber-800">
              <p class="font-bold">No proposal document record was found.</p>
              <p class="text-sm mt-1">This is not caused by DOCX itself. It means the submission row was not saved or the old submission foreign key still points to the legacy project table.</p>
            </div>
          </section>
        </template>
      </main>
    </div>

    <EmailActionConfirmModal
      :open="Boolean(pendingNomination)"
      title="Accept and assign this nomination?"
      :description="pendingNomination ? `${pendingNomination.supervisor_name} will become the assigned supervisor for this project.` : ''"
      :recipient="pendingNomination?.supervisor_email || pendingNomination?.supervisor_name || ''"
      confirm-label="Accept and assign"
      :busy="Boolean(nominationAction)"
      @cancel="pendingNomination = null"
      @confirm="(sendEmail) => acceptNomination(pendingNomination, sendEmail)"
    />
  </div>
</template>
