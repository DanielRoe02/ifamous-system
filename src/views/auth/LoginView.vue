<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useCalendarStore } from '@/stores/calendarStore'
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'

const router = useRouter()
const { login } = useAuth()
const calendarStore = useCalendarStore()

onMounted(() => {
  calendarStore.fetchActiveSession()
})

const email = ref('')
const password = ref('')
const errorMessage = ref('')

const handleLogin = async () => {
  errorMessage.value = ''

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
    const response = await fetch(`${apiUrl}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.value,
        password: password.value,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Login failed')
    }

    // Save session
    login(data.user, data.token)

    // Redirect to dashboard
    router.push('/dashboard')
  } catch (error) {
    errorMessage.value = error.message
  }
}

const handleForgotPassword = () => {
  alert('Please contact your coordinator first (feature not implemented)')
}
</script>

<template>
  <div
    class="bg-[#e7ded3] flex flex-col items-center justify-between min-h-screen w-full font-sans"
  >
    <div class="w-full flex flex-col items-center justify-start pb-16">
      <!-- Heading Area -->
      <AppHeader />

      <!-- Session Text -->
      <p
        class="font-sans font-bold leading-normal relative shrink-0 text-4xl text-gray-800 whitespace-nowrap mt-16 mb-8"
      >
        {{
          calendarStore.isLoading
            ? 'Loading session...'
            : calendarStore.activeSessionId
              ? 'Session ' + calendarStore.activeSessionId
              : 'No active session'
        }}
      </p>

      <!-- Form Log In -->
      <form
        @submit.prevent="handleLogin"
        class="bg-white border border-[#d9d9d9] flex flex-col gap-6 items-start min-w-[320px] p-8 relative rounded-xl shrink-0 w-[420px] shadow-sm font-sans"
      >
        <p
          class="capitalize font-sans font-bold leading-normal relative shrink-0 text-3xl text-[#5c001f] whitespace-nowrap self-center mb-2"
        >
          SIGN IN
        </p>

        <p
          v-if="errorMessage"
          class="text-red-500 text-sm font-medium w-full text-center mt-[-10px]"
        >
          {{ errorMessage }}
        </p>

        <!-- Email Field -->
        <div class="flex flex-col gap-2 w-full">
          <label class="text-sm font-medium text-gray-700">Email</label>
          <input
            v-model="email"
            type="email"
            required
            placeholder="Value"
            class="border border-[#d9d9d9] rounded-[8px] px-4 py-3 outline-none focus:border-[#5c001f] focus:ring-1 focus:ring-[#5c001f] w-full text-black"
          />
        </div>

        <!-- Password Field -->
        <div class="flex flex-col gap-2 w-full">
          <label class="text-sm font-medium text-gray-700">Password</label>
          <input
            v-model="password"
            type="password"
            required
            placeholder="Value"
            class="border border-[#d9d9d9] rounded-[8px] px-4 py-3 outline-none focus:border-[#5c001f] focus:ring-1 focus:ring-[#5c001f] w-full text-black"
          />
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          class="bg-[#5c001f] hover:bg-[#4a0019] text-white rounded-[8px] py-3 font-medium transition-colors w-full mt-2"
        >
          Sign In
        </button>

        <!-- Forgot Password Text Link -->
        <div class="w-full flex justify-center mt-[-8px]">
          <a
            @click.prevent="handleForgotPassword"
            href="#"
            class="text-[#5c001f] hover:underline text-sm font-medium decoration-solid underline-offset-4"
          >
            Forgot password?
          </a>
        </div>

        <!-- Text Sign up -->
        <div
          class="border-gray-200 border-t flex font-sans gap-2 items-center justify-center pt-4 mt-2 w-full text-[15px]"
        >
          <span class="text-gray-600">New here? Create An Account &rarr;</span>
          <router-link to="/signup" class="text-[#5c001f] font-semibold hover:underline"
            >SIGN UP</router-link
          >
        </div>
      </form>
    </div>
  </div>
  <!-- Footer -->
  <AppFooter />
</template>
