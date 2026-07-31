<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  BookOpenCheck,
  Eye,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  RefreshCw,
} from "lucide-vue-next";
import AppHeader from "@/components/AppHeader.vue";
import RoleSidebar from "@/components/RoleSidebar.vue";
import { openSupervisorProject, supervisorProjectAction } from "@/utils/supervisorProjectNavigation";
import { formatMalaysiaDate } from "@/utils/dateTime";

const router = useRouter();

const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:3000";

const loading = ref(false);
const errorMessage = ref("");
const projects = ref([]);

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

function statusClass(status) {
  const value = String(status || "").toLowerCase();

  if (value.includes("assigned") || value.includes("approved")) {
    return "bg-green-100 text-green-700";
  }

  if (value.includes("pending")) {
    return "bg-yellow-100 text-yellow-700";
  }

  if (value.includes("rejected")) {
    return "bg-red-100 text-red-700";
  }

  return "bg-gray-100 text-gray-700";
}

async function loadProjects() {
  loading.value = true;
  errorMessage.value = "";

  try {
    const response = await fetch(`${API_BASE}/api/supervisor/projects`, {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load assigned projects.");
    }

    projects.value = data.projects || [];
  } catch (error) {
    errorMessage.value = error.message;
    projects.value = [];
  } finally {
    loading.value = false;
  }
}

function reviewProject(project) {
  openSupervisorProject(router, project);
}

function actionLabel(project) {
  return supervisorProjectAction(project).label;
}

onMounted(loadProjects);
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3] text-black font-['Inter']">
    <AppHeader />

    <div class="flex">
      <RoleSidebar role="Staff" />

      <main class="flex-1 p-8 space-y-7">
        <section class="rounded-[32px] bg-[#5c001f] text-white p-8 shadow-xl relative overflow-hidden">
          <div class="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[#f8be17]/20"></div>
          <p class="text-[#f8be17] font-bold uppercase tracking-[0.2em]">
            Assigned Projects
          </p>
          <h1 class="text-[36px] font-bold mt-2">Projects Assigned to Me</h1>
          <p class="text-white/80 mt-2">
            Review real assigned projects from the FYP database.
          </p>
        </section>

        <section class="bg-white rounded-[28px] p-7 shadow-lg border border-black/10">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-[28px] font-bold">Assigned Project List</h2>
              <p class="text-gray-600 mt-1">
                These projects are assigned to your supervisor account.
              </p>
            </div>

            <button
              @click="loadProjects"
              class="px-5 py-2.5 rounded-full bg-[#f7f1ea] text-[#5c001f] font-bold flex items-center gap-2 hover:bg-[#efe4d9]"
            >
              <RefreshCw class="w-5 h-5" />
              Refresh
            </button>
          </div>

          <div
            v-if="loading"
            class="rounded-[20px] border border-[#e1d5cc] p-8 text-center text-[#5c001f] font-bold"
          >
            <Loader2 class="w-6 h-6 mx-auto animate-spin mb-3" />
            Loading assigned projects...
          </div>

          <div
            v-else-if="errorMessage"
            class="rounded-[20px] border border-red-200 bg-red-50 text-red-700 p-6 font-bold"
          >
            {{ errorMessage }}
          </div>

          <div
            v-else-if="projects.length === 0"
            class="rounded-[20px] border border-[#e1d5cc] bg-[#f7f1ea] p-8 text-center"
          >
            <FileText class="w-14 h-14 mx-auto text-[#5c001f]" />
            <h3 class="font-bold text-xl mt-4">No assigned project found</h3>
            <p class="text-gray-600 mt-2">
              When a coordinator assigns a project to you, it will appear here.
            </p>
          </div>

          <div v-else class="overflow-x-auto rounded-[22px] border border-[#e1d5cc]">
            <table class="w-full text-sm">
              <thead class="bg-[#f7f1ea] text-left">
                <tr>
                  <th class="px-5 py-4">Student</th>
                  <th>Project Title</th>
                  <th>Status</th>
                  <th>Match Score</th>
                  <th>Last Updated</th>
                  <th class="text-right pr-5">Action</th>
                </tr>
              </thead>

              <tbody>
                <tr
                  v-for="project in projects"
                  :key="project.project_id"
                  class="border-t border-[#e1d5cc]"
                >
                  <td class="px-5 py-4 font-bold">
                    {{ project.studentName }}
                    <br />
                    <span class="text-xs text-gray-500 font-medium">{{ project.matricNo }}</span>
                  </td>

                  <td class="font-bold max-w-[320px]">
                    {{ project.projectTitle }}
                  </td>

                  <td>
                    <span
                      :class="statusClass(project.status)"
                      class="px-3 py-1 rounded-full font-bold text-xs"
                    >
                      {{ project.status }}
                    </span>
                  </td>

                  <td>
                    {{ project.matchScore ? project.matchScore + '%' : '-' }}
                  </td>

                  <td>{{ formatMalaysiaDate(project.lastUpdated) }}</td>

                  <td class="text-right pr-5">
                    <button
                      @click="reviewProject(project)"
                      class="bg-[#5c001f] text-white px-4 py-2 rounded-full font-bold inline-flex items-center gap-2"
                    >
                      <Eye class="w-4 h-4" />
                      {{ actionLabel(project) }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
