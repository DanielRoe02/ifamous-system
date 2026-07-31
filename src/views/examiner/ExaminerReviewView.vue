<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Download, ExternalLink, FileText, Loader2, Save, Send } from 'lucide-vue-next'
import AppHeader from '@/components/AppHeader.vue'
import RoleSidebar from '@/components/RoleSidebar.vue'
import EmailActionConfirmModal from '@/components/EmailActionConfirmModal.vue'
import { api, fileUrl } from '@/services/ifamousApi'

const route = useRoute()
const router = useRouter()
const projectId = Number(route.query.projectId || 0)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const payload = ref({ project: {}, submissions: [], rubric: [], evaluation: null, scores: [] })
const comments = reactive({ strengths: '', improvements: '', recommendations: '', overallComments: '' })
const scoreMap = reactive({})
const commentMap = reactive({})
const showSubmitConfirm = ref(false)

const total = computed(() => payload.value.rubric.reduce((sum, item) => sum + Number(scoreMap[item.rubric_item_id] || 0), 0))
const maxTotal = computed(() => payload.value.rubric.reduce((sum, item) => sum + Number(item.max_score || 0), 0))
const percentage = computed(() => maxTotal.value ? ((total.value / maxTotal.value) * 100).toFixed(2) : '0.00')
const locked = computed(() => payload.value.evaluation?.status === 'Submitted')

async function load() {
  try {
    if (!projectId) throw new Error('Project ID is missing.')
    const response = await api.get(`/examiner/projects/${projectId}`)
    payload.value = response.data
    const evaluation = response.data.evaluation || {}
    Object.assign(comments, {
      strengths: evaluation.strengths || '', improvements: evaluation.improvements || '',
      recommendations: evaluation.recommendations || '', overallComments: evaluation.overall_comments || '',
    })
    for (const item of response.data.scores || []) {
      scoreMap[item.rubric_item_id] = Number(item.score)
      commentMap[item.rubric_item_id] = item.comment || ''
    }
  } catch (err) { error.value = err.response?.data?.error || err.message }
  finally { loading.value = false }
}

async function save(submit = false, sendEmail = true) {
  saving.value = true; error.value = ''
  try {
    const scores = payload.value.rubric.map((item) => ({
      rubricItemId: item.rubric_item_id,
      score: Number(scoreMap[item.rubric_item_id] || 0),
      comment: commentMap[item.rubric_item_id] || '',
    }))
    await api.put(`/examiner/projects/${projectId}/evaluation`, { ...comments, scores, submit, sendEmail })
    showSubmitConfirm.value = false
    await load()
  } catch (err) { error.value = err.response?.data?.error || err.message }
  finally { saving.value = false }
}

onMounted(load)
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3]"><AppHeader /><div class="flex"><RoleSidebar role="Staff" /><main class="flex-1 p-8 space-y-6 min-w-0">
    <button @click="router.push('/examiner-projects')" class="font-bold text-[#5c001f] inline-flex items-center gap-2"><ArrowLeft class="w-5 h-5" /> Assigned Grading FYP</button>
    <div v-if="loading" class="bg-white rounded-2xl p-10"><Loader2 class="animate-spin mx-auto text-[#5c001f]" /></div><div v-else-if="error && !payload.project.project_id" class="bg-red-50 text-red-800 rounded-2xl p-5 font-bold">{{ error }}</div>
    <template v-else>
      <section class="bg-[#5c001f] text-white rounded-[30px] p-8 shadow-xl"><p class="text-[#f8be17] font-bold uppercase tracking-[0.2em]">Formal Examination</p><h1 class="text-3xl font-bold mt-2">{{ payload.project.project_title }}</h1><p class="text-white/75 mt-2">{{ payload.project.student_name }} · Supervisor: {{ payload.project.supervisor_name }}</p></section>
      <div v-if="error" class="bg-red-50 text-red-800 rounded-2xl p-4 font-bold">{{ error }}</div>

      <section class="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div class="xl:col-span-2 bg-white rounded-[26px] p-6 shadow">
          <h2 class="text-2xl font-bold">Approved examination package</h2>
          <div class="space-y-3 mt-5"><div v-for="item in payload.submissions" :key="item.submission_id" class="border rounded-2xl p-4 flex justify-between items-center gap-4 flex-wrap"><div class="flex gap-3"><FileText class="w-6 h-6 text-[#5c001f]" /><div><p class="font-bold">{{ item.original_file_name || item.submission_title }}</p><p class="text-sm text-gray-500">Version {{ item.version_number }} · {{ item.is_locked ? 'Locked approved copy' : item.status }}</p></div></div><div class="flex gap-2"><a :href="fileUrl(projectId, item.submission_id)" target="_blank" class="border rounded-xl px-3 py-2 font-bold">Preview</a><a :href="fileUrl(projectId, item.submission_id, true)" class="border rounded-xl px-3 py-2 font-bold inline-flex gap-2"><Download class="w-4 h-4" /> Download</a></div></div></div>
        </div>
        <aside class="bg-white rounded-[26px] p-6 shadow space-y-4"><h2 class="text-xl font-bold">Project resources</h2><p class="text-sm"><strong>Type:</strong> {{ payload.project.project_type || '-' }}</p><p class="text-sm"><strong>Keywords:</strong> {{ payload.project.keywords || '-' }}</p><a v-if="payload.project.github_url" :href="payload.project.github_url" target="_blank" class="w-full border rounded-xl px-4 py-3 font-bold inline-flex gap-2"><ExternalLink class="w-4 h-4" /> Open GitHub</a><a v-if="payload.project.google_drive_url" :href="payload.project.google_drive_url" target="_blank" class="w-full border rounded-xl px-4 py-3 font-bold inline-flex gap-2"><ExternalLink class="w-4 h-4" /> Open Google Drive</a><button @click="router.push({path:'/project-journey',query:{projectId}})" class="w-full bg-[#f7f1ea] rounded-xl px-4 py-3 font-bold">View allowed journey evidence</button></aside>
      </section>

      <section class="bg-white rounded-[26px] p-6 shadow">
        <div class="flex justify-between gap-4 flex-wrap"><div><h2 class="text-2xl font-bold">Official grading rubric</h2><p class="text-gray-500 mt-1">Scores cannot exceed each criterion maximum.</p></div><div class="text-right"><p class="text-sm text-gray-500">Calculated score</p><p class="text-3xl font-bold text-[#5c001f]">{{ total }} / {{ maxTotal }} <span class="text-lg">({{ percentage }}%)</span></p></div></div>
        <div class="overflow-x-auto mt-5"><table class="w-full min-w-[760px]"><thead><tr class="bg-[#f7f1ea] text-left"><th class="p-3">Criterion</th><th class="p-3">Description</th><th class="p-3 w-32">Maximum</th><th class="p-3 w-36">Score</th><th class="p-3">Criterion comment</th></tr></thead><tbody><tr v-for="item in payload.rubric" :key="item.rubric_item_id" class="border-b"><td class="p-3 font-bold">{{ item.criterion }}</td><td class="p-3 text-sm text-gray-600">{{ item.description }}</td><td class="p-3">{{ item.max_score }}</td><td class="p-3"><input v-model.number="scoreMap[item.rubric_item_id]" :disabled="locked" type="number" min="0" :max="item.max_score" class="w-28 border rounded-lg px-3 py-2" /></td><td class="p-3"><input v-model="commentMap[item.rubric_item_id]" :disabled="locked" class="w-full border rounded-lg px-3 py-2" placeholder="Optional comment" /></td></tr></tbody></table></div>
      </section>

      <section class="bg-white rounded-[26px] p-6 shadow"><h2 class="text-2xl font-bold">Examiner feedback</h2><div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5"><textarea v-model="comments.strengths" :disabled="locked" class="border rounded-xl p-4 min-h-28" placeholder="Strengths" /><textarea v-model="comments.improvements" :disabled="locked" class="border rounded-xl p-4 min-h-28" placeholder="Areas requiring improvement" /><textarea v-model="comments.recommendations" :disabled="locked" class="border rounded-xl p-4 min-h-28" placeholder="Recommendations" /><textarea v-model="comments.overallComments" :disabled="locked" class="border rounded-xl p-4 min-h-28" placeholder="Overall comments" /></div><div v-if="!locked" class="flex flex-wrap gap-3 mt-5"><button @click="save(false)" :disabled="saving" class="border border-[#5c001f] text-[#5c001f] rounded-xl px-5 py-3 font-bold inline-flex gap-2"><Save class="w-5 h-5" /> Save draft</button><button @click="showSubmitConfirm = true" :disabled="saving" class="bg-[#5c001f] text-white rounded-xl px-5 py-3 font-bold inline-flex gap-2"><Send class="w-5 h-5" /> Submit final evaluation</button></div><p v-else class="mt-5 bg-green-50 text-green-800 rounded-xl p-4 font-bold">Evaluation submitted and locked. The coordinator can now review and release the result.</p></section>
    </template>
  </main></div>
    <EmailActionConfirmModal
      :open="showSubmitConfirm"
      title="Submit final examiner evaluation?"
      description="The evaluation will be locked and the coordinator will be notified that grading is complete."
      recipient="I-FAMOUS coordinator(s)"
      confirm-label="Submit final evaluation"
      :busy="saving"
      @cancel="showSubmitConfirm = false"
      @confirm="(sendEmail) => save(true, sendEmail)"
    />
  </div>
</template>
