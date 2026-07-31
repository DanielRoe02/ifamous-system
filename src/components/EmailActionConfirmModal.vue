<script setup>
import { Mail, X } from 'lucide-vue-next'
import { ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: 'Confirm action' },
  description: { type: String, default: '' },
  recipient: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Confirm' },
  busy: { type: Boolean, default: false },
  defaultSendEmail: { type: Boolean, default: true },
})

const emit = defineEmits(['confirm', 'cancel'])
const sendEmail = ref(true)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) sendEmail.value = props.defaultSendEmail
  },
  { immediate: true },
)

function cancel() {
  if (!props.busy) emit('cancel')
}

function confirm() {
  if (!props.busy) emit('confirm', sendEmail.value)
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-4"
    role="dialog"
    aria-modal="true"
    :aria-label="title"
    @click.self="cancel"
  >
    <section class="w-full max-w-xl overflow-hidden rounded-[26px] border border-[#e1d5cc] bg-white shadow-2xl">
      <header class="flex items-start justify-between gap-4 bg-[#5c001f] p-6 text-white">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-[#f8be17]">Confirm notification</p>
          <h2 class="mt-1 text-2xl font-bold">{{ title }}</h2>
        </div>
        <button
          type="button"
          class="rounded-full bg-white/10 p-2 hover:bg-white/20 disabled:opacity-60"
          :disabled="busy"
          aria-label="Close confirmation"
          @click="cancel"
        >
          <X class="h-5 w-5" />
        </button>
      </header>

      <div class="space-y-5 p-6">
        <div class="rounded-[18px] border border-[#e1d5cc] bg-[#f7f1ea] p-4">
          <p class="font-bold text-[#5c001f]">In-app notification</p>
          <p class="mt-1 text-sm text-gray-700">This notification is always created inside I-FAMOUS.</p>
          <p v-if="description" class="mt-3 text-sm leading-relaxed text-gray-700">{{ description }}</p>
          <p v-if="recipient" class="mt-3 break-words text-sm"><strong>Recipient:</strong> {{ recipient }}</p>
        </div>

        <label class="flex cursor-pointer items-start gap-3 rounded-[18px] border border-[#f8be17]/60 bg-[#fff8dc] p-4">
          <input v-model="sendEmail" type="checkbox" class="mt-1 h-4 w-4 accent-[#5c001f]" />
          <Mail class="mt-0.5 h-5 w-5 shrink-0 text-[#5c001f]" />
          <span>
            <strong>Also send an email notification</strong>
            <span class="mt-1 block text-xs leading-relaxed text-gray-600">
              Checked by default. No file is attached; the email contains a secure I-FAMOUS link.
            </span>
          </span>
        </label>

        <div class="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            class="rounded-xl border border-[#d8c9bd] px-5 py-2.5 font-bold disabled:opacity-60"
            :disabled="busy"
            @click="cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-xl bg-[#5c001f] px-5 py-2.5 font-bold text-white disabled:opacity-60"
            :disabled="busy"
            @click="confirm"
          >
            {{ busy ? 'Processing…' : confirmLabel }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
