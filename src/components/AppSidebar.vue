<script setup>
import { useRouter, useRoute } from 'vue-router'
import {
  LayoutDashboard,
  CalendarClock,
  CalendarDays,
  Table2,
  Users,
  FolderKanban,
  FileDown,
  FileUp,
  Sparkles,
  UserRoundCheck,
  Settings,
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()

const isActive = (path) => {
  return route.path.startsWith(path)
}

const navItems = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    enabled: true,
  },
  {
    label: 'Manage Session',
    path: '/manage-session',
    icon: CalendarClock,
    enabled: true,
  },
  {
    label: 'View Calendar',
    path: '/calendar',
    icon: CalendarDays,
    enabled: true,
  },
  {
    label: 'Add Time Table',
    path: '/add-time-table',
    icon: Table2,
    enabled: true,
  },
  {
    label: 'Manage User',
    path: '/manage-user',
    icon: Users,
    enabled: true,
  },
  {
    label: 'Manage FYP',
    path: '/manage-fyp',
    icon: FolderKanban,
    enabled: true,
  },
  {
    label: 'Assign Examiner',
    path: '/examiner-assignment',
    icon: UserRoundCheck,
    enabled: true,
  },
  {
    label: 'AI Assistant',
    path: '/dashboard',
    icon: Sparkles,
    enabled: false,
  },
  {
    label: 'Export',
    path: '/export',
    icon: FileDown,
    enabled: false,
  },
  {
    label: 'Import',
    path: '/import',
    icon: FileUp,
    enabled: false,
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    enabled: false,
  },
]

const navigateTo = (item) => {
  if (!item.enabled) return
  router.push(item.path)
}
</script>

<template>
  <aside
    class="w-[240px] bg-[#f7f1ea] shrink-0 flex flex-col border-r border-[#d8c9bd] shadow-sm"
  >
    <!-- Sidebar top spacing -->
    <div class="px-4 py-5">
      <div class="bg-white/70 border border-[#e1d5cc] rounded-[18px] p-4">
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5c001f]">
          Coordinator
        </p>
        <p class="text-sm text-gray-600 mt-1">Control Panel</p>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-3 pb-5 space-y-1">
      <button
        v-for="item in navItems"
        :key="item.label"
        type="button"
        @click="navigateTo(item)"
        :class="[
          'w-full flex items-center gap-3 px-4 py-3 rounded-[14px] text-left transition-all duration-200 group',
          item.enabled
            ? 'cursor-pointer'
            : 'cursor-not-allowed opacity-60',
          isActive(item.path) && item.enabled
            ? 'bg-[#5c001f] text-white shadow-md'
            : 'text-[#2b1b1b] hover:bg-white hover:shadow-sm',
        ]"
      >
        <span
          :class="[
            'w-9 h-9 rounded-[12px] flex items-center justify-center transition-colors',
            isActive(item.path) && item.enabled
              ? 'bg-[#f8be17] text-[#5c001f]'
              : 'bg-[#eadfd7] text-[#5c001f] group-hover:bg-[#f8be17]',
          ]"
        >
          <component :is="item.icon" class="w-5 h-5" />
        </span>

        <span class="font-bold text-[15px]">
          {{ item.label }}
        </span>
      </button>
    </nav>

    <!-- Sidebar Footer -->
    <div class="px-4 pb-5">
      <div class="rounded-[18px] bg-[#5c001f] p-4 text-white">
        <div class="flex items-center gap-2">
          <Sparkles class="w-5 h-5 text-[#f8be17]" />
          <p class="font-bold text-sm">AI Ready</p>
        </div>
        <p class="text-xs text-white/70 mt-2">
          Supervisor and examiner AI matching are available.
        </p>
      </div>
    </div>
  </aside>
</template>
