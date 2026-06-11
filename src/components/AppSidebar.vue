<script setup>
import { useRouter, useRoute } from 'vue-router'
import NavigationButton from './NavigationButton.vue'

const router = useRouter()
const route = useRoute()

const isActive = (path) => {
  return route.path.startsWith(path)
}
</script>

<template>
  <aside
    class="w-[280px] bg-[#e9e9e9] shrink-0 flex flex-col py-[25px] gap-2 border-r border-gray-300"
  >
    <NavigationButton
      linkName="Dashboard"
      :active="isActive('/dashboard')"
      @click="router.push('/dashboard')"
    />
    <NavigationButton
      linkName="Manage Session"
      :active="isActive('/manage-session')"
      @click="router.push('/manage-session')"
    />
    <NavigationButton
      linkName="View Calendar"
      :active="isActive('/calendar')"
      @click="router.push('/calendar')"
    />
    <NavigationButton
      linkName="Add Time Table"
      :active="isActive('/add-time-table')"
      @click="router.push('/add-time-table')"
    />
    <NavigationButton
      linkName="Manage User"
      :active="isActive('/manage-user')"
      @click="router.push('/manage-user')"
    />
    <NavigationButton linkName="Manage FYP" />
    <NavigationButton linkName="Export" />
    <NavigationButton linkName="Import" />
  </aside>
</template>
