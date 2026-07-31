<script setup>
import { computed, onMounted, ref } from 'vue'
import { Sparkles, Loader2, RefreshCw, Search, UserRoundCheck } from 'lucide-vue-next'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import EmailActionConfirmModal from '@/components/EmailActionConfirmModal.vue'
import { api } from '@/services/ifamousApi'

const loading = ref(true)
const matching = ref(false)
const error = ref('')
const projects = ref([])
const selected = ref(null)
const candidates = ref([])
const search = ref('')
const weights = ref({ supervisorWeight: '', examinerWeight: '' })
const weightsConfigured = ref(false)
const emailConfirmation = ref(null)
const actionBusy = ref(false)

const filtered = computed(() =>
  projects.value.filter((item) =>
    `${item.project_title} ${item.student_name} ${item.supervisor_name}`
      .toLowerCase()
      .includes(search.value.toLowerCase()),
  ),
)

async function loadQueue() {
  loading.value = true
  error.value = ''
  try {
    const response = (await api.get('/coordinator/examiner-queue')).data
    projects.value = response.projects || []
    const settings = response.assessmentSettings || {}
    weights.value = {
      supervisorWeight: settings.supervisor_weight ?? '',
      examinerWeight: settings.examiner_weight ?? '',
    }
    weightsConfigured.value = Boolean(response.weightsConfigured)
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  } finally {
    loading.value = false
  }
}

async function match(project) {
  selected.value = project
  matching.value = true
  candidates.value = []
  error.value = ''
  try {
    candidates.value = (
      await api.get(`/coordinator/examiner-match/${project.project_id}`)
    ).data.candidates || []
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  } finally {
    matching.value = false
  }
}

function requestAssignment(candidate) {
  emailConfirmation.value = {
    kind: 'assign',
    candidate,
    title: 'Assign this examiner?',
    description: `${candidate.full_name} will be assigned to examine “${selected.value?.project_title || 'this project'}”.`,
    recipient: candidate.email || candidate.full_name || 'Selected examiner',
    confirmLabel: 'Assign examiner',
  }
}

function requestRelease(project) {
  emailConfirmation.value = {
    kind: 'release',
    project,
    title: 'Release this result?',
    description: 'The student will gain access to the released marks, rubric breakdown and feedback.',
    recipient: project.student_email || project.student_name || 'Project student',
    confirmLabel: 'Release result',
  }
}

async function confirmEmailAction(sendEmail) {
  const pending = emailConfirmation.value
  if (!pending) return
  actionBusy.value = true
  error.value = ''
  try {
    if (pending.kind === 'assign') {
      await api.post(`/coordinator/projects/${selected.value.project_id}/assign-examiner`, {
        examinerUserId: pending.candidate.user_id,
        matchScore: pending.candidate.matchScore,
        reason: pending.candidate.reason,
        sendEmail,
      })
      selected.value = null
      candidates.value = []
    } else if (pending.kind === 'release') {
      await api.post(`/coordinator/projects/${pending.project.project_id}/release-result`, {
        sendEmail,
      })
    }
    emailConfirmation.value = null
    await loadQueue()
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  } finally {
    actionBusy.value = false
  }
}

async function remove(project) {
  if (!confirm(`Remove the examiner assignment for “${project.project_title}”?`)) return
  try {
    await api.delete(`/coordinator/projects/${project.project_id}/examiner`)
    await loadQueue()
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  }
}

async function saveWeights() {
  try {
    await api.put('/coordinator/assessment-settings', weights.value)
    await loadQueue()
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  }
}

onMounted(loadQueue)
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3]">
    <AppHeader />
    <div class="flex">
      <AppSidebar />
      <main class="flex-1 p-8 space-y-6 min-w-0">
        <section class="bg-[#5c001f] text-white rounded-[30px] p-8 shadow-xl">
          <p class="text-[#f8be17] font-bold uppercase tracking-[0.2em] flex gap-2">
            <Sparkles class="w-5 h-5" /> Coordinator AI Matching
          </p>
          <h1 class="text-4xl font-bold mt-2">Assign Examiner</h1>
          <p class="text-white/75 mt-2">
            Projects enter this queue only after the supervisor approves the final deliverables for examination.
          </p>
        </section>

        <div v-if="error" class="bg-red-50 text-red-800 border border-red-200 rounded-2xl p-4 font-bold">
          {{ error }}
        </div>

        <section class="bg-white rounded-[22px] p-5 shadow border border-black/5">
          <div class="flex items-end gap-4 flex-wrap">
            <div>
              <h2 class="text-xl font-bold">Official assessment weighting</h2>
              <p class="text-sm text-gray-500">Set this only when the official faculty percentage is confirmed. It must total 100%.</p>
            </div>
            <label class="ml-auto">
              <span class="text-sm font-bold">Supervisor %</span>
              <input v-model.number="weights.supervisorWeight" type="number" min="0" max="100" class="block border rounded-xl px-3 py-2 w-32 mt-1" />
            </label>
            <label>
              <span class="text-sm font-bold">Examiner %</span>
              <input v-model.number="weights.examinerWeight" type="number" min="0" max="100" class="block border rounded-xl px-3 py-2 w-32 mt-1" />
            </label>
            <button @click="saveWeights" class="bg-[#5c001f] text-white rounded-xl px-4 py-2.5 font-bold">Save weights</button>
            <span class="font-bold" :class="weightsConfigured ? 'text-green-700' : 'text-amber-700'">
              {{ weightsConfigured ? 'Configured' : 'Not configured' }}
            </span>
          </div>
        </section>

        <div class="bg-white rounded-[20px] p-4 flex items-center gap-3">
          <Search class="w-5 h-5 text-gray-500" />
          <input v-model="search" class="flex-1 outline-none" placeholder="Search project, student or supervisor" />
          <button @click="loadQueue" class="font-bold text-[#5c001f] inline-flex gap-2">
            <RefreshCw class="w-4 h-4" /> Refresh
          </button>
        </div>

        <div v-if="loading" class="bg-white rounded-2xl p-10">
          <Loader2 class="animate-spin mx-auto text-[#5c001f]" />
        </div>

        <section v-else class="bg-white rounded-[26px] shadow overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[1000px]">
              <thead>
                <tr class="bg-[#f7f1ea] text-left">
                  <th class="p-4">FYP</th>
                  <th class="p-4">Student</th>
                  <th class="p-4">Supervisor</th>
                  <th class="p-4">Status</th>
                  <th class="p-4">Examiner</th>
                  <th class="p-4">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="project in filtered" :key="project.project_id" class="border-t">
                  <td class="p-4">
                    <p class="font-bold">{{ project.project_title }}</p>
                    <p class="text-sm text-gray-500">{{ project.project_type }}</p>
                  </td>
                  <td class="p-4">
                    {{ project.student_name }}<br />
                    <span class="text-sm text-gray-500">{{ project.matric_no }}</span>
                  </td>
                  <td class="p-4">{{ project.supervisor_name }}</td>
                  <td class="p-4">
                    <span class="bg-amber-100 text-amber-800 rounded-full px-3 py-1 text-xs font-bold">{{ project.status }}</span>
                  </td>
                  <td class="p-4">
                    <p class="font-bold">{{ project.examiner_name || 'Not assigned' }}</p>
                    <p class="text-sm text-gray-500">{{ project.examiner_email || '' }}</p>
                    <p v-if="project.supervisor_percentage != null || project.examiner_percentage != null" class="text-xs mt-2 text-gray-600">
                      Supervisor: {{ project.supervisor_percentage ?? '-' }}% · Examiner: {{ project.examiner_percentage ?? '-' }}%<br />
                      <strong>Combined: {{ project.combined_score ?? 'Waiting for weights/marks' }}</strong>
                    </p>
                  </td>
                  <td class="p-4">
                    <div class="flex flex-wrap gap-2">
                      <button v-if="!project.examiner_user_id" @click="match(project)" class="bg-[#5c001f] text-white rounded-xl px-4 py-2 font-bold">AI Match</button>
                      <button v-else-if="project.evaluation_status !== 'Submitted'" @click="match(project)" class="border rounded-xl px-4 py-2 font-bold">Change</button>
                      <button v-if="project.examiner_user_id && project.evaluation_status !== 'Submitted'" @click="remove(project)" class="border border-red-300 text-red-700 rounded-xl px-4 py-2 font-bold">Remove</button>
                      <button v-if="project.evaluation_status === 'Submitted' && project.status !== 'Result Released'" @click="requestRelease(project)" class="bg-green-700 text-white rounded-xl px-4 py-2 font-bold">Release result</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="!filtered.length" class="p-8 text-gray-500">No projects are waiting in the examination workflow.</p>
        </section>

        <div v-if="selected" class="fixed inset-0 bg-black/50 z-50 p-5 flex items-center justify-center" @click.self="selected = null">
          <section class="bg-white rounded-[28px] w-full max-w-4xl max-h-[90vh] overflow-auto p-7">
            <div class="flex justify-between gap-4">
              <div>
                <p class="text-[#5c001f] font-bold uppercase tracking-[0.16em]">AI Examiner Recommendation</p>
                <h2 class="text-2xl font-bold mt-1">{{ selected.project_title }}</h2>
                <p class="text-sm text-gray-500 mt-1">The supervisor is automatically excluded. AI recommends; the coordinator decides.</p>
              </div>
              <button @click="selected = null" class="text-xl">✕</button>
            </div>

            <div v-if="matching" class="p-10 text-center">
              <Loader2 class="animate-spin mx-auto text-[#5c001f]" />
              <p class="font-bold mt-3">Analysing expertise, workload and availability…</p>
            </div>

            <div v-else class="space-y-3 mt-6">
              <article v-for="(candidate, index) in candidates" :key="candidate.user_id" class="border rounded-[18px] p-5 flex justify-between items-center gap-4 flex-wrap">
                <div>
                  <p class="font-bold text-lg">{{ index + 1 }}. {{ candidate.full_name }} — {{ candidate.matchScore }}% match</p>
                  <p class="text-sm text-gray-600">{{ candidate.expertise || candidate.industry_background || 'General expertise' }}</p>
                  <p class="text-sm text-gray-500 mt-1">Pending grading: {{ candidate.pending_examinations }} · {{ candidate.department || candidate.organisation || candidate.affiliation || 'No department provided' }}</p>
                </div>
                <button @click="requestAssignment(candidate)" :disabled="!candidate.eligible" class="rounded-xl px-5 py-2.5 font-bold inline-flex gap-2" :class="candidate.eligible ? 'bg-[#5c001f] text-white' : 'bg-gray-200 text-gray-500'">
                  <UserRoundCheck class="w-5 h-5" /> Assign
                </button>
              </article>
              <p v-if="!candidates.length" class="text-gray-500">No eligible examiner profiles are available.</p>
            </div>
          </section>
        </div>
      </main>
    </div>

    <EmailActionConfirmModal
      :open="Boolean(emailConfirmation)"
      :title="emailConfirmation?.title || 'Confirm action'"
      :description="emailConfirmation?.description || ''"
      :recipient="emailConfirmation?.recipient || ''"
      :confirm-label="emailConfirmation?.confirmLabel || 'Confirm'"
      :busy="actionBusy"
      @cancel="emailConfirmation = null"
      @confirm="confirmEmailAction"
    />
  </div>
</template>
