<script setup>
import { ref } from 'vue'

const emit = defineEmits(['close', 'create'])
const sessionNumber = ref('')
const isLoading = ref(false)
const error = ref('')

const handleCreate = async () => {
  if (!sessionNumber.value) {
    error.value = 'Please enter a session number'
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
    const res = await fetch(`${apiUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: parseInt(sessionNumber.value, 10) }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to create session')

    emit('create', sessionNumber.value)
  } catch (err) {
    error.value = err.message
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] px-4 font-['Inter']"
  >
    <div
      class="bg-white rounded-[15px] p-[30px] w-full max-w-[500px] shadow-2xl flex flex-col gap-4"
    >
      <h2 class="text-2xl font-bold text-[#5c001f]">Create New Session</h2>

      <div class="flex flex-col gap-2">
        <label class="text-sm font-semibold text-gray-700">Session Number</label>
        <input
          v-model="sessionNumber"
          type="number"
          placeholder="e.g. 25262"
          class="border border-gray-300 rounded-[8px] px-4 py-3 outline-none focus:border-[#5c001f] focus:ring-1 focus:ring-[#5c001f]"
          @keyup.enter="handleCreate"
        />
        <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
      </div>

      <div class="flex justify-end gap-3 mt-4">
        <button
          @click="$emit('close')"
          class="px-5 py-2.5 rounded-[8px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          :disabled="isLoading"
        >
          Cancel
        </button>
        <button
          @click="handleCreate"
          class="px-5 py-2.5 rounded-[8px] font-medium text-white bg-[#5c001f] hover:bg-[#4a0019] transition-colors shadow-md disabled:opacity-50"
          :disabled="isLoading"
        >
          {{ isLoading ? 'Creating...' : 'Create Session' }}
        </button>
      </div>
    </div>
  </div>
</template>
