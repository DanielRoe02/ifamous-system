<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  AlertTriangle,
  BookOpenCheck,
  ChevronRight,
  CloudUpload,
  Eye,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Check,
  X,
} from "lucide-vue-next";
import AppHeader from "@/components/AppHeader.vue";
import RoleSidebar from "@/components/RoleSidebar.vue";
import { formatMalaysiaDate } from "@/utils/dateTime";

const router = useRouter();

const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:3000";

const mode = ref("records");
const loading = ref(false);
const submitting = ref(false);
const extracting = ref(false);
const matchingSupervisors = ref(false);
const matchError = ref("");
const supervisorRecommendations = ref([]);
const selectedNominees = ref([]);
const errorMessage = ref("");
const successMessage = ref("");
const isDragging = ref(false);
const fileInput = ref(null);
const selectedFile = ref(null);

const fypRecords = ref([]);

const form = ref({
  projectType: "Development",
  projectTitle: "",
  abstract: "",
  keywords: "",
});

const activeStatuses = [
  "Draft",
  "Pending Review",
  "Pending Coordinator Review",
  "Pending AI Matching",
  "Pending Supervisor Assignment",
  "Pending Supervisor Approval",
  "Revision Required",
  "Revised Proposal Submitted",
  "Active",
  "Development in Progress",
  "Final Deliverables Submitted",
  "Final Correction Required",
  "Awaiting Examiner Assignment",
  "Examiner Assigned",
  "Under Examination",
  "Grading Completed",
  "Result Pending Release",
];

const canCreateFyp = computed(() => {
  return !fypRecords.value.some((record) =>
    activeStatuses.includes(String(record.status || "").trim())
  );
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

function normalizeRecord(record) {
  return {
    id: record.id || record.project_id,
    project_id: record.project_id || record.id,
    title: record.title || record.project_title || "Untitled FYP",
    type: record.type || record.project_type || "Development",
    abstract: record.abstract || "",
    keywords: record.keywords || "",
    status: record.status || "Pending Review",
    supervisor: record.supervisor || record.supervisor_name || "Not Assigned",
    supervisorEmail: record.supervisorEmail || record.supervisor_email || "",
    examiner: record.examiner || record.examiner_name || "Not Assigned",
    examinerEmail: record.examinerEmail || record.examiner_email || "",
    lastUpdated: formatMalaysiaDate(record.lastUpdated || record.updated_at || record.created_at),
  };
}

async function loadMyFyp() {
  loading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const token = getAuthToken();

    const response = await fetch(`${API_BASE}/api/student/my-fyp`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load My FYP records");
    }

    fypRecords.value = (data.records || []).map(normalizeRecord);
  } catch (error) {
    errorMessage.value = error.message;
    fypRecords.value = [];
  } finally {
    loading.value = false;
  }
}

function startCreateFlow() {
  if (!canCreateFyp.value) return;

  form.value = {
    projectType: "Development",
    projectTitle: "",
    abstract: "",
    keywords: "",
  };

  selectedFile.value = null;
  supervisorRecommendations.value = [];
  selectedNominees.value = [];
  matchError.value = "";
  errorMessage.value = "";
  successMessage.value = "";
  mode.value = "upload";
}

function validateBasicInfo() {
  if (!form.value.projectTitle || form.value.projectTitle.trim().length < 3) {
    errorMessage.value = "Please enter a valid project title.";
    return false;
  }

  if (!form.value.abstract || form.value.abstract.trim().length < 10) {
    errorMessage.value = "Please enter a short description or abstract.";
    return false;
  }

  errorMessage.value = "";
  return true;
}

function goToUpload() {
  if (!validateBasicInfo()) return;
  mode.value = "upload";
}

function openFilePicker() {
  fileInput.value?.click();
}

function setSelectedFile(file) {
  if (!file) return;

  const allowedExtensions = [".pdf", ".doc", ".docx", ".txt"];
  const fileName = String(file.name || "").toLowerCase();
  const isAllowed = allowedExtensions.some((extension) =>
    fileName.endsWith(extension)
  );

  if (!isAllowed) {
    errorMessage.value = "Only .pdf, .doc, .docx, or .txt files are supported.";
    return;
  }

  selectedFile.value = file;
  errorMessage.value = "";
}

function handleUpload(event) {
  const file = event.target.files?.[0];
  setSelectedFile(file);
}

function handleDrop(event) {
  isDragging.value = false;
  const file = event.dataTransfer.files?.[0];
  setSelectedFile(file);
}

function removeFile() {
  selectedFile.value = null;

  if (fileInput.value) {
    fileInput.value.value = "";
  }
}

function isNomineeSelected(candidate) {
  return selectedNominees.value.some((item) => Number(item.user_id) === Number(candidate.user_id));
}

function toggleNominee(candidate) {
  const index = selectedNominees.value.findIndex((item) => Number(item.user_id) === Number(candidate.user_id));
  if (index >= 0) {
    selectedNominees.value.splice(index, 1);
    return;
  }
  if (selectedNominees.value.length >= 3) {
    matchError.value = "You can nominate up to three preferred supervisors.";
    return;
  }
  selectedNominees.value.push(candidate);
  matchError.value = "";
}

function moveNominee(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= selectedNominees.value.length) return;
  const next = [...selectedNominees.value];
  [next[index], next[target]] = [next[target], next[index]];
  selectedNominees.value = next;
}

function nomineeRank(candidate) {
  const index = selectedNominees.value.findIndex(
    (item) => Number(item.user_id) === Number(candidate.user_id)
  );
  return index >= 0 ? index + 1 : null;
}

async function runSupervisorMatch() {
  matchingSupervisors.value = true;
  matchError.value = "";
  try {
    const response = await fetch(`${API_BASE}/api/supervisor-matching/match`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectTitle: form.value.projectTitle,
        projectType: form.value.projectType,
        abstract: form.value.abstract,
        keywords: form.value.keywords,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Failed to find suitable supervisors.");
    }
    supervisorRecommendations.value = data.recommendations || [];
    selectedNominees.value = selectedNominees.value.filter((selected) =>
      supervisorRecommendations.value.some((item) => Number(item.user_id) === Number(selected.user_id))
    );
  } catch (error) {
    matchError.value = error.message || "AI supervisor matching failed.";
    supervisorRecommendations.value = [];
  } finally {
    matchingSupervisors.value = false;
  }
}

async function goToReview() {
  if (!selectedFile.value) {
    errorMessage.value = "Please upload your proposal document first.";
    return;
  }

  extracting.value = true;
  errorMessage.value = "";

  try {
    const uploadData = new FormData();
    uploadData.append("proposal", selectedFile.value);

    const response = await fetch(`${API_BASE}/api/student/extract-proposal`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: uploadData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "AI extraction failed.");
    }

    const extracted = data.extracted || {};

    form.value.projectTitle = extracted.projectTitle || "FYP Proposal";
    form.value.projectType = extracted.projectType || "Development";
    form.value.abstract = extracted.abstract || "";
    form.value.keywords = extracted.keywords || "";

    mode.value = "review";
    await runSupervisorMatch();
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    extracting.value = false;
  }
}

async function submitFypToDatabase() {
  submitting.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const token = getAuthToken();

    const submitData = new FormData();
    submitData.append("projectTitle", form.value.projectTitle);
    submitData.append("projectType", form.value.projectType);
    submitData.append("abstract", form.value.abstract);
    submitData.append("keywords", form.value.keywords || "");
    submitData.append(
      "supervisorNominations",
      JSON.stringify(selectedNominees.value.map((item, index) => ({
        supervisorUserId: item.user_id,
        preferenceRank: index + 1,
        note: `AI match ${item.score || 0}%: ${item.reason || "Student preference"}`,
      })))
    );

    if (selectedFile.value) {
      submitData.append("proposal", selectedFile.value);
    }

    const response = await fetch(`${API_BASE}/api/student/my-fyp-submit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: submitData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to submit FYP proposal.");
    }

    successMessage.value = data.message || "FYP proposal submitted successfully.";
    await loadMyFyp();
    selectedFile.value = null;
    mode.value = "records";
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    submitting.value = false;
  }
}

function viewRecord(record) {
  router.push({
    path: "/student-project-details",
    query: {
      projectId: record.project_id || record.id,
    },
  });
}

function statusClass(status) {
  const value = String(status || "").toLowerCase();

  if (value.includes("rejected")) {
    return "bg-red-100 text-red-700";
  }

  if (value.includes("active") || value.includes("approved")) {
    return "bg-green-100 text-green-700";
  }

  if (value.includes("revision")) {
    return "bg-orange-100 text-orange-700";
  }

  if (value.includes("pending") || value.includes("draft")) {
    return "bg-yellow-100 text-yellow-700";
  }

  return "bg-gray-100 text-gray-700";
}

onMounted(loadMyFyp);
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3] text-black font-['Inter']">
    <AppHeader />

    <div class="flex">
      <RoleSidebar role="Student" />

      <main class="flex-1 p-8 space-y-7">
        <section class="rounded-[32px] bg-[#5c001f] text-white p-8 shadow-xl relative overflow-hidden">
          <div class="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[#f8be17]/20"></div>
          <p class="text-[#f8be17] font-bold uppercase tracking-[0.2em]">
            Student Module
          </p>
          <h1 class="text-[36px] font-bold mt-2">My FYP</h1>
          <p class="text-white/80 mt-2">
            Create FYP only when you have no active or pending FYP. Rejected projects remain as history.
          </p>
        </section>

        <div
          v-if="errorMessage"
          class="rounded-[18px] border border-red-200 bg-red-50 text-red-700 px-5 py-4 font-semibold flex items-start gap-3"
        >
          <AlertTriangle class="w-5 h-5 shrink-0 mt-0.5" />
          <span>{{ errorMessage }}</span>
        </div>

        <div
          v-if="successMessage"
          class="rounded-[18px] border border-green-200 bg-green-50 text-green-700 px-5 py-4 font-semibold"
        >
          {{ successMessage }}
        </div>

        <section
          v-if="mode === 'records'"
          class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10"
        >
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
                FYP Records
              </p>
              <h2 class="text-[28px] font-bold mt-1">My FYP Attempts</h2>
              <p class="text-gray-600 mt-1">
                A student can only have one pending or active FYP at a time.
              </p>
            </div>

            <div class="flex gap-3">
              <button
                @click="loadMyFyp"
                class="px-4 py-3 rounded-full font-bold flex items-center gap-2 bg-[#f7f1ea] text-[#5c001f] hover:bg-[#efe4d9]"
              >
                <RefreshCw class="w-5 h-5" />
                Refresh
              </button>

              <button
                @click="startCreateFlow"
                :disabled="!canCreateFyp"
                :class="
                  canCreateFyp
                    ? 'bg-[#5c001f] text-white hover:bg-[#4a0019]'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                "
                class="px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-colors"
              >
                <Plus class="w-5 h-5" />
                Create FYP
              </button>
            </div>
          </div>

          <div
            v-if="!canCreateFyp"
            class="mb-6 rounded-[20px] bg-[#fff3c4] border border-[#f8be17] p-5 text-[#5c001f] flex gap-3"
          >
            <AlertTriangle class="w-6 h-6 shrink-0" />
            <div>
              <p class="font-bold">Create FYP is locked.</p>
              <p class="text-sm mt-1">
                You already have a pending or active FYP. Wait for review, approval, or final rejection before creating a new FYP proposal.
              </p>
            </div>
          </div>

          <div
            v-if="loading"
            class="rounded-[22px] border border-[#e1d5cc] p-8 text-center text-[#5c001f] font-bold flex items-center justify-center gap-3"
          >
            <Loader2 class="w-5 h-5 animate-spin" />
            Loading My FYP records...
          </div>

          <div
            v-else-if="fypRecords.length === 0"
            class="rounded-[22px] border border-[#e1d5cc] p-8 text-center"
          >
            <FolderKanban class="w-14 h-14 mx-auto text-[#5c001f]" />
            <h3 class="text-xl font-bold mt-4">No FYP record found</h3>
            <p class="text-gray-600 mt-2">
              You can create your first FYP proposal using the Create FYP button.
            </p>
          </div>

          <div
            v-else
            class="overflow-x-auto rounded-[22px] border border-[#e1d5cc]"
          >
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
                <tr
                  v-for="(record, index) in fypRecords"
                  :key="record.id"
                  class="border-t border-[#e1d5cc]"
                >
                  <td class="px-5 py-4 font-bold">{{ index + 1 }}</td>
                  <td class="font-bold max-w-[260px]">{{ record.title }}</td>
                  <td>{{ record.type }}</td>
                  <td>
                    <span
                      :class="statusClass(record.status)"
                      class="px-3 py-1 rounded-full font-bold text-xs"
                    >
                      {{ record.status }}
                    </span>
                  </td>
                  <td>{{ record.supervisor }}</td>
                  <td>{{ record.lastUpdated }}</td>
                  <td class="text-right pr-5">
                    <button
                      @click="viewRecord(record)"
                      class="inline-flex items-center gap-2 text-[#5c001f] font-bold"
                    >
                      <Eye class="w-4 h-4" />
                      View
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section v-if="mode === 'upload'"
          class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10"
        >
          <div class="flex items-center justify-between mb-6">
            <div>
              <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
                Upload Proposal
              </p>
              <h2 class="text-[28px] font-bold">
                Upload Proposal Document
              </h2>
            </div>

            <button
              @click="mode = 'records'"
              class="text-[#5c001f] font-bold"
            >
              Back
            </button>
          </div>

          <div
            class="rounded-[26px] border-2 border-dashed p-10 text-center transition-all duration-200"
            :class="
              isDragging
                ? 'border-[#5c001f] bg-[#fff3c4] scale-[1.01]'
                : 'border-[#d4bfae] bg-[#f7f1ea]'
            "
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
          >
            <CloudUpload class="w-16 h-16 mx-auto text-[#5c001f]" />
            <h2 class="text-2xl font-bold mt-4">Upload Proposal Document</h2>
            <p class="text-sm text-gray-600 mt-2">
              Supported: .pdf, .doc, .docx, .txt. Drag and drop your file here or choose manually.
            </p>

            <input
              ref="fileInput"
              class="hidden"
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              @change="handleUpload"
            />

            <button
              @click="openFilePicker"
              class="mt-6 bg-[#5c001f] text-white px-6 py-3 rounded-full font-bold"
            >
              Choose File
            </button>
          </div>

          <div
            v-if="selectedFile"
            class="mt-5 rounded-[20px] border border-[#e1d5cc] bg-[#f7f1ea] p-5 flex items-center justify-between"
          >
            <div class="flex items-center gap-3">
              <FileText class="w-8 h-8 text-[#5c001f]" />
              <div>
                <p class="font-bold">{{ selectedFile.name }}</p>
                <p class="text-sm text-gray-600">
                  {{ Math.round(selectedFile.size / 1024) }} KB
                </p>
              </div>
            </div>

            <button
              @click="removeFile"
              class="w-10 h-10 rounded-full bg-white text-[#5c001f] flex items-center justify-center"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="mt-7 flex justify-end">
            <button
              @click="goToReview"
              :disabled="extracting"
              class="bg-[#5c001f] text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 disabled:opacity-60"
            >
              <Loader2 v-if="extracting" class="w-5 h-5 animate-spin" />
              <ChevronRight v-else class="w-5 h-5" />
              {{ extracting ? "Extracting with AI..." : "Extract with AI" }}
            </button>
          </div>
        </section>

        <section
          v-if="mode === 'review'"
          class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10"
        >
          <div class="flex items-center justify-between mb-6">
            <div>
              <p class="text-sm font-bold text-[#5c001f] uppercase tracking-[0.18em]">
                Review Submission
              </p>
              <h2 class="text-[28px] font-bold">
                Review AI Extracted Proposal Details
              </h2>
            </div>

            <button
              @click="mode = 'upload'"
              class="text-[#5c001f] font-bold"
            >
              Back
            </button>
          </div>

          <div class="space-y-4">
            <div class="rounded-[18px] border border-[#e1d5cc] p-5">
              <p class="text-xs uppercase tracking-[0.18em] font-bold text-[#5c001f]">
                Project Title
              </p>
              <p class="text-xl font-bold mt-1">{{ form.projectTitle }}</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="rounded-[18px] border border-[#e1d5cc] p-5">
                <p class="text-xs uppercase tracking-[0.18em] font-bold text-[#5c001f]">
                  Project Type
                </p>
                <p class="font-bold mt-1">{{ form.projectType }}</p>
              </div>

              <div class="rounded-[18px] border border-[#e1d5cc] p-5">
                <p class="text-xs uppercase tracking-[0.18em] font-bold text-[#5c001f]">
                  Proposal File
                </p>
                <p class="font-bold mt-1">{{ selectedFile?.name || "-" }}</p>
              </div>
            </div>

            <div class="rounded-[18px] border border-[#e1d5cc] p-5">
              <p class="text-xs uppercase tracking-[0.18em] font-bold text-[#5c001f]">
                Short Description
              </p>
              <p class="mt-2 text-gray-700 whitespace-pre-line">{{ form.abstract }}</p>
            </div>

            <div class="rounded-[18px] border border-[#e1d5cc] p-5">
              <p class="text-xs uppercase tracking-[0.18em] font-bold text-[#5c001f]">
                Keywords
              </p>
              <p class="mt-2 text-gray-700">{{ form.keywords || "-" }}</p>
            </div>

            <div class="rounded-[22px] border border-[#e1d5cc] bg-[#f7f1ea] p-5">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-xs uppercase tracking-[0.18em] font-bold text-[#5c001f]">AI-assisted supervisor nomination</p>
                  <h3 class="text-xl font-bold mt-1">Choose up to three preferences</h3>
                  <p class="text-sm text-gray-600 mt-1">The AI can show up to ten eligible candidates. You may choose and rank a maximum of three preferences; the coordinator makes the final assignment.</p>
                </div>
                <button
                  @click="runSupervisorMatch"
                  :disabled="matchingSupervisors"
                  class="rounded-full bg-[#5c001f] px-5 py-2.5 font-bold text-white inline-flex items-center gap-2 disabled:opacity-60"
                >
                  <Loader2 v-if="matchingSupervisors" class="w-4 h-4 animate-spin" />
                  <Sparkles v-else class="w-4 h-4 text-[#f8be17]" />
                  {{ matchingSupervisors ? "Matching..." : "Run AI Matching" }}
                </button>
              </div>

              <p v-if="matchError" class="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm font-bold text-red-700">{{ matchError }}</p>

              <div v-if="supervisorRecommendations.length" class="mt-5">
                <p class="text-sm text-gray-600 mb-3">
                  Showing {{ supervisorRecommendations.length }} eligible candidate{{ supervisorRecommendations.length === 1 ? '' : 's' }}.
                  <span v-if="supervisorRecommendations.length < 4">Only this number of eligible supervisors is currently available.</span>
                </p>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <button
                  v-for="candidate in supervisorRecommendations"
                  :key="candidate.user_id"
                  type="button"
                  @click="toggleNominee(candidate)"
                  class="text-left rounded-[18px] border p-4 transition-all"
                  :class="isNomineeSelected(candidate) ? 'border-[#5c001f] bg-[#fff3c4] ring-2 ring-[#f8be17]' : 'border-[#d8c9bd] bg-white hover:border-[#5c001f]'"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="font-bold">{{ candidate.name }}</p>
                      <p class="text-xs text-gray-500 mt-1">{{ candidate.faculty || candidate.department || 'Supervisor' }}</p>
                    </div>
                    <div class="min-w-8 h-8 px-2 rounded-full flex items-center justify-center font-bold" :class="isNomineeSelected(candidate) ? 'bg-[#5c001f] text-white' : 'bg-[#f7f1ea] text-gray-400'">
                      <span v-if="nomineeRank(candidate)">#{{ nomineeRank(candidate) }}</span>
                      <Check v-else class="w-4 h-4" />
                    </div>
                  </div>
                  <p class="text-sm mt-3"><strong>{{ candidate.score }}% match</strong> · Workload {{ candidate.workload || `${candidate.currentCapacity || 0} / ${candidate.capacity || 5}` }}</p>
                  <p class="text-sm text-gray-600 mt-2 line-clamp-3">{{ candidate.expertise }}</p>
                  <p class="text-xs text-gray-500 mt-3">{{ candidate.reason }}</p>
                </button>
                </div>
              </div>

              <div v-if="selectedNominees.length" class="mt-5 rounded-[16px] bg-white border border-[#e1d5cc] p-4">
                <p class="font-bold text-[#5c001f]">Your ranked nominations</p>
                <div class="mt-3 space-y-2">
                  <div v-for="(candidate, index) in selectedNominees" :key="candidate.user_id" class="rounded-[14px] bg-[#f7f1ea] border border-[#e1d5cc] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <p class="font-bold">#{{ index + 1 }} {{ candidate.name }}</p>
                    <div class="flex gap-2">
                      <button type="button" @click="moveNominee(index, -1)" :disabled="index === 0" class="rounded-lg border px-3 py-1.5 font-bold disabled:opacity-30" title="Move preference up">↑</button>
                      <button type="button" @click="moveNominee(index, 1)" :disabled="index === selectedNominees.length - 1" class="rounded-lg border px-3 py-1.5 font-bold disabled:opacity-30" title="Move preference down">↓</button>
                      <button type="button" @click="toggleNominee(candidate)" class="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 font-bold" title="Remove nomination">Remove</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-7 flex justify-end">
            <button
              @click="submitFypToDatabase"
              :disabled="submitting"
              class="bg-[#5c001f] text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 disabled:opacity-60"
            >
              <Loader2 v-if="submitting" class="w-5 h-5 animate-spin" />
              <Send v-else class="w-5 h-5" />
              {{ submitting ? "Submitting..." : "Confirm & Submit" }}
            </button>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
