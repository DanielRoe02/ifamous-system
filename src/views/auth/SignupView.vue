<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import FormStepper from '@/components/FormStepper.vue'
import imgLine2 from '@/assets/f25212dbf403cb5eaf6315aeac6fdb23a11d908c.svg'

const router = useRouter()

const step = ref(1)
const stepperSteps = [{ label: 'Basic Info' }, { label: 'More Info' }]

const formData = ref({
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  phoneNumber: '',
  // affiliation: '',
})

const step2Data = ref({
  // Student
  metricNumber: '',
  cgpa: '',
  totalCreditHour: '',
  creditHourProof: null,

  // Staff & Outsider shared
  expertise: '',

  // Staff
  department: '',
  workloadCapacity: '',

  // Outsider
  companyName: '',
})

const showPassword = ref(false)
const showConfirmPassword = ref(false)
const errors = ref({})

const emailDomain = computed(() => {
  const email = formData.value.email.toLowerCase()
  if (email.endsWith('@graduate.utm.my')) return 'student'
  if (email.endsWith('@utm.my')) return 'staff'
  return 'outsider'
})

const isUtmStaff = computed(() => emailDomain.value === 'staff')

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

  if (!formData.value.phoneNumber.trim()) errors.value.phoneNumber = 'Phone number is required.'
  if (!/^\d+$/.test(formData.value.phoneNumber))
    errors.value.phoneNumber = 'Phone number must be digits.'

  if (!formData.value.password) errors.value.password = 'Password is required.'
  if (formData.value.password !== formData.value.confirmPassword)
    errors.value.confirmPassword = 'Passwords do not match.'
  // if (!formData.value.affiliation.trim()) errors.value.affiliation = 'Affiliation is required.'

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

const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    step2Data.value.creditHourProof = file
  }
}

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

const submitRegistration = async () => {
  try {
    // Map data to match the stored procedure signature expectations
    const payload = {
      email: formData.value.email,
      password: formData.value.password, // In a real app, hash this properly on the backend
      fullName: formData.value.fullName,
      phoneNumber: formData.value.phoneNumber,
      // Pass null if the field doesn't apply to the user's role
      companyName: emailDomain.value === 'outsider' ? step2Data.value.companyName : null,
      expertise: ['staff', 'outsider'].includes(emailDomain.value)
        ? expertiseTags.value.join(', ')
        : null,
      // Map metric number (student) or department (staff) to p_affiliation
      affiliation:
        emailDomain.value === 'staff'
          ? step2Data.value.department
          : emailDomain.value === 'student'
            ? step2Data.value.metricNumber
            : null,
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

    alert('Sign up successful!')
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
      <!-- Heading Area -->
      <AppHeader />

      <!-- Main Content Area -->
      <div class="w-full flex items-center justify-center p-6 sm:p-8">
        <!-- Register Form Container (White Card) -->
        <div
          class="bg-white w-full max-w-[1000px] flex flex-col items-center py-10 px-4 rounded-xl shadow-sm overflow-hidden relative"
        >
          <!-- Stepper Component -->
          <FormStepper :current-step="step" :steps="stepperSteps" @step-click="onStepClick" />

          <!-- Horizontal Separator Line below stepper -->
          <div class="w-full mb-10 flex justify-center px-8">
            <img
              :src="imgLine2"
              alt="Separator"
              class="w-full max-w-[900px] object-cover h-[2px]"
            />
          </div>

          <!-- Form Inner Box -->
          <div
            class="bg-white border border-[#d9d9d9] rounded-[8px] w-full max-w-[500px] p-[24px] flex flex-col gap-[24px]"
          >
            <!-- STEP 1 FORM -->
            <form
              v-if="step === 1"
              @submit.prevent="handleNext"
              class="flex flex-col gap-[20px] w-full transition-opacity duration-300"
            >
              <!-- Full Name -->
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium text-[#0d0b26]">Full Name</label>
                <input
                  v-model="formData.fullName"
                  type="text"
                  placeholder="John Doe"
                  class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500"
                />
                <span v-if="errors.fullName" class="text-red-500 text-xs">{{
                  errors.fullName
                }}</span>
              </div>

              <!-- Email -->
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium text-[#0d0b26]">Email</label>
                <span class="text-xs text-gray-500 mb-1 leading-tight"
                  >Students please use @graduate.utm.my email. <br />
                  Staff please use @utm.my email</span
                >
                <input
                  v-model="formData.email"
                  type="email"
                  placeholder="johndoe@email.com"
                  class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500"
                />
                <span v-if="errors.email" class="text-red-500 text-xs">{{ errors.email }}</span>
                <p v-if="isUtmStaff" class="text-amber-600 text-xs mt-1 font-medium">
                  ✨ Automatically verified as UTM Staff
                </p>
              </div>

              <!-- Phone Number -->
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium text-[#0d0b26]">Phone Number</label>
                <span class="text-xs text-gray-500 mb-1 leading-tight"
                  >Must be accessible through Whatsapp. No spacing</span
                >
                <input
                  v-model="formData.phoneNumber"
                  type="text"
                  placeholder="Value"
                  class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500"
                />
                <span v-if="errors.phoneNumber" class="text-red-500 text-xs">{{
                  errors.phoneNumber
                }}</span>
              </div>

              <!-- Affiliation -->
              <!-- <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-[#0d0b26]">Affiliation</label>
              <input
                v-model="formData.affiliation"
                type="text"
                placeholder="Value"
                class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500"
              />
              <span v-if="errors.affiliation" class="text-red-500 text-xs">{{
                errors.affiliation
              }}</span>
            </div> -->

              <!-- Password -->
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
                    <svg
                      v-if="showPassword"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="w-4 h-4"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                    <svg
                      v-else
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="w-4 h-4"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                </div>
                <span v-if="errors.password" class="text-red-500 text-xs">{{
                  errors.password
                }}</span>
              </div>

              <!-- Confirm Password -->
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
                    <svg
                      v-if="showConfirmPassword"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="w-4 h-4"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                    <svg
                      v-else
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="w-4 h-4"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                </div>
                <span v-if="errors.confirmPassword" class="text-red-500 text-xs">{{
                  errors.confirmPassword
                }}</span>
              </div>

              <!-- Action Button -->
              <button
                type="submit"
                class="w-full bg-[#5c001f] hover:bg-[#7a0029] text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 mt-2 flex justify-center"
              >
                Next
              </button>

              <!-- Login Hyperlink -->
              <div class="text-center mt-2">
                <p class="text-gray-600 text-sm">
                  Already have an account?
                  <router-link to="/" class="text-[#5c001f] font-semibold hover:underline"
                    >Sign in</router-link
                  >
                </p>
              </div>
            </form>

            <!-- STEP 2 FORM -->
            <form
              v-else-if="step === 2"
              @submit.prevent="submitRegistration"
              class="flex flex-col gap-[20px] w-full transition-opacity duration-300"
            >
              <!-- STUDENT FIELDS -->
              <template v-if="emailDomain === 'student'">
                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium text-[#0d0b26]">Metric Number</label>
                  <input
                    v-model="step2Data.metricNumber"
                    type="text"
                    placeholder="Value"
                    class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500"
                  />
                </div>

                <div class="flex gap-4">
                  <div class="flex flex-col gap-1 flex-1">
                    <label class="text-sm font-medium text-[#0d0b26]">Current CGPA</label>
                    <input
                      v-model="step2Data.cgpa"
                      type="text"
                      placeholder="Value"
                      class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500"
                    />
                  </div>
                  <div class="flex flex-col gap-1 flex-1">
                    <label class="text-sm font-medium text-[#0d0b26]">Total Credit Hour</label>
                    <input
                      v-model="step2Data.totalCreditHour"
                      type="text"
                      placeholder="Value"
                      class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500"
                    />
                  </div>
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium text-[#0d0b26]">Upload credit Hour</label>
                  <span class="text-xs text-gray-500 mb-1 leading-tight"
                    >Upload the credit hour you have taken total in this semester</span
                  >

                  <div
                    class="relative border border-[#d9d9d9] rounded-lg bg-white overflow-hidden group hover:border-[#5c001f] transition-colors cursor-pointer"
                  >
                    <input
                      type="file"
                      @change="handleFileUpload"
                      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      accept=".jpeg,.jpg,.png,.pdf"
                    />
                    <div class="px-4 py-10 flex flex-col items-center justify-center text-center">
                      <p class="text-sm text-[#0d0b26] font-medium truncate w-full px-4">
                        {{
                          step2Data.creditHourProof ? step2Data.creditHourProof.name : 'Proof.jpeg'
                        }}
                      </p>
                      <p v-if="!step2Data.creditHourProof" class="text-xs text-gray-400 mt-2">
                        Click to browse or drag file here
                      </p>
                    </div>
                  </div>
                </div>
              </template>

              <!-- STAFF FIELDS -->
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
                      type="text"
                      placeholder="Type tag and press Enter"
                      class="flex-1 min-w-[150px] outline-none bg-transparent text-sm text-gray-900 placeholder:text-gray-500"
                    />
                  </div>
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium text-[#0d0b26]">Department/Division</label>
                  <input
                    v-model="step2Data.department"
                    type="text"
                    placeholder="Value"
                    class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500"
                  />
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium text-[#0d0b26]"
                    >Default workload capacity</label
                  >
                  <span class="text-xs text-gray-500 mb-1 leading-tight"
                    >How many student you can take</span
                  >
                  <input
                    v-model="step2Data.workloadCapacity"
                    type="number"
                    placeholder="5"
                    value="5"
                    class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500"
                  />
                </div>
              </template>

              <!-- OUTSIDER FIELDS -->
              <template v-else>
                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium text-[#0d0b26]"
                    >Company/Organization Name</label
                  >
                  <input
                    v-model="step2Data.companyName"
                    type="text"
                    placeholder="5"
                    value="5"
                    class="px-4 py-3 rounded-lg border border-[#d9d9d9] focus:ring-1 focus:ring-[#5c001f] focus:border-[#5c001f] outline-none w-full text-sm text-gray-900 placeholder:text-gray-500"
                  />
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
                      type="text"
                      placeholder="Type tag and press Enter"
                      class="flex-1 min-w-[150px] outline-none bg-transparent text-sm text-gray-900 placeholder:text-gray-500"
                    />
                  </div>
                </div>
              </template>

              <!-- Step 2 Navigation Buttons -->
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
  <!-- Footer -->
  <AppFooter />
</template>
