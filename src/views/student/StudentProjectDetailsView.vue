<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Loader2,
  MessageSquareText,
  UploadCloud,
  UserCheck,
} from "lucide-vue-next";
import AppHeader from "@/components/AppHeader.vue";
import RoleSidebar from "@/components/RoleSidebar.vue";
import EmailActionConfirmModal from "@/components/EmailActionConfirmModal.vue";
import { feedbackFileUrl, fileUrl } from "@/services/ifamousApi";
import { canOpenJourney, isRejected, nextActionForStatus, workflowStep } from "@/utils/fypWorkflow";
import { formatMalaysiaDate } from "@/utils/dateTime";

const route = useRoute();
const router = useRouter();

const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:3000";

const loading = ref(false);
const errorMessage = ref("");
const project = ref(null);
const resultData = ref(null);
const resultLoading = ref(false);
const revisionFile = ref(null);
const revisionNote = ref("");
const revisionSubmitting = ref(false);
const revisionSuccess = ref("");
const showRevisionConfirm = ref(false);

const projectId = computed(() => {
  return route.query.projectId || route.params.projectId || "";
});

function getAuthToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("ifamous_token") ||
    localStorage.getItem("ifamousToken") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

async function loadProjectDetails() {
  if (!projectId.value) {
    errorMessage.value = "Missing project ID.";
    return;
  }

  loading.value = true;
  errorMessage.value = "";

  try {
    const response = await fetch(
      `${API_BASE}/api/student/my-fyp/${projectId.value}`,
      {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load project details.");
    }

    project.value = data.project;
  } catch (error) {
    errorMessage.value = error.message;
    project.value = null;
  } finally {
    loading.value = false;
  }
}

function statusClass(status) {
  const value = String(status || "").toLowerCase();

  if (value.includes("rejected")) {
    return "bg-red-100 text-red-700 border-red-200";
  }

  if (value.includes("active") || value.includes("approved") || value.includes("assigned")) {
    return "bg-green-100 text-green-700 border-green-200";
  }

  if (value.includes("revision")) {
    return "bg-orange-100 text-orange-700 border-orange-200";
  }

  if (value.includes("pending") || value.includes("draft")) {
    return "bg-yellow-100 text-yellow-700 border-yellow-200";
  }

  return "bg-gray-100 text-gray-700 border-gray-200";
}

const journeyAvailable = computed(() => canOpenJourney(project.value?.status));
const rejectedProject = computed(() => isRejected(project.value?.status));
const resultReleased = computed(() => String(project.value?.status || '') === 'Result Released');
const revisionRequired = computed(() => String(project.value?.status || '') === 'Revision Required');
const revisedProposalSubmitted = computed(() => String(project.value?.status || '') === 'Revised Proposal Submitted');
const supervisorFeedback = computed(() =>
  (project.value?.feedback || []).filter((item) => String(item.author_role || '') === 'Supervisor')
);
const nextAction = computed(() => nextActionForStatus(project.value?.status));

const timeline = computed(() => {
  const currentStep = workflowStep(project.value?.status);
  const steps = [
    { step: 1, label: 'Proposal', waitingText: 'Proposal has not been submitted' },
    { step: 2, label: 'Review & Assignment', waitingText: 'Waiting for coordinator and supervisor review' },
    { step: 3, label: 'Development Journey', waitingText: 'Available after proposal approval' },
    { step: 4, label: 'Final & Examination', waitingText: 'Waiting for final submission and examination' },
    { step: 5, label: 'Completed', waitingText: 'Waiting for grading and result release' },
  ];
  return steps.map((item) => ({
    ...item,
    done: currentStep >= item.step && !rejectedProject.value,
    current: currentStep === item.step,
    statusText: rejectedProject.value
      ? (item.step === 1 ? 'Proposal rejected — workflow closed' : item.waitingText)
      : currentStep > item.step
        ? 'Completed'
        : currentStep === item.step
          ? nextAction.value
          : item.waitingText,
  }));
});

async function loadResult() {
  if (!projectId.value || !resultReleased.value) return;
  resultLoading.value = true;
  try {
    const response = await fetch(`${API_BASE}/api/student/my-fyp/${projectId.value}/result`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load released result.');
    resultData.value = data;
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    resultLoading.value = false;
  }
}

function openJourney() {
  if (!journeyAvailable.value) return;
  router.push({ path: '/project-journey', query: { projectId: projectId.value } });
}

function scrollToResult() {
  window.requestAnimationFrame(() => {
    document.getElementById('results-feedback')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function requestRevisedProposalSubmission() {
  if (!revisionFile.value) {
    errorMessage.value = "Please choose a revised PDF or DOCX proposal.";
    return;
  }
  showRevisionConfirm.value = true;
}

async function submitRevisedProposal(sendEmail = true) {
  if (!revisionFile.value) {
    errorMessage.value = "Please choose a revised PDF or DOCX proposal.";
    return;
  }
  revisionSubmitting.value = true;
  errorMessage.value = "";
  revisionSuccess.value = "";
  try {
    const body = new FormData();
    body.append("proposal", revisionFile.value);
    body.append("responseNote", revisionNote.value || "");
    body.append("sendEmail", String(sendEmail));
    const response = await fetch(`${API_BASE}/api/student/my-fyp/${projectId.value}/revision`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getAuthToken()}` },
      body,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to submit revised proposal.");
    revisionSuccess.value = data.message || "Revised proposal submitted.";
    showRevisionConfirm.value = false;
    revisionFile.value = null;
    revisionNote.value = "";
    await loadProjectDetails();
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    revisionSubmitting.value = false;
  }
}

onMounted(async () => {
  await loadProjectDetails();
  if (resultReleased.value) await loadResult();
  if (route.query.tab === 'result') scrollToResult();
});
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3] text-black font-['Inter']">
    <AppHeader />

    <div class="flex">
      <RoleSidebar role="Student" />

      <main class="flex-1 p-8 space-y-7">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button
            @click="router.push('/student-fyp')"
            class="inline-flex items-center gap-2 text-[#5c001f] font-bold"
          >
            <ArrowLeft class="w-5 h-5" />
            Back to My FYP
          </button>
          <div class="flex flex-wrap gap-2">
            <button
              v-if="resultReleased"
              @click="scrollToResult"
              class="bg-green-700 text-white rounded-xl px-5 py-2.5 font-bold inline-flex items-center gap-2"
            >
              <Award class="w-4 h-4" /> Results & Feedback
            </button>
            <button
              v-if="projectId && journeyAvailable"
              @click="openJourney"
              class="bg-[#5c001f] text-white rounded-xl px-5 py-2.5 font-bold"
            >
              Open FYP Journey
            </button>
          </div>
        </div>

        <section class="rounded-[32px] bg-[#5c001f] text-white p-8 shadow-xl relative overflow-hidden">
          <div class="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[#f8be17]/20"></div>
          <p class="text-[#f8be17] font-bold uppercase tracking-[0.2em]">
            My Project Details
          </p>
          <h1 class="text-[34px] font-bold mt-2">
            {{ project?.title || "Project Details" }}
          </h1>
          <p class="text-white/80 mt-2">
            View proposal details, supervisor/examiner assignment, documents, timeline and feedback.
          </p>
        </section>

        <section
          v-if="loading"
          class="bg-white rounded-[28px] p-10 shadow-lg border border-black/10 text-center"
        >
          <Loader2 class="w-8 h-8 mx-auto text-[#5c001f] animate-spin" />
          <p class="font-bold text-[#5c001f] mt-3">Loading project details...</p>
        </section>

        <section
          v-else-if="errorMessage"
          class="bg-red-50 border border-red-200 text-red-700 rounded-[24px] p-6 font-bold"
        >
          {{ errorMessage }}
        </section>

        <template v-else-if="project">
          <section class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
            <h2 class="text-[28px] font-bold mb-6">Project Information</h2>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div class="rounded-[18px] border border-[#e1d5cc] bg-[#f7f1ea] p-5">
                <p class="text-xs uppercase tracking-[0.12em] font-bold text-gray-500">
                  Project Type
                </p>
                <p class="font-bold mt-2">{{ project.type || "-" }}</p>
              </div>

              <div class="rounded-[18px] border border-[#e1d5cc] bg-[#f7f1ea] p-5">
                <p class="text-xs uppercase tracking-[0.12em] font-bold text-gray-500">
                  Current Status
                </p>
                <span
                  :class="statusClass(project.status)"
                  class="inline-flex mt-2 px-3 py-1 rounded-full border font-bold text-sm"
                >
                  {{ project.status || "-" }}
                </span>
              </div>

              <div class="rounded-[18px] border border-[#e1d5cc] bg-[#f7f1ea] p-5">
                <p class="text-xs uppercase tracking-[0.12em] font-bold text-gray-500">
                  Supervisor
                </p>
                <p class="font-bold mt-2">{{ project.supervisor || "Not Assigned" }}</p>
                <p v-if="project.supervisorEmail" class="text-sm text-gray-600 mt-1">
                  {{ project.supervisorEmail }}
                </p>
              </div>

              <div class="rounded-[18px] border border-[#e1d5cc] bg-[#f7f1ea] p-5">
                <p class="text-xs uppercase tracking-[0.12em] font-bold text-gray-500">
                  Examiner
                </p>
                <p class="font-bold mt-2">{{ project.examiner || "Not Assigned" }}</p>
                <p v-if="project.examinerEmail" class="text-sm text-gray-600 mt-1">
                  {{ project.examinerEmail }}
                </p>
              </div>
            </div>

            <div class="rounded-[18px] border border-[#e1d5cc] p-5 mt-5">
              <p class="text-sm font-bold text-[#5c001f]">Abstract</p>
              <p class="mt-3 text-gray-700 leading-relaxed whitespace-pre-line">
                {{ project.abstract || "No abstract submitted yet." }}
              </p>
            </div>

            <div class="rounded-[18px] border border-[#e1d5cc] p-5 mt-5">
              <p class="text-sm font-bold text-[#5c001f]">Keywords</p>
              <p class="mt-3 text-gray-700">
                {{ project.keywords || "No keywords submitted yet." }}
              </p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
              <div class="rounded-[18px] border border-[#e1d5cc] p-5">
                <p class="text-sm font-bold text-[#5c001f]">Created</p>
                <p class="mt-2 font-bold">{{ formatMalaysiaDate(project.createdAt) }}</p>
              </div>

              <div class="rounded-[18px] border border-[#e1d5cc] p-5">
                <p class="text-sm font-bold text-[#5c001f]">Last Updated</p>
                <p class="mt-2 font-bold">{{ formatMalaysiaDate(project.updatedAt) }}</p>
              </div>
            </div>
          </section>

          <section v-if="revisionRequired || revisedProposalSubmitted" class="rounded-[24px] border p-6" :class="revisionRequired ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-blue-200 bg-blue-50 text-blue-950'">
            <h2 class="text-xl font-bold flex items-center gap-2">
              <AlertTriangle v-if="revisionRequired" class="w-6 h-6" />
              <CheckCircle2 v-else class="w-6 h-6" />
              {{ revisionRequired ? 'Proposal revision required' : 'Revised proposal submitted' }}
            </h2>
            <p class="mt-2">
              {{ revisionRequired
                ? 'Review the supervisor comments and correction attachments below, then upload a new proposal version.'
                : 'Your revised proposal has been sent to the supervisor. You will be notified after the new review decision.' }}
            </p>

            <div v-if="supervisorFeedback.length" class="mt-5 space-y-3">
              <article v-for="item in supervisorFeedback" :key="item.feedback_id" class="rounded-[16px] border border-amber-200 bg-white p-4 text-[#241616]">
                <div class="flex flex-wrap justify-between gap-2">
                  <p class="font-bold">Supervisor revision feedback</p>
                  <p class="text-xs text-gray-500">{{ formatMalaysiaDate(item.created_at) }}</p>
                </div>
                <p class="mt-2 whitespace-pre-line">{{ item.comment || 'No written comment.' }}</p>
                <div v-if="item.attachment_path" class="mt-3 flex flex-wrap gap-2">
                  <a :href="feedbackFileUrl(projectId, item.feedback_id)" target="_blank" rel="noopener" class="inline-flex items-center gap-2 rounded-xl border border-[#5c001f] px-4 py-2 font-bold text-[#5c001f]"><Eye class="w-4 h-4" /> View attachment</a>
                  <a :href="feedbackFileUrl(projectId, item.feedback_id, true)" class="inline-flex items-center gap-2 rounded-xl bg-[#5c001f] px-4 py-2 font-bold text-white"><Download class="w-4 h-4" /> {{ item.attachment_name || 'Download correction file' }}</a>
                </div>
              </article>
            </div>
            <div v-else class="mt-4 rounded-[14px] bg-white/70 border border-amber-200 p-4">No supervisor feedback record was found yet. Refresh the page or contact your supervisor.</div>

            <form v-if="revisionRequired" @submit.prevent="requestRevisedProposalSubmission" class="mt-6 rounded-[18px] bg-white border border-amber-200 p-5 space-y-4">
              <div>
                <label class="font-bold block mb-2">Upload revised proposal</label>
                <input type="file" accept=".pdf,.doc,.docx,.txt" @change="revisionFile = $event.target.files?.[0] || null" class="w-full rounded-[14px] border border-[#d8c9bd] px-4 py-3" />
                <p class="text-xs text-gray-500 mt-2">The new file is saved as another proposal version. The original version remains in Documents.</p>
              </div>
              <div>
                <label class="font-bold block mb-2">Response note (optional)</label>
                <textarea v-model="revisionNote" rows="4" class="w-full rounded-[14px] border border-[#d8c9bd] px-4 py-3" placeholder="Briefly explain what you changed..."></textarea>
              </div>
              <button type="submit" :disabled="revisionSubmitting" class="rounded-xl bg-[#5c001f] px-5 py-3 font-bold text-white inline-flex items-center gap-2 disabled:opacity-60">
                <Loader2 v-if="revisionSubmitting" class="w-5 h-5 animate-spin" />
                <UploadCloud v-else class="w-5 h-5" />
                {{ revisionSubmitting ? 'Submitting revision...' : 'Submit revised proposal' }}
              </button>
            </form>
            <p v-if="revisionSuccess" class="mt-4 rounded-[14px] border border-green-200 bg-green-50 p-4 font-bold text-green-700">{{ revisionSuccess }}</p>
          </section>

          <section v-if="rejectedProject" class="rounded-[24px] border border-red-200 bg-red-50 p-6 text-red-800">
            <h2 class="text-xl font-bold flex items-center gap-2"><AlertTriangle class="w-6 h-6" /> Proposal rejected</h2>
            <p class="mt-2">This project is kept as read-only history and cannot enter the FYP Development Journey. Review the decision, feedback and attachments below before creating a new proposal.</p>
            <div v-if="project.feedback?.length" class="mt-5 space-y-3">
              <div v-for="item in project.feedback" :key="item.feedback_id" class="rounded-[16px] border border-red-200 bg-white p-4 text-[#241616]">
                <p class="font-bold">{{ item.author_role }} feedback</p>
                <p class="mt-2 whitespace-pre-line">{{ item.comment || 'No written comment.' }}</p>
                <a v-if="item.attachment_path" :href="feedbackFileUrl(projectId, item.feedback_id, true)" class="mt-3 inline-flex items-center gap-2 font-bold text-[#5c001f]">
                  <Download class="w-4 h-4" /> {{ item.attachment_name || 'Download correction attachment' }}
                </a>
              </div>
            </div>
          </section>

          <section class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
            <h2 class="text-[28px] font-bold mb-6">Documents</h2>

            <div
              v-if="!project.documents || project.documents.length === 0"
              class="rounded-[18px] border border-[#e1d5cc] bg-[#f7f1ea] p-6 text-gray-600"
            >
              <p class="font-bold">No submitted document record was found for this project.</p>
              <p class="text-sm mt-2">DOCX is supported. This normally means the file row was not saved because of the legacy submission foreign key.</p>
              <button
                v-if="journeyAvailable"
                @click="openJourney"
                class="mt-4 rounded-xl bg-[#5c001f] px-4 py-2.5 font-bold text-white"
              >
                Open Journey to Upload Document
              </button>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="doc in project.documents"
                :key="doc.id"
                class="rounded-[18px] border border-[#e1d5cc] p-5 flex items-center justify-between gap-4 flex-wrap"
              >
                <div class="flex items-center gap-3">
                  <FileText class="w-6 h-6 text-[#5c001f]" />
                  <div>
                    <p class="font-bold">{{ doc.fileName }}</p>
                    <p class="text-sm text-gray-600">
                      {{ doc.type }} · Version {{ doc.version || 1 }} · {{ doc.status }} · {{ formatMalaysiaDate(doc.submittedAt) }}
                    </p>
                    <p class="text-xs text-gray-500 mt-1">{{ doc.mimeType || 'Document' }}</p>
                  </div>
                </div>
                <div class="flex gap-2">
                  <a
                    :href="fileUrl(projectId, doc.id)"
                    target="_blank"
                    rel="noopener"
                    class="inline-flex items-center gap-2 rounded-xl border border-[#5c001f] px-4 py-2 font-bold text-[#5c001f]"
                  >
                    <Eye class="w-4 h-4" /> View
                  </a>
                  <a
                    :href="fileUrl(projectId, doc.id, true)"
                    class="inline-flex items-center gap-2 rounded-xl bg-[#5c001f] px-4 py-2 font-bold text-white"
                  >
                    <Download class="w-4 h-4" /> Download
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
            <h2 class="text-[28px] font-bold mb-6">Status Timeline</h2>

            <div class="space-y-5">
              <div
                v-for="item in timeline"
                :key="item.label"
                class="flex items-start gap-4"
              >
                <div
                  :class="item.done ? 'bg-green-600 text-white' : 'bg-gray-300 text-white'"
                  class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                >
                  <CheckCircle2 v-if="item.done" class="w-5 h-5" />
                  <Clock v-else class="w-5 h-5" />
                </div>

                <div>
                  <p class="font-bold">{{ item.label }}</p>
                  <p class="text-sm text-gray-500">
                    {{ item.statusText }}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section v-if="resultReleased" id="results-feedback" class="bg-white rounded-[28px] p-7 shadow-lg border-2 border-green-300 scroll-mt-24">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p class="text-sm font-bold uppercase tracking-[0.18em] text-green-700">Released by coordinator</p>
                <h2 class="text-[30px] font-bold mt-1 flex items-center gap-2"><Award class="w-8 h-8 text-[#5c001f]" /> Results & Feedback</h2>
                <p class="text-gray-600 mt-1">Released {{ formatMalaysiaDate(project.resultReleasedAt) }}</p>
              </div>
              <div class="rounded-[20px] bg-[#5c001f] px-7 py-5 text-center text-white">
                <p class="text-sm text-white/70">Final score</p>
                <p class="text-4xl font-bold mt-1">{{ resultData?.project?.final_score ?? project.finalScore ?? '-' }}%</p>
                <p class="font-bold mt-1">Grade: {{ resultData?.project?.final_grade || project.finalGrade || 'Not configured' }}</p>
              </div>
            </div>

            <div v-if="resultLoading" class="py-10 text-center"><Loader2 class="w-8 h-8 mx-auto animate-spin text-[#5c001f]" /><p class="font-bold mt-2">Loading result breakdown...</p></div>
            <template v-else-if="resultData">
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-7">
                <article class="rounded-[20px] bg-[#f7f1ea] border border-[#e1d5cc] p-5">
                  <h3 class="text-xl font-bold">Supervisor assessment</h3>
                  <p class="text-3xl font-bold text-[#5c001f] mt-2">{{ resultData.supervisorAssessment?.percentage ?? '-' }}%</p>
                  <p class="text-sm text-gray-500 mt-1">Weight: {{ resultData.settings?.supervisor_weight ?? '-' }}%</p>
                  <p class="mt-4 whitespace-pre-line">{{ resultData.supervisorAssessment?.comments || 'No overall supervisor comment.' }}</p>
                </article>
                <article class="rounded-[20px] bg-[#f7f1ea] border border-[#e1d5cc] p-5">
                  <h3 class="text-xl font-bold">Examiner assessment</h3>
                  <p class="text-3xl font-bold text-[#5c001f] mt-2">{{ resultData.examinerEvaluation?.percentage ?? '-' }}%</p>
                  <p class="text-sm text-gray-500 mt-1">Weight: {{ resultData.settings?.examiner_weight ?? '-' }}%</p>
                  <p class="mt-4"><strong>Strengths:</strong> {{ resultData.examinerEvaluation?.strengths || '-' }}</p>
                  <p class="mt-2"><strong>Improvements:</strong> {{ resultData.examinerEvaluation?.improvements || '-' }}</p>
                  <p class="mt-2"><strong>Recommendations:</strong> {{ resultData.examinerEvaluation?.recommendations || '-' }}</p>
                  <p class="mt-2"><strong>Overall:</strong> {{ resultData.examinerEvaluation?.overall_comments || '-' }}</p>
                </article>
              </div>

              <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-7">
                <div>
                  <h3 class="text-xl font-bold">Supervisor rubric breakdown</h3>
                  <div class="overflow-x-auto rounded-[16px] border border-[#e1d5cc] mt-3">
                    <table class="w-full text-sm"><thead class="bg-[#f7f1ea]"><tr><th class="text-left p-3">Criterion</th><th>Score</th><th>Max</th></tr></thead><tbody><tr v-for="item in resultData.supervisorScores" :key="`s-${item.criterion}`" class="border-t"><td class="p-3"><p class="font-bold">{{ item.criterion }}</p><p v-if="item.comment" class="text-xs text-gray-500 mt-1">{{ item.comment }}</p></td><td class="text-center font-bold">{{ item.score }}</td><td class="text-center">{{ item.max_score }}</td></tr></tbody></table>
                  </div>
                </div>
                <div>
                  <h3 class="text-xl font-bold">Examiner rubric breakdown</h3>
                  <div class="overflow-x-auto rounded-[16px] border border-[#e1d5cc] mt-3">
                    <table class="w-full text-sm"><thead class="bg-[#f7f1ea]"><tr><th class="text-left p-3">Criterion</th><th>Score</th><th>Max</th></tr></thead><tbody><tr v-for="item in resultData.examinerScores" :key="`e-${item.criterion}`" class="border-t"><td class="p-3"><p class="font-bold">{{ item.criterion }}</p><p v-if="item.comment" class="text-xs text-gray-500 mt-1">{{ item.comment }}</p></td><td class="text-center font-bold">{{ item.score }}</td><td class="text-center">{{ item.max_score }}</td></tr></tbody></table>
                  </div>
                </div>
              </div>

              <div v-if="resultData.feedback?.length" class="mt-7">
                <h3 class="text-xl font-bold flex items-center gap-2"><MessageSquareText class="w-5 h-5 text-[#5c001f]" /> Feedback attachments</h3>
                <div class="space-y-3 mt-3">
                  <div v-for="item in resultData.feedback" :key="item.feedback_id" class="rounded-[16px] border border-[#e1d5cc] p-4">
                    <p class="font-bold">{{ item.author_role }} feedback</p><p class="mt-2 whitespace-pre-line">{{ item.comment }}</p>
                    <a v-if="item.attachment_path" :href="feedbackFileUrl(projectId, item.feedback_id, true)" class="inline-flex items-center gap-2 mt-3 font-bold text-[#5c001f]"><Download class="w-4 h-4" /> {{ item.attachment_name }}</a>
                  </div>
                </div>
              </div>
            </template>
          </section>

          <section class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
            <h2 class="text-[28px] font-bold mb-6">Assigned People</h2>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div class="rounded-[18px] border border-[#e1d5cc] p-5 flex gap-3">
                <UserCheck class="w-7 h-7 text-[#5c001f]" />
                <div>
                  <p class="text-sm font-bold text-gray-500">Supervisor</p>
                  <p class="font-bold mt-1">{{ project.supervisor || "Not Assigned" }}</p>
                  <p class="text-sm text-gray-600">{{ project.supervisorEmail || "-" }}</p>
                </div>
              </div>

              <div class="rounded-[18px] border border-[#e1d5cc] p-5 flex gap-3">
                <UserCheck class="w-7 h-7 text-[#5c001f]" />
                <div>
                  <p class="text-sm font-bold text-gray-500">Examiner</p>
                  <p class="font-bold mt-1">{{ project.examiner || "Not Assigned" }}</p>
                  <p class="text-sm text-gray-600">{{ project.examinerEmail || "-" }}</p>
                </div>
              </div>
            </div>
          </section>
        </template>
      </main>
    </div>

    <EmailActionConfirmModal
      :open="showRevisionConfirm"
      title="Submit revised proposal?"
      description="Your supervisor will receive an in-app notification that a new proposal version is ready for review."
      :recipient="project?.supervisorEmail || project?.supervisor || 'Assigned supervisor'"
      confirm-label="Submit revised proposal"
      :busy="revisionSubmitting"
      @cancel="showRevisionConfirm = false"
      @confirm="submitRevisedProposal"
    />
  </div>
</template>
