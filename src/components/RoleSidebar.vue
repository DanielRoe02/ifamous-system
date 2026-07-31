<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  LayoutDashboard,
  FolderKanban,
  ClipboardCheck,
  BookOpenCheck,
  UsersRound,
  Route,
  Bell,
} from 'lucide-vue-next'
import { roleFlags } from '@/services/ifamousApi'

const props = defineProps({
  role: { type: String, default: '' },
})
const route = useRoute()
const router = useRouter()
const roles = roleFlags()

const activeRole = computed(() => {
  if (props.role) return props.role
  if (roles.isCoordinator) return 'Coordinator'
  if (roles.isStudent) return 'Student'
  if (roles.isSupervisor || roles.isExaminer) return 'Staff'
  return 'User'
})

const items = computed(() => {
  if (activeRole.value === 'Coordinator') {
    return [
      ['Dashboard', '/dashboard', LayoutDashboard],
      ['Manage FYP', '/manage-fyp', FolderKanban],
      ['Examiner Assignment', '/examiner-assignment', UsersRound],
    ]
  }
  if (activeRole.value === 'Student') {
    return [
      ['Dashboard', '/student-dashboard', LayoutDashboard],
      ['My FYP', '/student-fyp', FolderKanban],
      ['FYP Journey', '/project-journey', Route],
      ['Logbook', '/student-logbook', BookOpenCheck],
    ]
  }
  return [
    ['Dashboard', '/supervisor-dashboard', LayoutDashboard],
    ['Assigned FYP', '/supervisor-projects', FolderKanban],
    ['Assigned Grading FYP', '/examiner-projects', ClipboardCheck],
    ['Logbook', '/supervisor-logbook', BookOpenCheck],
  ].filter(([label]) => label !== 'Assigned Grading FYP' || roles.isExaminer)
})
</script>

<template>
  <aside class="w-[250px] bg-[#f7f1ea] shrink-0 border-r border-[#d8c9bd] min-h-[calc(100vh-70px)] p-4">
    <div class="bg-white/80 border border-[#e1d5cc] rounded-[18px] p-4 mb-5">
      <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5c001f]">{{ activeRole }}</p>
      <p class="text-sm text-gray-600 mt-1">I-FAMOUS Workspace</p>
    </div>

    <nav class="space-y-2">
      <button
        v-for="([label, path, icon]) in items"
        :key="path"
        type="button"
        @click="router.push(path)"
        :class="[
          'w-full rounded-[14px] px-4 py-3 flex items-center gap-3 font-bold text-left transition',
          route.path.startsWith(path)
            ? 'bg-[#5c001f] text-white shadow-md'
            : 'text-[#2b1b1b] hover:bg-white',
        ]"
      >
        <component :is="icon" class="w-5 h-5" :class="route.path.startsWith(path) ? 'text-[#f8be17]' : 'text-[#5c001f]'" />
        {{ label }}
      </button>
    </nav>

    <div class="mt-8 rounded-[18px] bg-[#5c001f] p-4 text-white">
      <div class="flex items-center gap-2">
        <Bell class="w-5 h-5 text-[#f8be17]" />
        <p class="font-bold text-sm">Assignment protected</p>
      </div>
      <p class="text-xs text-white/70 mt-2">
        Projects are visible only to the student, assigned supervisor, assigned examiner and coordinator.
      </p>
    </div>
  </aside>
</template>
