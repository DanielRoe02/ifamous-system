<script setup>
import { ref } from 'vue'
import { apiService } from '@/services/api'
import { Eye, EyeOff } from 'lucide-vue-next'

const emit = defineEmits(['user-created'])
const showPassword = ref(false)

const form = ref({
  fullName: '',
  email: '',
  password: '',
  phoneNumber: '',
  coOrgName: '',
  affiliation: '',
})

// Expertise tags logic
const expertiseTags = ref([])
const expertiseInput = ref('')

const addTag = (event) => {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    const val = expertiseInput.value.trim().replace(/,$/, '')
    if (val && !expertiseTags.value.includes(val)) {
      expertiseTags.value.push(val)
    }
    expertiseInput.value = ''
  }
}

const removeTag = (index) => {
  expertiseTags.value.splice(index, 1)
}

const isSubmitting = ref(false)
const isUploading = ref(false)
const uploadError = ref('')

const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  uploadError.value = ''

  if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
    uploadError.value = 'Invalid file type. Please upload a PNG or JPEG.'
    return
  }

  isUploading.value = true

  try {
    const formData = new FormData()
    formData.append('image', file)

    const response = await fetch('http://localhost:3000/api/assistant/extract-user-profile', {
      method: 'POST',
      body: formData,
    })

    const result = await response.json()

    if (response.ok && result.success) {
      if (result.data.fullName) form.value.fullName = result.data.fullName
      if (result.data.email) form.value.email = result.data.email
      if (result.data.affiliation) form.value.affiliation = result.data.affiliation
      if (result.data.coOrgName) form.value.coOrgName = result.data.coOrgName
      if (result.data.expertise && Array.isArray(result.data.expertise)) {
        result.data.expertise.forEach((tag) => {
          if (tag && !expertiseTags.value.includes(tag)) {
            expertiseTags.value.push(tag)
          }
        })
      }
    } else {
      uploadError.value = result.error || 'Failed to process image'
    }
  } catch (error) {
    console.error('Upload error:', error)
    uploadError.value = 'An error occurred while uploading.'
  } finally {
    isUploading.value = false
    event.target.value = '' // reset input
  }
}

const submitForm = async () => {
  if (!form.value.fullName || !form.value.email || !form.value.password) {
    alert('Full Name, Email, and Password are required!')
    return
  }

  try {
    isSubmitting.value = true
    const expertiseString = expertiseTags.value.join(', ')

    await apiService.createUser({
      full_name: form.value.fullName,
      email: form.value.email,
      password: form.value.password,
      phone_number: form.value.phoneNumber,
      co_org_name: form.value.coOrgName,
      expertise: expertiseString,
      affiliation: form.value.affiliation,
    })

    alert('User successfully created!')

    // Reset form
    form.value = {
      fullName: '',
      email: '',
      password: '',
      phoneNumber: '',
      coOrgName: '',
      affiliation: '',
    }
    expertiseTags.value = []

    emit('user-created')
  } catch (error) {
    console.error('Error creating user:', error)
    alert('Failed to create user. Email or Phone number might already exist.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="bg-white border border-gray-300 rounded-lg p-8 shadow-sm flex-1 h-fit">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-[#5c001f]">Create New User</h2>
    </div>

    <!-- AI Upload Area -->
    <div
      class="mb-6 p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex flex-col items-center justify-center relative hover:bg-gray-100 transition-colors"
    >
      <div v-if="!isUploading" class="flex flex-col items-center pointer-events-none">
        <svg
          class="w-10 h-10 text-gray-400 mb-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        <span class="text-sm font-semibold text-gray-700">Auto-fill from Profile Image (AI)</span>
        <span class="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</span>
      </div>

      <div v-if="isUploading" class="flex flex-col items-center">
        <div
          class="w-8 h-8 border-4 border-gray-300 border-t-[#5c001f] rounded-full animate-spin"
        ></div>
        <span class="mt-2 text-sm font-bold text-[#5c001f]">Extracting details...</span>
      </div>

      <input
        v-if="!isUploading"
        type="file"
        accept="image/png, image/jpeg, image/jpg"
        class="absolute inset-0 opacity-0 cursor-pointer"
        @change="handleFileUpload"
      />
    </div>

    <div
      v-if="uploadError"
      class="mb-4 text-sm text-red-600 font-bold bg-red-100 px-4 py-2 rounded-lg"
    >
      {{ uploadError }}
    </div>

    <form @submit.prevent="submitForm" class="flex flex-col gap-6">
      <!-- Full Name -->
      <div class="flex flex-col gap-2">
        <label class="font-semibold text-gray-800">Full Name *</label>
        <input
          v-model="form.fullName"
          type="text"
          required
          placeholder="e.g. Dr. John Doe"
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
          placeholder="e.g. john@utm.my"
          class="border border-gray-300 p-3 rounded focus:outline-none focus:border-[#5c001f]"
        />
        <span class="text-sm text-gray-500 italic"
          >Note: Use @utm.my email for automatic Staff privileges</span
        >
      </div>

      <!-- Password -->
      <div class="flex flex-col gap-2">
        <label class="font-semibold text-gray-800">Password *</label>
        <div class="relative flex items-center">
          <input
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            required
            placeholder="Enter temporary password"
            class="border border-gray-300 p-3 rounded focus:outline-none focus:border-[#5c001f] w-full pr-12"
          />
          <button
            type="button"
            @click="showPassword = !showPassword"
            class="absolute right-3 text-gray-400 hover:text-gray-600 focus:outline-none border-none bg-transparent cursor-pointer p-1"
          >
            <Eye v-if="!showPassword" class="h-5 w-5" />
            <EyeOff v-else class="h-5 w-5" />
          </button>
        </div>
      </div>

      <!-- Phone Number -->
      <div class="flex flex-col gap-2">
        <label class="font-semibold text-gray-800">Phone Number</label>
        <input
          v-model="form.phoneNumber"
          type="tel"
          maxlength="12"
          placeholder="e.g. 0123456789"
          class="border border-gray-300 p-3 rounded focus:outline-none focus:border-[#5c001f]"
        />
      </div>

      <!-- Organization Name -->
      <div class="flex flex-col gap-2">
        <label class="font-semibold text-gray-800">Company / Organization Name</label>
        <input
          v-model="form.coOrgName"
          type="text"
          placeholder="e.g. Tech Corp"
          class="border border-gray-300 p-3 rounded focus:outline-none focus:border-[#5c001f]"
        />
      </div>

      <!-- Affiliation -->
      <div class="flex flex-col gap-2">
        <label class="font-semibold text-gray-800">Affiliation</label>
        <input
          v-model="form.affiliation"
          type="text"
          placeholder="e.g. Industry Expert"
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
            type="text"
            placeholder="Type tag and press Enter"
            class="flex-1 min-w-[150px] outline-none bg-transparent"
          />
        </div>
      </div>

      <div class="mt-4">
        <button
          type="submit"
          :disabled="isSubmitting"
          class="bg-[#5c001f] text-white font-bold py-3 px-8 rounded shadow hover:bg-[#4a0019] transition-colors"
          :class="{ 'opacity-50 cursor-not-allowed': isSubmitting }"
        >
          {{ isSubmitting ? 'Creating...' : 'Create User' }}
        </button>
      </div>
    </form>
  </div>
</template>
