<script setup>
import { ref, watch } from 'vue'
import { apiService } from '@/services/api'

const props = defineProps({
  user: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['close', 'user-updated'])

const form = ref({
  fullName: '',
  email: '',
  phoneNumber: '',
  affiliation: '',
})

const expertiseTags = ref([])
const expertiseInput = ref('')

const isSubmitting = ref(false)

// Initialize form from props
watch(
  () => props.user,
  (newUser) => {
    if (newUser) {
      form.value.fullName = newUser.full_name || ''
      form.value.email = newUser.email || ''
      form.value.phoneNumber = newUser.phone_number || ''
      form.value.affiliation = newUser.affiliation || ''

      // Parse expertise
      if (newUser.expertise) {
        expertiseTags.value = newUser.expertise
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      } else {
        expertiseTags.value = []
      }
    }
  },
  { immediate: true },
)

const commitExpertiseInput = () => {
  const parts = expertiseInput.value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  parts.forEach((item) => {
    if (!expertiseTags.value.includes(item)) {
      expertiseTags.value.push(item)
    }
  })

  expertiseInput.value = ''
}

const addTag = (event) => {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    commitExpertiseInput()
  }
}

const handleExpertisePaste = (event) => {
  const pastedText = event.clipboardData?.getData('text') || ''

  if (pastedText.includes(',')) {
    event.preventDefault()
    expertiseInput.value = pastedText
    commitExpertiseInput()
  }
}

const removeTag = (index) => {
  expertiseTags.value.splice(index, 1)
}

const submitForm = async () => {
  if (!form.value.fullName || !form.value.email) {
    alert('Full Name and Email are required!')
    return
  }

  try {
    isSubmitting.value = true
    const expertiseString = expertiseTags.value.join(', ')

    await apiService.updateUser(props.user.user_id, {
      full_name: form.value.fullName,
      email: form.value.email,
      phone_number: form.value.phoneNumber,
      expertise: expertiseString,
      affiliation: form.value.affiliation,
    })

    alert('User successfully updated!')
    emit('user-updated')
  } catch (error) {
    console.error('Error updating user:', error)
    alert('Failed to update user. Please try again.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
    <div
      class="bg-white border border-gray-300 rounded-lg p-8 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-[#5c001f]">Edit User</h2>
        <button @click="emit('close')" class="text-gray-500 hover:text-red-600 font-bold text-xl">
          &times;
        </button>
      </div>

      <form @submit.prevent="submitForm" class="flex flex-col gap-6">
        <!-- Full Name -->
        <div class="flex flex-col gap-2">
          <label class="font-semibold text-gray-800">Full Name *</label>
          <input
            v-model="form.fullName"
            type="text"
            required
            class="border border-gray-300 p-3 rounded focus:outline-none focus:border-[#5c001f]"
          />
        </div>

        <!-- Email -->
        <div class="flex flex-col gap-2">
          <label class="font-semibold text-gray-800">Email Address *</label>
          <input
            v-model="form.email"
            type="email"
            required
            class="border border-gray-300 p-3 rounded focus:outline-none focus:border-[#5c001f]"
          />
        </div>

        <!-- Phone Number -->
        <div class="flex flex-col gap-2">
          <label class="font-semibold text-gray-800">Phone Number</label>
          <input
            v-model="form.phoneNumber"
            type="tel"
            maxlength="12"
            class="border border-gray-300 p-3 rounded focus:outline-none focus:border-[#5c001f]"
          />
        </div>

        <!-- Affiliation -->
        <div class="flex flex-col gap-2">
          <label class="font-semibold text-gray-800">Affiliation</label>
          <input
            v-model="form.affiliation"
            type="text"
            class="border border-gray-300 p-3 rounded focus:outline-none focus:border-[#5c001f]"
          />
        </div>

        <!-- Expertise (Tags) -->
        <div class="flex flex-col gap-2">
          <label class="font-semibold text-gray-800">Area of Expertise</label>
          <div
            class="border border-gray-300 p-2 rounded flex flex-wrap gap-2 items-center focus-within:border-[#5c001f]"
          >
            <div
              v-for="(tag, index) in expertiseTags"
              :key="index"
              class="bg-[#e7ded3] text-[#5c001f] px-3 py-1 rounded-full flex items-center gap-2 text-sm font-medium"
            >
              {{ tag }}
              <button
                type="button"
                @click="removeTag(index)"
                class="text-[#5c001f] hover:text-red-600 font-bold leading-none"
              >
                &times;
              </button>
            </div>
            <input
              v-model="expertiseInput"
              @keydown="addTag"
              @blur="commitExpertiseInput"
              @paste="handleExpertisePaste"
              type="text"
              placeholder="Type tag and press Enter"
              class="flex-1 min-w-[150px] outline-none bg-transparent"
            />
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-4">
          <button
            type="button"
            @click="emit('close')"
            class="px-6 py-3 font-semibold text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="bg-[#5c001f] text-white font-bold py-3 px-8 rounded shadow hover:bg-[#4a0019] transition-colors"
            :class="{ 'opacity-50 cursor-not-allowed': isSubmitting }"
          >
            {{ isSubmitting ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
