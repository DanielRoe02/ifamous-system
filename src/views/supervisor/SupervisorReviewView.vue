<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileText,
  Loader2,
  Paperclip,
  Send,
  XCircle,
} from "lucide-vue-next";
import AppHeader from "@/components/AppHeader.vue";
import RoleSidebar from "@/components/RoleSidebar.vue";
import EmailNotificationToggle from "@/components/EmailNotificationToggle.vue";
import { feedbackFileUrl, fileUrl } from "@/services/ifamousApi";
import { formatMalaysiaDateTime } from "@/utils/dateTime";

const route = useRoute();
const router = useRouter();

const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:3000";

const loading = ref(false);
const submitting = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const decisionSubmitted = ref(false);
const submittedDecision = ref("");
const project = ref(null);
const feedback = ref("");
const pendingDecision = ref(null);
const correctionFile = ref(null);
const sendEmailNotification = ref(true);

const projectStatus = computed(() => String(project.value?.status || "").trim());
const isReadOnlyDecision = computed(() => projectStatus.value === "Rejected");
const isWaitingRevision = computed(() => projectStatus.value === "Revision Required");
const isRevisedSubmission = computed(() => projectStatus.value === "Revised Proposal Submitted");
const canMakeDecision = computed(() => !isReadOnlyDecision.value && !isWaitingRevision.value);

const decisionLabels = {
  approve: "Approve Proposal",
  revision: "Request Revision",
  reject: "Reject Proposal",
};

const decisionStatusMap = {
  approve: "Active",
  revision: "Revision Required",
  reject: "Rejected",
};

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

function getProjectId() {
  return route.query.projectId || route.params.projectId || "";
}

async function loadProject() {
  const projectId = getProjectId();

  if (!projectId) {
    errorMessage.value = "Missing project ID.";
    return;
  }

  loading.value = true;
  errorMessage.value = "";

  try {
    const response = await fetch(`${API_BASE}/api/supervisor/review/${projectId}`, {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load project.");
    }

    project.value = data.project;

    const reviewStatuses = new Set([
      "Assigned",
      "Pending Supervisor Approval",
      "Pending Review",
      "Revision Required",
      "Revised Proposal Submitted",
      "Rejected",
    ]);
    if (!reviewStatuses.has(String(project.value?.status || ""))) {
      router.replace({ path: "/project-journey", query: { projectId } });
      return;
    }

    feedback.value = "";
    correctionFile.value = null;
    decisionSubmitted.value = false;
    submittedDecision.value = "";
    pendingDecision.value = null;
  } catch (error) {
    errorMessage.value = error.message;
    project.value = null;
  } finally {
    loading.value = false;
  }
}

function openDecisionConfirm(decision) {
  sendEmailNotification.value = true;
  pendingDecision.value = decision;
}

function closeDecisionConfirm() {
  if (!submitting.value) {
    pendingDecision.value = null;
  }
}

async function submitDecision(decision) {
  if (!project.value) return;

  submitting.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const formData = new FormData();
    formData.append("decision", decision);
    formData.append("feedback", feedback.value || "");
    formData.append("sendEmail", String(sendEmailNotification.value));
    if (correctionFile.value) {
      formData.append("attachment", correctionFile.value);
    }

    const response = await fetch(
      `${API_BASE}/api/supervisor/review/${project.value.project_id}/decision`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to submit decision.");
    }

    submittedDecision.value = decision;
    decisionSubmitted.value = true;
    pendingDecision.value = null;
    successMessage.value = data.message || "Decision submitted.";

    // reload project data after decision
    await loadProject();

    // keep success screen visible after reload
    submittedDecision.value = decision;
    decisionSubmitted.value = true;
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    submitting.value = false;
  }
}

function previewDocument(doc) {
  if (!project.value || !doc?.submission_id) return;
  window.open(fileUrl(project.value.project_id, doc.submission_id), "_blank", "noopener");
}

function downloadDocument(doc) {
  if (!project.value || !doc?.submission_id) return;
  window.open(fileUrl(project.value.project_id, doc.submission_id, true), "_blank", "noopener");
}

onMounted(loadProject);
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3] text-black font-['Inter']">
    <AppHeader />

    <div class="flex">
      <RoleSidebar role="Staff" />
      <main class="flex-1 max-w-6xl mx-auto p-8 space-y-7 min-w-0">
      <button
        @click="router.push('/supervisor-projects')"
        class="inline-flex items-center gap-2 text-[#5c001f] font-bold"
      >
        <ArrowLeft class="w-5 h-5" />
        Back to Assigned Projects
      </button>

      <section class="rounded-[32px] bg-[#5c001f] text-white p-8 shadow-xl">
        <p class="text-[#f8be17] font-bold uppercase tracking-[0.2em]">
          Review & Decision
        </p>
        <h1 class="text-[34px] font-bold mt-2">
          {{ project?.title || "Project Review" }}
        </h1>
        <p class="text-white/80 mt-2">
          <span v-if="isWaitingRevision">Revision requested. Monitor the feedback sent and wait for the student to upload a new proposal version.</span>
          <span v-else-if="isRevisedSubmission">A revised proposal version is ready. Review the newest document before making another decision.</span>
          <span v-else-if="isReadOnlyDecision">Read-only decision history for this rejected proposal.</span>
          <span v-else>Review the assigned proposal and submit an approval, revision, or rejection decision.</span>
        </p>
      </section>

      <section
        v-if="loading"
        class="bg-white rounded-[28px] p-10 shadow-lg text-center"
      >
        <Loader2 class="w-8 h-8 mx-auto text-[#5c001f] animate-spin" />
        <p class="font-bold text-[#5c001f] mt-3">Loading project review...</p>
      </section>

      <section
        v-else-if="errorMessage"
        class="bg-red-50 border border-red-200 rounded-[24px] p-6 text-red-700 font-bold"
      >
        {{ errorMessage }}
      </section>

      <section
        v-if="decisionSubmitted"
        class="bg-white rounded-[28px] p-10 shadow-lg border border-black/10 text-center"
      >
        <div class="mx-auto w-24 h-24 rounded-full bg-green-100 border border-green-200 flex items-center justify-center">
          <CheckCircle2 class="w-14 h-14 text-green-700" />
        </div>

        <h2 class="text-[30px] font-bold text-[#5c001f] mt-6">
          Supervisor Decision Submitted Successfully!
        </h2>
        <p class="text-gray-600 mt-3 max-w-2xl mx-auto">
          The review decision has been saved into Aiven MySQL. Notification records have also been created for the student and coordinator.
        </p>

        <div class="mt-7 mx-auto max-w-2xl rounded-[22px] bg-[#f7f1ea] border border-[#e1d5cc] p-6 text-left">
          <p class="text-sm font-bold uppercase tracking-[0.18em] text-[#5c001f]">Decision Summary</p>
          <div class="mt-4 space-y-2 text-sm">
            <p><b>Project:</b> {{ project?.title }}</p>
            <p><b>Decision:</b> {{ decisionLabels[submittedDecision] }}</p>
            <p><b>Status:</b> {{ project?.status || decisionStatusMap[submittedDecision] }}</p>
            <p><b>Feedback:</b> {{ feedback || 'No feedback provided.' }}</p>
            <p><b>Correction attachment:</b> {{ correctionFile?.name || 'None' }}</p>
          </div>
        </div>

        <div class="mt-7 flex flex-wrap justify-center gap-3">
          <button
            @click="router.push('/supervisor-projects')"
            class="bg-[#5c001f] text-white px-6 py-3 rounded-full font-bold"
          >
            View Updated Project List
          </button>
          <button
            @click="router.push('/supervisor-dashboard')"
            class="bg-[#e1d5cc] text-[#5c001f] px-6 py-3 rounded-full font-bold"
          >
            Back to Dashboard
          </button>
        </div>
      </section>

      <div v-else-if="project" class="grid grid-cols-1 xl:grid-cols-3 gap-7">
        <section class="xl:col-span-2 bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
          <h2 class="text-[28px] font-bold mb-5">Proposal Document</h2>

          <div class="rounded-[20px] bg-[#f7f1ea] border border-[#e1d5cc] p-5">
            <div v-if="project.documents && project.documents.length > 0" class="space-y-3">
              <div
                v-for="doc in project.documents"
                :key="doc.submission_id"
                class="bg-white rounded-[16px] p-4 flex items-center justify-between gap-4"
              >
                <div class="flex items-center gap-3">
                  <FileText class="w-6 h-6 text-[#5c001f]" />
                  <div>
                    <p class="font-bold">{{ doc.fileName }}</p>
                    <p class="text-sm text-gray-600">
                      {{ doc.type }} · Version {{ doc.version || 1 }} · {{ doc.status }}
                    </p>
                    <p class="text-xs text-gray-500 mt-1">Submitted {{ formatMalaysiaDateTime(doc.submittedAt, { includeYear: true }) }}</p>
                  </div>
                </div>

                <div class="flex gap-2">
                  <button
                    @click="previewDocument(doc)"
                    class="border border-[#5c001f] text-[#5c001f] px-4 py-2 rounded-full font-bold flex items-center gap-2"
                  >
                    <Eye class="w-4 h-4" />
                    View
                  </button>
                  <button
                    @click="downloadDocument(doc)"
                    class="bg-[#5c001f] text-white px-4 py-2 rounded-full font-bold flex items-center gap-2"
                  >
                    <Download class="w-4 h-4" />
                    Download
                  </button>
                </div>
              </div>
            </div>

            <div v-else class="bg-white rounded-[16px] p-4 text-gray-600">
              No proposal document found for this project.
            </div>

            <div class="mt-5 bg-white rounded-[16px] p-4">
              <p class="text-sm font-bold text-[#5c001f]">Student</p>
              <p class="font-bold mt-1">{{ project.studentName }} · {{ project.matricNo }}</p>
            </div>

            <div class="mt-5 bg-white rounded-[16px] p-4">
              <p class="text-sm font-bold text-[#5c001f]">Abstract Preview</p>
              <p class="mt-2 text-gray-700 leading-relaxed whitespace-pre-line">
                {{ project.abstract || "No abstract available." }}
              </p>
            </div>

            <div class="mt-5 bg-white rounded-[16px] p-4">
              <p class="text-sm font-bold text-[#5c001f]">Keywords</p>
              <p class="mt-2 text-gray-700">
                {{ project.keywords || "-" }}
              </p>
            </div>
          </div>

          <div v-if="project.feedback?.length" class="mt-6 rounded-[20px] border border-[#e1d5cc] bg-white p-5">
            <h3 class="text-xl font-bold flex items-center gap-2"><Paperclip class="w-5 h-5 text-[#5c001f]" /> Revision feedback history</h3>
            <div class="mt-4 space-y-3">
              <article v-for="item in project.feedback" :key="item.feedback_id" class="rounded-[16px] bg-[#f7f1ea] border border-[#e1d5cc] p-4">
                <div class="flex flex-wrap justify-between gap-2">
                  <p class="font-bold">Supervisor feedback</p>
                  <p class="text-xs text-gray-500">{{ formatMalaysiaDateTime(item.created_at, { includeYear: true }) }}</p>
                </div>
                <p class="mt-2 whitespace-pre-line">{{ item.comment || 'No written comment.' }}</p>
                <a v-if="item.attachment_path" :href="feedbackFileUrl(project.project_id, item.feedback_id, true)" class="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#5c001f] px-4 py-2 font-bold text-white">
                  <Download class="w-4 h-4" /> {{ item.attachment_name || 'Download correction attachment' }}
                </a>
              </article>
            </div>
          </div>

          <div v-if="isReadOnlyDecision" class="mt-6 rounded-[18px] border border-red-200 bg-red-50 p-5 text-red-800">
            <p class="font-bold">Rejected proposal — read-only history</p>
            <p class="text-sm mt-1">This proposal cannot enter the development journey or receive another decision. The existing document and feedback remain available for reference.</p>
          </div>

          <div v-else-if="isWaitingRevision" class="mt-6 rounded-[18px] border border-amber-300 bg-amber-50 p-5 text-amber-900">
            <div class="flex items-start gap-3">
              <Clock3 class="w-6 h-6 shrink-0" />
              <div>
                <p class="font-bold text-lg">Waiting for student revision</p>
                <p class="text-sm mt-1">The revision request has already been sent. Another supervisor decision is disabled until the student uploads a revised proposal version.</p>
                <p class="text-sm mt-2">When the student resubmits, the status will change to <b>Revised Proposal Submitted</b> and this page will enable the decision buttons again.</p>
              </div>
            </div>
          </div>

          <div v-else class="mt-6">
            <div v-if="isRevisedSubmission" class="mb-5 rounded-[18px] border border-green-200 bg-green-50 p-5 text-green-800">
              <p class="font-bold">Revised proposal received</p>
              <p class="text-sm mt-1">Review the newest proposal version at the top of the document list. You may approve it, request another revision, or reject it.</p>
            </div>
            <label class="block font-bold mb-2">Comments / Feedback</label>
            <textarea
              v-model="feedback"
              rows="6"
              class="w-full rounded-[16px] border border-[#d8c9bd] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#f8be17]"
              placeholder="Write feedback for the student..."
            ></textarea>
            <label class="block font-bold mt-4 mb-2">Correction attachment (optional)</label>
            <input
              type="file"
              @change="correctionFile = $event.target.files?.[0] || null"
              class="w-full rounded-[16px] border border-[#d8c9bd] bg-white px-4 py-3"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt"
            />
            <p v-if="correctionFile" class="text-sm text-gray-600 mt-2">
              Selected: {{ correctionFile.name }}
            </p>
          </div>

          <div v-if="canMakeDecision" class="mt-6 flex flex-wrap gap-3">
            <button
              @click="openDecisionConfirm('approve')"
              :disabled="submitting"
              class="bg-green-600 text-white px-5 py-3 rounded-full font-bold flex items-center gap-2 disabled:opacity-60"
            >
              <CheckCircle2 class="w-5 h-5" />
              Approve
            </button>

            <button
              @click="openDecisionConfirm('revision')"
              :disabled="submitting"
              class="bg-[#f8be17] text-[#5c001f] px-5 py-3 rounded-full font-bold flex items-center gap-2 disabled:opacity-60"
            >
              <Send class="w-5 h-5" />
              Request Revision
            </button>

            <button
              @click="openDecisionConfirm('reject')"
              :disabled="submitting"
              class="bg-red-600 text-white px-5 py-3 rounded-full font-bold flex items-center gap-2 disabled:opacity-60"
            >
              <XCircle class="w-5 h-5" />
              Reject
            </button>
          </div>
        </section>

        <aside class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10 h-fit">
          <h2 class="text-xl font-bold mb-5">Decision Status</h2>

          <div
            v-if="successMessage"
            class="rounded-[18px] bg-green-50 border border-green-200 text-green-700 p-5 font-bold"
          >
            {{ successMessage }}
          </div>

          <div
            v-else
            class="rounded-[18px] bg-[#fff3c4] border border-[#f8be17] text-[#5c001f] p-5"
          >
            <p class="font-bold">Current status</p>
            <p class="mt-2">{{ project.status }}</p>
          </div>

          <div class="mt-5 rounded-[18px] bg-[#f7f1ea] border border-[#e1d5cc] p-5">
            <p class="font-bold text-[#5c001f]">Match Score</p>
            <p class="text-2xl font-bold mt-2">
              {{ project.matchScore ? project.matchScore + '%' : '-' }}
            </p>
          </div>
        </aside>
      </div>

      <div
        v-if="pendingDecision"
        class="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
      >
        <div class="bg-white rounded-[28px] shadow-2xl max-w-2xl w-full overflow-hidden border border-[#e1d5cc]">
          <div class="bg-[#5c001f] text-white p-6 flex items-center justify-between">
            <div>
              <p class="text-[#f8be17] font-bold uppercase tracking-[0.18em] text-sm">Supervisor Decision</p>
              <h2 class="text-[28px] font-bold mt-1">Confirm Decision</h2>
            </div>
            <button
              @click="closeDecisionConfirm"
              class="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl"
            >
              ×
            </button>
          </div>

          <div class="p-7 space-y-5">
            <div class="rounded-[22px] bg-[#f7f1ea] border border-[#e1d5cc] p-5">
              <p class="text-sm font-bold uppercase tracking-[0.15em] text-[#5c001f]">Student & Project</p>
              <div class="mt-4 space-y-2 text-sm">
                <p><b>Project Title:</b> {{ project?.title }}</p>
                <p><b>Student:</b> {{ project?.studentName }} · {{ project?.matricNo }}</p>
                <p><b>Current Status:</b> {{ project?.status }}</p>
              </div>
            </div>

            <div
              class="rounded-[22px] border p-5"
              :class="pendingDecision === 'approve' ? 'bg-green-50 border-green-200' : pendingDecision === 'reject' ? 'bg-red-50 border-red-200' : 'bg-[#fff3c4] border-[#f8be17]'"
            >
              <p class="text-sm font-bold uppercase tracking-[0.15em] text-[#5c001f]">Selected Decision</p>
              <h3 class="text-2xl font-bold text-[#5c001f] mt-3">
                {{ decisionLabels[pendingDecision] }}
              </h3>
              <p class="text-sm mt-2">
                New project status will become: <b>{{ decisionStatusMap[pendingDecision] }}</b>
              </p>
              <p class="text-sm mt-2">
                Student and coordinator will receive notification after confirmation.
              </p>
              <p v-if="correctionFile" class="text-sm mt-2 font-bold">
                Attachment: {{ correctionFile.name }}
              </p>
            </div>

            <EmailNotificationToggle v-model="sendEmailNotification" />

            <div class="flex flex-wrap justify-end gap-3 pt-2">
              <button
                @click="closeDecisionConfirm"
                class="bg-[#e1d5cc] text-[#5c001f] px-6 py-3 rounded-full font-bold"
                :disabled="submitting"
              >
                Cancel
              </button>
              <button
                @click="submitDecision(pendingDecision)"
                class="bg-[#5c001f] text-white px-6 py-3 rounded-full font-bold disabled:opacity-60"
                :disabled="submitting"
              >
                {{ submitting ? 'Submitting...' : 'Confirm Decision' }}
              </button>
            </div>
          </div>
        </div>
      </div>
      </main>
    </div>
  </div>
</template>
