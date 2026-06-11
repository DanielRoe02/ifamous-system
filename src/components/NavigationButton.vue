<script setup>
defineProps({
  linkName: {
    type: String,
    required: true,
  },
  active: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <button
    class="content-stretch flex items-center justify-start px-[25px] py-[20px] relative w-full transition-colors hover:bg-gray-300"
    :class="{ 'bg-gray-300 font-bold border-l-4 border-[#5c001f]': active }"
  >
    <p
      class="capitalize flex-[1_0_0] font-['Inter'] font-medium leading-[normal] relative text-[24px] text-[#1e1e1e] text-left"
    >
      {{ linkName }}
    </p>
  </button>
</template>
