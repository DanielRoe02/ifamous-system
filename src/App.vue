<script setup>
import { onMounted } from 'vue'
import axios from 'axios'
import AIAssistantWidget from './components/AIAssistantWidget.vue'

onMounted(async () => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
    const response = await axios.get(`${apiUrl}/api/status`)
    if (response.data && response.data.message === 'connected') {
      console.log('connected')
    }
  } catch (error) {
    console.error('Failed to connect to backend:', error)
  }
})
</script>

<template>
  <router-view />
  <!-- Float the AI Assistant at the bottom right -->
  <AIAssistantWidget />
</template>
