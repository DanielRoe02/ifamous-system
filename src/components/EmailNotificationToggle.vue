<script setup>
import { Mail } from 'lucide-vue-next'

defineProps({
  modelValue: { type: Boolean, default: true },
  compact: { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <label
    class="flex items-start gap-3 rounded-[14px] border border-[#e1d5cc] bg-[#fffaf0] px-4 py-3 cursor-pointer"
    :class="compact ? 'text-sm' : ''"
  >
    <input
      type="checkbox"
      class="mt-1 h-4 w-4 accent-[#5c001f]"
      :checked="modelValue"
      @change="$emit('update:modelValue', $event.target.checked)"
    />
    <Mail class="mt-0.5 h-5 w-5 shrink-0 text-[#5c001f]" />
    <span>
      <strong>Send email notification</strong>
      <span class="block text-xs text-gray-600 mt-0.5">
        Checked by default. No files will be attached; the email contains a secure I-FAMOUS link.
      </span>
    </span>
  </label>
</template>
