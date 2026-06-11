<script setup>
defineProps({
  currentStep: {
    type: Number,
    required: true,
  },
  steps: {
    type: Array,
    required: true,
  },
})
defineEmits(['step-click'])
</script>

<template>
  <div class="flex items-start justify-center w-full max-w-[760px] relative mb-4 shrink-0 mx-auto">
    <!-- Background Line connecting steps -->
    <!-- The line width assumes 2 steps right now. A fully dynamic line width for N steps would require more complex CSS or dynamic widths based on flex layout. -->
    <div class="absolute h-[3px] bg-[#cfd6dc] top-[19px] left-[50%] -translate-x-[50%] w-[35%]">
      <!-- Progress Line overlay -->
      <div
        class="h-full bg-[#5c001f] transition-all duration-300"
        :style="{ width: ((currentStep - 1) / (steps.length - 1 || 1)) * 100 + '%' }"
      ></div>
    </div>

    <!-- Steps -->
    <div
      v-for="(stepObj, index) in steps"
      :key="index"
      class="flex flex-col items-center gap-[16px] flex-1 z-10 cursor-pointer"
      @click="$emit('step-click', index + 1)"
    >
      <div
        :class="[
          currentStep >= index + 1
            ? 'bg-[#5c001f] text-white border-[#5c001f]'
            : 'bg-white text-[#5c001f] border-[#5c001f]',
          'rounded-[20px] size-[40px] flex items-center justify-center shrink-0 border-2 transition-colors duration-300',
        ]"
      >
        <span class="font-medium text-[16px]">{{ String(index + 1).padStart(2, '0') }}</span>
      </div>
      <div class="h-[40px] flex items-center justify-center text-center">
        <span class="text-[#0d0b26] font-medium text-[14px]">{{ stepObj.label }}</span>
      </div>
    </div>
  </div>
</template>
