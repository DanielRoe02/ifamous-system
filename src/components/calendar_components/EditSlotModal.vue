<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  isOpen: Boolean,
  initialData: {
    type: Object,
    default: () => ({ title: '', startTime: '', endTime: '' }),
  },
})

const emit = defineEmits(['save', 'close'])

const form = ref({
  title: '',
  startTime: '',
  endTime: '',
})

watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      form.value = { ...props.initialData }
    }
  },
)

const save = () => {
  emit('save', { ...form.value })
}

const close = () => {
  emit('close')
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]"
  >
    <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4 relative">
      <h2 class="text-xl font-bold text-[#5c001f]">Edit Slot</h2>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-gray-700">Label/Title</label>
        <input
          v-model="form.title"
          type="text"
          class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-gray-700">Start Time</label>
        <input
          v-model="form.startTime"
          type="time"
          class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-gray-700">End Time</label>
        <input
          v-model="form.endTime"
          type="time"
          class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none"
        />
      </div>

      <div class="flex justify-end gap-3 mt-4">
        <button
          @click="close"
          class="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          @click="save"
          class="px-4 py-2 bg-[#5c001f] text-white font-medium rounded-lg hover:bg-[#4a0019] transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
</template>
