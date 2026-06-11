<script setup>
defineProps({
  status: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <div
    class="flex items-center justify-center px-[20px] py-[6px] rounded-[25px] shrink-0"
    :class="{
      'bg-[#ffd000] text-black': status === 'Pending' || status === 'Proposal Submitted',
      'bg-red-500 text-white': status === 'Missed deadline',
      'bg-green-500 text-white': status === 'Approved' || status === 'Active',
    }"
  >
    <p class="capitalize font-['Inter'] font-medium text-[14px] whitespace-nowrap">
      {{ status }}
    </p>
  </div>
</template>
