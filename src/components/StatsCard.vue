<script setup>
defineProps({
  amount: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <div
    class="bg-white border border-[#d9d9d9] flex flex-col items-center justify-center p-[20px] rounded-[8px] w-full shrink-0 shadow-sm transition-transform hover:-translate-y-1"
  >
    <p
      class="font-['Inter'] font-semibold text-[36px] text-[#1e1e1e] tracking-tight leading-tight text-center"
    >
      {{ amount }}
    </p>
    <p class="font-['Inter'] font-normal text-[20px] text-[#1e1e1e] text-center mt-1">
      {{ label }}
    </p>
  </div>
</template>
