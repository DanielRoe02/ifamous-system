<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import FormStepper from '@/components/FormStepper.vue'
import imgLine2 from '@/assets/f25212dbf403cb5eaf6315aeac6fdb23a11d908c.svg'

const router = useRouter()

const step = ref(1)
const stepperSteps = [{ label: 'Account Info' }, { label: 'Role Details' }]

const formData = ref({
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  phoneNumber: '',
})

const step2Data = ref({
  metricNumber: '',
  cgpa: '',
  totalCreditHour: '',
  creditHourProof: null,
  expertise: '',
  department: '',
  workloadCapacity: '5',
  companyName: '',
})

const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isDraggingProof = ref(false)
const errors = ref({})

const emailValue = computed(() => formData.value.email.trim().toLowerCase())

const emailDomain = computed(() => {
  const email = emailValue.value

  if (email.endsWith('@graduate.utm.my')) return 'student'
  if (email.endsWith('@utm.my')) return 'staff'
  return 'outsider'
})

const isStudent = computed(() => emailDomain.value === 'student')
const isUtmStaff = computed(() => emailDomain.value === 'staff')
const isOutsider = computed(() => emailDomain.value === 'outsider')

const roleLabel = computed(() => {
  if (isStudent.value) return 'Student account detected from @graduate.utm.my email'
  if (isUtmStaff.value) return 'UTM staff account detected from @utm.my email'
  return 'External user account detected'
})

const togglePassword = () => {
  showPassword.value = !showPassword.value
}

const toggleConfirmPassword = () => {
  showConfirmPassword.value = !showConfirmPassword.value
}

const validateStep1 = () => {
  errors.value = {}

  if (!formData.value.fullName.trim()) errors.value.fullName = 'Full name is required.'
  if (!formData.value.email.trim()) errors.value.email = 'Email is required.'
  if (formData.value.email && !/^\S+@\S+\.\S+$/.test(formData.value.email)) {
    errors.value.email = 'Please enter a valid email address.'
  }

  if (!formData.value.phoneNumber.trim()) errors.value.phoneNumber = 'Phone number is required.'
  if (formData.value.phoneNumber && !/^\d+$/.test(formData.value.phoneNumber)) {
    errors.value.phoneNumber = 'Phone number must be digits only.'
  }

  if (!formData.value.password) errors.value.password = 'Password is required.'
  if (formData.value.password.length > 0 && formData.value.password.length < 6) {
    errors.value.password = 'Password must be at least 6 characters.'
  }
  if (formData.value.password !== formData.value.confirmPassword) {
    errors.value.confirmPassword = 'Passwords do not match.'
  }

  return Object.keys(errors.value).length === 0
}

const validateStep2 = () => {
  errors.value = {}

  if (isStudent.value) {
    if (!step2Data.value.metricNumber.trim()) errors.value.metricNumber = 'Metric number is required.'
    if (!step2Data.value.cgpa) errors.value.cgpa = 'CGPA is required.'
    if (step2Data.value.cgpa && (Number(step2Data.value.cgpa) < 0 || Number(step2Data.value.cgpa) > 4)) {
      errors.value.cgpa = 'CGPA must be between 0.00 and 4.00.'
    }
    if (!step2Data.value.totalCreditHour) errors.value.totalCreditHour = 'Completed credit hours are required.'
    if (!step2Data.value.creditHourProof) errors.value.creditHourProof = 'Proof of credit hours is required.'
  }

  if (isUtmStaff.value) {
    if (expertiseTags.value.length === 0) errors.value.expertise = 'At least one expertise tag is required.'
    if (!step2Data.value.workloadCapacity) errors.value.workloadCapacity = 'Workload capacity is required.'
  }

  if (isOutsider.value) {
    if (!step2Data.value.companyName.trim()) errors.value.companyName = 'Company or organization name is required.'
  }

  return Object.keys(errors.value).length === 0
}

const handleNext = () => {
  if (validateStep1()) {
    step.value = 2
  }
}

const onStepClick = (targetStep) => {
  if (targetStep === 1) {
    step.value = 1
  } else if (targetStep === 2) {
    handleNext()
  }
}

const allowedProofExtensions = ['.jpeg', '.jpg', '.png', '.pdf']

const setProofFile = (file) => {
  if (!file) return

  const lowerName = file.name.toLowerCase()
  const isAllowed = allowedProofExtensions.some((extension) => lowerName.endsWith(extension))

  if (!isAllowed) {
    errors.value.creditHourProof = 'Only JPEG, PNG, or PDF files are allowed.'
    return
  }

  step2Data.value.creditHourProof = file
  delete errors.value.creditHourProof
}

const handleFileUpload = (event) => {
  setProofFile(event.target.files?.[0])
}

const handleProofDrop = (event) => {
  isDraggingProof.value = false
  setProofFile(event.dataTransfer.files?.[0])
}

const expertiseTags = ref([])
const expertiseInput = ref('')

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

const submitRegistration = async () => {
  try {
    if (!validateStep2()) return

    const payload = {
      email: formData.value.email.trim(),
      password: formData.value.password,
      fullName: formData.value.fullName.trim(),
      phoneNumber: formData.value.phoneNumber.trim(),
      roleType: emailDomain.value,

      // Student details. Email stays in users.email; metric number stays in students.metric_number.
      metricNumber: isStudent.value ? step2Data.value.metricNumber.trim().toUpperCase() : null,
      cgpa: isStudent.value ? Number(step2Data.value.cgpa) : null,
      totalCreditHour: isStudent.value ? Number(step2Data.value.totalCreditHour) : null,
      creditHourProofName: isStudent.value ? step2Data.value.creditHourProof?.name || '' : null,

      // Staff / external details.
      companyName: isOutsider.value ? step2Data.value.companyName.trim() : null,
      expertise: ['staff', 'outsider'].includes(emailDomain.value) ? expertiseTags.value.join(', ') : null,
      affiliation: isUtmStaff.value ? step2Data.value.department.trim() || 'UTM Staff' : null,
      workloadCapacity: isUtmStaff.value ? Number(step2Data.value.workloadCapacity || 5) : null,
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
    const response = await fetch(`${apiUrl}/api/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.details || data.error || 'Registration failed')
    }

    alert(data.message || 'Sign up successful!')
    router.push('/')
  } catch (error) {
    alert('Registration Error: ' + error.message)
    console.error('Signup Error:', error)
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3] flex flex-col items-center justify-between font-sans">
    <div class="w-full flex flex-col items-center justify-start pb-16">
      <AppHeader />

      <div class="w-full flex items-center justify-center p-6 sm:p-8">
        <div
          class="bg-white w-full max-w-[1000px] flex flex-col items-center py-10 px-4 rounded-xl shadow-sm overflow-hidden relative"
        >
          <FormStepper :current-step="step" :steps="stepperSteps" @step-click="onStepClick" />

          <div class="w-full mb-10 flex justify-center px-8">
            <img :src="imgLine2" alt="Separator" class="w-full max-w-[900px] object-cover h-[2px]" />
          </div>

          <div
            class="bg-white border border-[#d9d9d9] rounded-[8px] w-full max-w-[540px] p-[24px] flex flex-col gap-[24px]"
          >
            <form
              v-if="step === 1"
              @submit.prevent="handleNext"
              class="flex flex-col gap-[20px] w-full transition-opacity duration-300"
            >
              <div class="rounded-xl border border-[#f8be17]/40 bg-[#fff8dc] px-4 py-3 text-sm text-[#5c001f]">
                <p class="font-bold">Automatic role detection</p>
                <p class="text-xs mt-1 text-[#5c001f]/80">
                  Student: <b>@graduate.utm.my</b> · Staff/Supervisor: <b>@utm.my</b> · External: other email
                </p>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium text-[#0d0b26]">Full Name</label>
                <input
                  v-model="formData.fullName"
                  type="text"
                  placeholder="Ahmad Daniel Tamingsari Bin Ramlan"
                  class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500"
                />
                <span v-if="errors.fullName" class="text-red-500 text-xs">{{ errors.fullName }}</span>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium text-[#0d0b26]">Email</label>
                <span class="text-xs text-gray-500 mb-1 leading-tight">
                  Students use @graduate.utm.my. Staff use @utm.my.
                </span>
                <input
                  v-model="formData.email"
                  type="email"
                  placeholder="ahmad.daniel@graduate.utm.my"
                  class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500"
                />
                <span v-if="errors.email" class="text-red-500 text-xs">{{ errors.email }}</span>
                <p
                  v-if="formData.email"
                  class="text-xs mt-1 font-semibold"
                  :class="isStudent ? 'text-blue-700' : isUtmStaff ? 'text-amber-700' : 'text-gray-600'"
                >
                  {{ roleLabel }}
                </p>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium text-[#0d0b26]">Phone Number</label>
                <span class="text-xs text-gray-500 mb-1 leading-tight">Must be accessible through WhatsApp. No spacing.</span>
                <input
                  v-model="formData.phoneNumber"
                  type="text"
                  placeholder="0123456789"
                  class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500"
                />
                <span v-if="errors.phoneNumber" class="text-red-500 text-xs">{{ errors.phoneNumber }}</span>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium text-[#0d0b26]">Password</label>
                <div class="relative">
                  <input
                    v-model="formData.password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="******"
                    class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full pr-10 text-sm text-gray-900 placeholder:text-gray-500"
                  />
                  <button
                    type="button"
                    @click="togglePassword"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 p-1 hover:text-gray-800"
                  >
                    {{ showPassword ? 'Hide' : 'Show' }}
                  </button>
                </div>
                <span v-if="errors.password" class="text-red-500 text-xs">{{ errors.password }}</span>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium text-[#0d0b26]">Confirm Password</label>
                <div class="relative">
                  <input
                    v-model="formData.confirmPassword"
                    :type="showConfirmPassword ? 'text' : 'password'"
                    placeholder="******"
                    class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full pr-10 text-sm text-gray-900 placeholder:text-gray-500"
                  />
                  <button
                    type="button"
                    @click="toggleConfirmPassword"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 p-1 hover:text-gray-800"
                  >
                    {{ showConfirmPassword ? 'Hide' : 'Show' }}
                  </button>
                </div>
                <span v-if="errors.confirmPassword" class="text-red-500 text-xs">{{ errors.confirmPassword }}</span>
              </div>

              <button
                type="submit"
                class="w-full bg-[#5c001f] hover:bg-[#7a0029] text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 mt-2 flex justify-center"
              >
                Next
              </button>

              <div class="text-center mt-2">
                <p class="text-gray-600 text-sm">
                  Already have an account?
                  <router-link to="/" class="text-[#5c001f] font-semibold hover:underline">Sign in</router-link>
                </p>
              </div>
            </form>

            <form
              v-else-if="step === 2"
              @submit.prevent="submitRegistration"
              class="flex flex-col gap-[20px] w-full transition-opacity duration-300"
            >
              <div class="rounded-xl border border-[#5c001f]/10 bg-[#f8f1eb] px-4 py-3">
                <p class="text-sm font-bold text-[#5c001f]">{{ roleLabel }}</p>
                <p class="text-xs text-gray-600 mt-1">
                  The system will automatically create the correct role record after registration.
                </p>
              </div>

              <template v-if="emailDomain === 'student'">
                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium text-[#0d0b26]">Metric Number</label>
                  <input
                    v-model="step2Data.metricNumber"
                    type="text"
                    placeholder="A24MJ5074"
                    class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500 uppercase"
                  />
                  <span v-if="errors.metricNumber" class="text-red-500 text-xs">{{ errors.metricNumber }}</span>
                </div>

                <div class="flex gap-4">
                  <div class="flex flex-col gap-1 flex-1">
                    <label class="text-sm font-medium text-[#0d0b26]">Current CGPA</label>
                    <input
                      v-model="step2Data.cgpa"
                      type="number"
                      step="0.01"
                      min="0"
                      max="4"
                      placeholder="3.50"
                      class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500"
                    />
                    <span v-if="errors.cgpa" class="text-red-500 text-xs">{{ errors.cgpa }}</span>
                  </div>
                  <div class="flex flex-col gap-1 flex-1">
                    <label class="text-sm font-medium text-[#0d0b26]">Completed Credit Hours</label>
                    <input
                      v-model="step2Data.totalCreditHour"
                      type="number"
                      min="0"
                      placeholder="90"
                      class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500"
                    />
                    <span v-if="errors.totalCreditHour" class="text-red-500 text-xs">{{ errors.totalCreditHour }}</span>
                  </div>
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium text-[#0d0b26]">Proof of Credit Hours</label>
                  <span class="text-xs text-gray-500 mb-1 leading-tight">
                    Upload your credit hour proof. Accepted files: JPEG, PNG, PDF.
                  </span>

                  <div
                    class="relative border rounded-lg bg-white overflow-hidden group transition-colors cursor-pointer"
                    :class="isDraggingProof ? 'border-[#5c001f] bg-[#fff8dc]' : 'border-[#d9d9d9] hover:border-[#5c001f]'"
                    @dragover.prevent="isDraggingProof = true"
                    @dragleave.prevent="isDraggingProof = false"
                    @drop.prevent="handleProofDrop"
                  >
                    <input
                      type="file"
                      @change="handleFileUpload"
                      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      accept=".jpeg,.jpg,.png,.pdf"
                    />
                    <div class="px-4 py-10 flex flex-col items-center justify-center text-center">
                      <p class="text-sm text-[#0d0b26] font-medium truncate w-full px-4">
                        {{ step2Data.creditHourProof ? step2Data.creditHourProof.name : 'Click or drag proof file here' }}
                      </p>
                      <p v-if="!step2Data.creditHourProof" class="text-xs text-gray-400 mt-2">
                        Drag & drop also supported
                      </p>
                    </div>
                  </div>
                  <span v-if="errors.creditHourProof" class="text-red-500 text-xs">{{ errors.creditHourProof }}</span>
                </div>
              </template>

              <template v-else-if="emailDomain === 'staff'">
                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium text-[#0d0b26]">Expertise</label>
                  <div
                    class="px-4 py-2 rounded-lg border border-[#d9d9d9] flex flex-wrap gap-2 items-center focus-within:ring-1 focus-within:ring-[#5c001f] focus-within:border-[#5c001f] bg-white"
                  >
                    <div
                      v-for="(tag, index) in expertiseTags"
                      :key="index"
                      class="bg-[#e7ded3] text-[#5c001f] px-3 py-1 rounded-full flex items-center gap-2 text-sm font-medium"
                    >
                      {{ tag }}
                      <button
                        type="button"
                        @click.prevent="removeTag(index)"
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
                      class="flex-1 min-w-[150px] outline-none bg-transparent text-sm text-gray-900 placeholder:text-gray-500"
                    />
                  </div>
                  <span v-if="errors.expertise" class="text-red-500 text-xs">{{ errors.expertise }}</span>
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium text-[#0d0b26]">Department / Division</label>
                  <input
                    v-model="step2Data.department"
                    type="text"
                    placeholder="Software Engineering"
                    class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500"
                  />
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium text-[#0d0b26]">Default Workload Capacity</label>
                  <span class="text-xs text-gray-500 mb-1 leading-tight">Maximum number of FYP students this supervisor can take.</span>
                  <input
                    v-model="step2Data.workloadCapacity"
                    type="number"
                    min="1"
                    placeholder="5"
                    class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500"
                  />
                  <span v-if="errors.workloadCapacity" class="text-red-500 text-xs">{{ errors.workloadCapacity }}</span>
                </div>
              </template>

              <template v-else>
                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium text-[#0d0b26]">Company / Organization Name</label>
                  <input
                    v-model="step2Data.companyName"
                    type="text"
                    placeholder="External Organization"
                    class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500"
                  />
                  <span v-if="errors.companyName" class="text-red-500 text-xs">{{ errors.companyName }}</span>
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium text-[#0d0b26]">Your Expertise</label>
                  <div
                    class="px-4 py-2 rounded-lg border border-[#d9d9d9] flex flex-wrap gap-2 items-center focus-within:ring-1 focus-within:ring-[#5c001f] focus-within:border-[#5c001f] bg-white"
                  >
                    <div
                      v-for="(tag, index) in expertiseTags"
                      :key="index"
                      class="bg-[#e7ded3] text-[#5c001f] px-3 py-1 rounded-full flex items-center gap-2 text-sm font-medium"
                    >
                      {{ tag }}
                      <button
                        type="button"
                        @click.prevent="removeTag(index)"
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
                      class="flex-1 min-w-[150px] outline-none bg-transparent text-sm text-gray-900 placeholder:text-gray-500"
                    />
                  </div>
                </div>
              </template>

              <div class="flex gap-4 mt-2">
                <button
                  type="button"
                  @click="step = 1"
                  class="w-1/3 bg-white border border-[#5c001f] hover:bg-gray-50 text-[#5c001f] font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex justify-center"
                >
                  Back
                </button>
                <button
                  type="submit"
                  class="w-2/3 bg-[#5c001f] hover:bg-[#7a0029] text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex justify-center"
                >
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
  <AppFooter />
</template>
