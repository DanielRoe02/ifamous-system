<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  UserCheck,
} from "lucide-vue-next";
import AppHeader from "@/components/AppHeader.vue";

const route = useRoute();
const router = useRouter();

const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:3000";

const loading = ref(false);
const errorMessage = ref("");
const project = ref(null);

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

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

function getWorkflowStep(status) {
  const value = String(status || "").toLowerCase();

  if (value.includes("rejected")) return 0;
  if (value.includes("revision")) return 2;
  if (value.includes("active") || value.includes("approved")) return 5;
  if (value.includes("supervisor approval") || value.includes("assigned")) return 5;
  if (value.includes("supervisor assignment")) return 4;
  if (value.includes("ai matching")) return 3;
  if (value.includes("coordinator review") || value.includes("pending review")) return 2;
  if (value.includes("draft")) return 1;

  return 1;
}

const timeline = computed(() => {
  const status = project.value?.status || "";
  const currentStep = getWorkflowStep(status);

  const steps = [
    {
      step: 1,
      label: "Proposal Submitted",
      waitingText: "Waiting for submission",
    },
    {
      step: 2,
      label: "Coordinator Review",
      waitingText: "Waiting for coordinator review",
    },
    {
      step: 3,
      label: "AI Matching",
      waitingText: "Waiting for AI supervisor matching",
    },
    {
      step: 4,
      label: "Supervisor Assignment",
      waitingText: "Waiting for supervisor assignment",
    },
    {
      step: 5,
      label: "Supervisor Approval",
      waitingText: "Waiting for supervisor approval",
    },
  ];

  return steps.map((item) => {
    const done = currentStep >= item.step;
    const current = currentStep === item.step;

    return {
      ...item,
      done,
      current,
      statusText: done
        ? current
          ? "In progress"
          : "Completed"
        : item.waitingText,
    };
  });
});

onMounted(loadProjectDetails);
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3] text-black font-['Inter']">
    <AppHeader />

    <div class="flex">
      <aside class="w-[240px] bg-[#f7f1ea] border-r border-[#d8c9bd] min-h-[calc(100vh-70px)] p-4">
        <div class="bg-white/80 border border-[#e1d5cc] rounded-[18px] p-4 mb-4">
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5c001f]">
            Student
          </p>
          <p class="text-sm text-gray-600 mt-1">FYP Workspace</p>
        </div>

        <nav class="space-y-2">
          <button
            @click="router.push('/student-dashboard')"
            class="w-full hover:bg-white text-[#2b1b1b] rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold"
          >
            <LayoutDashboard class="w-5 h-5 text-[#5c001f]" />
            Dashboard
          </button>

          <button
            @click="router.push('/student-my-fyp')"
            class="w-full bg-[#5c001f] text-white rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold"
          >
            <FolderKanban class="w-5 h-5 text-[#f8be17]" />
            My FYP
          </button>

          <button
            @click="router.push('/student-logbook')"
            class="w-full hover:bg-white text-[#2b1b1b] rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold"
          >
            <BookOpenCheck class="w-5 h-5 text-[#5c001f]" />
            Logbook
          </button>
        </nav>
      </aside>

      <main class="flex-1 p-8 space-y-7">
        <button
          @click="router.push('/student-my-fyp')"
          class="inline-flex items-center gap-2 text-[#5c001f] font-bold"
        >
          <ArrowLeft class="w-5 h-5" />
          Back to My FYP
        </button>

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
                <p class="mt-2 font-bold">{{ formatDate(project.createdAt) }}</p>
              </div>

              <div class="rounded-[18px] border border-[#e1d5cc] p-5">
                <p class="text-sm font-bold text-[#5c001f]">Last Updated</p>
                <p class="mt-2 font-bold">{{ formatDate(project.updatedAt) }}</p>
              </div>
            </div>
          </section>

          <section class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
            <h2 class="text-[28px] font-bold mb-6">Documents</h2>

            <div
              v-if="!project.documents || project.documents.length === 0"
              class="rounded-[18px] border border-[#e1d5cc] bg-[#f7f1ea] p-6 text-gray-600"
            >
              No submitted documents found for this project.
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="doc in project.documents"
                :key="doc.id"
                class="rounded-[18px] border border-[#e1d5cc] p-5 flex items-center justify-between"
              >
                <div class="flex items-center gap-3">
                  <FileText class="w-6 h-6 text-[#5c001f]" />
                  <div>
                    <p class="font-bold">{{ doc.fileName }}</p>
                    <p class="text-sm text-gray-600">
                      {{ doc.type }} · {{ doc.status }} · {{ formatDate(doc.submittedAt) }}
                    </p>
                  </div>
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
  </div>
</template>
