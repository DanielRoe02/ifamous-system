<template>
  <div>
    <!-- State 1: Collapsed (Floating Action Button) -->
    <button
      v-if="widgetState === 1"
      @click="widgetState = 2"
      class="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-[#5C001F] hover:bg-[#5C001F]/90 shadow-lg flex items-center justify-center z-50 transition-transform hover:scale-105 p-0 border-none cursor-pointer"
    >
      <Bot class="h-7 w-7 text-[#F8BE17]" />
    </button>

    <!-- State 2 & 3: Expanded / Maximized Chat Window -->
    <div
      v-else
      class="fixed bottom-6 right-6 flex flex-col shadow-2xl transition-all duration-300 ease-in-out z-50 bg-white border border-gray-200 overflow-hidden"
      :class="{
        'w-[350px] h-[500px] rounded-xl': widgetState === 2,
        'w-[90vw] h-[90vh] max-w-[800px] max-h-[800px] rounded-xl sm:right-1/2 sm:bottom-1/2 sm:translate-x-1/2 sm:translate-y-1/2':
          widgetState === 3,
      }"
    >
      <!-- Header -->
      <div
        class="bg-[#5C001F] text-white px-4 py-3 flex flex-row items-center justify-between space-y-0 shadow-sm shrink-0 rounded-t-xl"
      >
        <div class="flex items-center gap-2">
          <Sparkles class="h-5 w-5 text-[#F8BE17]" />
          <h3 class="text-base font-semibold tracking-wide m-0">I-FAMOUS AI Assistant</h3>
        </div>
        <div class="flex items-center gap-1">
          <button
            class="h-8 w-8 inline-flex items-center justify-center text-white hover:text-[#F8BE17] hover:bg-white/10 transition-colors rounded-md border-none bg-transparent cursor-pointer"
            @click="toggleMaximize"
          >
            <Maximize2 v-if="widgetState === 2" class="h-4 w-4" />
            <Minimize2 v-else class="h-4 w-4" />
          </button>
          <button
            class="h-8 w-8 inline-flex items-center justify-center text-white hover:text-[#F8BE17] hover:bg-white/10 transition-colors rounded-md border-none bg-transparent cursor-pointer"
            @click="widgetState = 1"
          >
            <X class="h-5 w-5" />
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="flex-1 p-4 bg-gray-50 flex flex-col gap-3 overflow-y-auto" ref="scrollAreaRef">
        <div class="flex flex-col gap-4 pb-4">
          <div
            v-for="(msg, idx) in chatHistory"
            :key="idx"
            class="flex w-full"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm markdown-body flex flex-col gap-2"
              :class="
                msg.role === 'user'
                  ? 'bg-[#5C001F] text-white rounded-br-sm'
                  : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
              "
            >
              <div v-if="msg.images && msg.images.length > 0" class="w-full flex justify-end">
                <img
                  :src="'data:image/jpeg;base64,' + msg.images[0]"
                  class="max-w-[200px] rounded-lg border border-white/20"
                />
              </div>
              <div v-html="renderMarkdown(msg.content)"></div>
            </div>

            <!-- Agent Confirmation Card -->
            <div
              v-if="msg.action === 'CONFIRM_CREATE_USER' && !msg.completed"
              class="w-full mt-3 bg-white p-4 rounded-lg border border-gray-200 text-black shadow-sm flex flex-col gap-3"
            >
              <h4 class="font-bold text-[#5C001F] m-0">Confirm New User Details</h4>
              <div class="flex flex-col gap-2 text-sm">
                <label class="flex flex-col text-gray-600 font-medium"
                  >Name:
                  <input
                    v-model="msg.payload.fullName"
                    class="border px-2 py-1.5 w-full rounded focus:outline-none focus:border-[#5C001F] font-normal text-black"
                /></label>
                <label class="flex flex-col text-gray-600 font-medium"
                  >Email:
                  <input
                    v-model="msg.payload.email"
                    class="border px-2 py-1.5 w-full rounded focus:outline-none focus:border-[#5C001F] font-normal text-black"
                /></label>
                <label class="flex flex-col text-gray-600 font-medium"
                  >Password:
                  <input
                    v-model="msg.payload.password"
                    class="border px-2 py-1.5 w-full rounded focus:outline-none focus:border-[#5C001F] font-normal text-black"
                /></label>
                <label class="flex flex-col text-gray-600 font-medium"
                  >Phone number:
                  <input
                    v-model="msg.payload.phoneNumber"
                    class="border px-2 py-1.5 w-full rounded focus:outline-none focus:border-[#5C001F] font-normal text-black"
                /></label>
                <label class="flex flex-col text-gray-600 font-medium"
                  >Affiliation:
                  <input
                    v-model="msg.payload.affiliation"
                    class="border px-2 py-1.5 w-full rounded focus:outline-none focus:border-[#5C001F] font-normal text-black"
                /></label>
                <label class="flex flex-col text-gray-600 font-medium"
                  >Organization:
                  <input
                    v-model="msg.payload.coOrgName"
                    class="border px-2 py-1.5 w-full rounded focus:outline-none focus:border-[#5C001F] font-normal text-black"
                /></label>
                <label class="flex flex-col text-gray-600 font-medium"
                  >Expertise:
                  <input
                    v-model="msg.payload.expertise"
                    class="border px-2 py-1.5 w-full rounded focus:outline-none focus:border-[#5C001F] font-normal text-black"
                /></label>

                <div class="flex justify-end gap-2 mt-2">
                  <button
                    @click="cancelAction(msg)"
                    class="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 font-semibold border-none cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    @click="executeCreateUser(msg)"
                    class="px-3 py-1.5 bg-[#5C001F] hover:bg-[#4a0019] text-white rounded font-bold border-none cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <span
                      v-if="msg.isExecuting"
                      class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                    ></span>
                    Confirm & Create
                  </button>
                </div>
              </div>
            </div>

            <!-- AI Auto Scheduling Confirmation Card -->
            <div
              v-if="msg.action === 'CONFIRM_AUTO_SCHEDULE' && !msg.completed"
              class="w-full mt-3 bg-white p-4 rounded-lg border border-gray-200 text-black shadow-sm flex flex-col gap-3"
            >
              <h4 class="font-bold text-[#5C001F] m-0">Confirm AI Scheduling Settings</h4>
              <div class="flex flex-col gap-2 text-sm">
                <label class="flex flex-col text-gray-600 font-medium"
                  >Start Date:
                  <input
                    type="date"
                    v-model="msg.payload.startDate"
                    class="border px-2 py-1.5 w-full rounded focus:outline-none focus:border-[#5C001F] font-normal text-black"
                  />
                </label>
                <label class="flex flex-col text-gray-600 font-medium"
                  >End Date:
                  <input
                    type="date"
                    v-model="msg.payload.endDate"
                    class="border px-2 py-1.5 w-full rounded focus:outline-none focus:border-[#5C001F] font-normal text-black"
                  />
                </label>
                <label class="flex flex-col text-gray-600 font-medium"
                  >Duration (minutes):
                  <input
                    type="number"
                    v-model="msg.payload.duration"
                    class="border px-2 py-1.5 w-full rounded focus:outline-none focus:border-[#5C001F] font-normal text-black"
                  />
                </label>

                <div class="flex flex-col gap-1.5 mt-1">
                  <span class="text-xs font-bold text-gray-500 uppercase">Allowed Days:</span>
                  <div class="flex gap-1.5 mt-1">
                    <button
                      v-for="day in [
                        { label: 'M', value: 1 },
                        { label: 'T', value: 2 },
                        { label: 'W', value: 3 },
                        { label: 'T', value: 4 },
                        { label: 'F', value: 5 },
                        { label: 'S', value: 6 },
                        { label: 'S', value: 7 }
                      ]"
                      :key="day.value"
                      type="button"
                      @click="toggleWidgetAllowedDay(msg, day.value)"
                      class="w-7 h-7 rounded-full text-xs font-bold transition-all flex items-center justify-center cursor-pointer border"
                      :class="msg.payload.allowedDays?.includes(day.value)
                        ? 'bg-[#5C001F] text-[#f8be17] border-[#5C001F] shadow-sm'
                        : 'bg-white text-gray-400 border-gray-200'"
                    >
                      {{ day.label }}
                    </button>
                  </div>
                </div>

                <div class="flex justify-end gap-2 mt-2">
                  <button
                    @click="cancelAction(msg)"
                    class="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 font-semibold border-none cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    @click="executeAutoSchedule(msg)"
                    class="px-3 py-1.5 bg-[#5C001F] hover:bg-[#4a0019] text-white rounded font-bold border-none cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <span
                      v-if="msg.isExecuting"
                      class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                    ></span>
                    Auto-Schedule Now
                  </button>
                </div>
              </div>
            </div>
            <div v-if="msg.completed" class="w-full mt-2 text-sm text-green-600 font-bold px-2">
              ✓ Action Completed
            </div>
          </div>

          <!-- Loading Indicator -->
          <div v-if="isLoading" class="flex justify-start w-full">
            <div
              class="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-3 bg-white border border-gray-100 shadow-sm flex items-center gap-1.5"
            >
              <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
              <span
                class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                style="animation-delay: 0.15s"
              ></span>
              <span
                class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                style="animation-delay: 0.3s"
              ></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-3 bg-white border-t rounded-b-xl shrink-0 m-0 relative">
        <!-- Image Preview Thumbnail -->
        <div v-if="selectedImagePreview" class="mb-2 relative inline-block">
          <img
            :src="selectedImagePreview"
            class="h-16 w-16 object-cover rounded-lg border border-gray-200 shadow-sm"
          />
          <button
            @click="clearImage"
            type="button"
            class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 h-5 w-5 flex items-center justify-center border-none shadow-sm cursor-pointer hover:bg-red-600"
          >
            <X class="h-3 w-3" />
          </button>
        </div>

        <form @submit.prevent="sendMessage" class="flex w-full items-center gap-2">
          <!-- Hidden File Input -->
          <input
            type="file"
            ref="fileInputRef"
            @change="handleFileUpload"
            accept="image/*"
            class="hidden"
          />
          <!-- Upload Button -->
          <button
            type="button"
            @click="$refs.fileInputRef.click()"
            class="rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 shrink-0 h-10 w-10 flex items-center justify-center p-0 border-none cursor-pointer transition-colors"
            :disabled="isLoading"
            title="Upload Image for OCR"
          >
            <ImageIcon class="h-5 w-5" />
          </button>

          <input
            v-model="newMessage"
            placeholder="Ask or upload an image..."
            class="flex-1 focus:outline-none focus:ring-2 focus:ring-[#5C001F] rounded-full border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-500"
            :disabled="isLoading"
          />
          <button
            type="submit"
            class="rounded-full bg-[#5C001F] hover:bg-[#5C001F]/90 text-white shrink-0 shadow-sm h-10 w-10 flex items-center justify-center p-0 border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isLoading || (!newMessage.trim() && !selectedImagePreview)"
          >
            <Send class="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import axios from 'axios'
import { marked } from 'marked'

// Configure marked to render safe GitHub Flavored Markdown
marked.setOptions({
  gfm: true,
  breaks: true,
})

const renderMarkdown = (content) => {
  if (!content) return ''
  return marked.parse(content)
}

// Lucide Icons
import { Bot, Sparkles, Maximize2, Minimize2, X, Send, Image as ImageIcon } from 'lucide-vue-next'

// Widget State: 1 = Collapsed, 2 = Expanded, 3 = Maximized
const widgetState = ref(1)

// Chat State
const newMessage = ref('')
const isLoading = ref(false)
const selectedImagePreview = ref(null)
const selectedImageBase64 = ref(null)
const fileInputRef = ref(null)

const chatHistory = ref([
  {
    role: 'assistant',
    content: 'Hello! I am the I-FAMOUS AI Assistant. How can I help you today?',
  },
])

const scrollAreaRef = ref(null)

const toggleMaximize = () => {
  widgetState.value = widgetState.value === 2 ? 3 : 2
}

const scrollToBottom = async () => {
  await nextTick()
  const scrollElement = scrollAreaRef.value
  if (scrollElement) {
    scrollElement.scrollTop = scrollElement.scrollHeight
  }
}

const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    selectedImagePreview.value = e.target.result
    // Extract just the base64 string without the data URL prefix
    selectedImageBase64.value = e.target.result.split(',')[1]
  }
  reader.readAsDataURL(file)

  // Reset input so the same file can be selected again if cancelled
  event.target.value = ''
}

const clearImage = () => {
  selectedImagePreview.value = null
  selectedImageBase64.value = null
}

const sendMessage = async () => {
  const content = newMessage.value.trim()
  if ((!content && !selectedImageBase64.value) || isLoading.value) return

  const messagePayload = { role: 'user', content: content || 'Analyze this image.' }

  // Attach image if one is selected
  if (selectedImageBase64.value) {
    messagePayload.images = [selectedImageBase64.value]
  }

  chatHistory.value.push(messagePayload)

  // Clear inputs
  newMessage.value = ''
  selectedImagePreview.value = null
  const attachedBase64 = selectedImageBase64.value
  selectedImageBase64.value = null

  isLoading.value = true
  scrollToBottom()

  try {
    const token = localStorage.getItem('token')
    const response = await axios.post(
      'http://localhost:3000/api/assistant/chat',
      {
        messages: chatHistory.value,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )

    if (response.data.success && response.data.reply) {
      chatHistory.value.push(response.data.reply)
    } else {
      chatHistory.value.push({
        role: 'assistant',
        content: "I'm sorry, I received an invalid response from the server.",
      })
    }
  } catch (error) {
    console.error('Chat error:', error)
    chatHistory.value.push({
      role: 'assistant',
      content: 'Sorry, the AI Assistant is currently unavailable.',
    })
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

const cancelAction = (msg) => {
  msg.completed = true
  chatHistory.value.push({ role: 'assistant', content: 'Action cancelled.' })
  scrollToBottom()
}

const executeCreateUser = async (msg) => {
  msg.isExecuting = true
  try {
    const token = localStorage.getItem('token')
    const response = await axios.post(
      'http://localhost:3000/api/assistant/execute-user-creation',
      msg.payload,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )

    if (response.data.success) {
      msg.completed = true
      chatHistory.value.push({
        role: 'assistant',
        content: 'Success! The user was created successfully in the database.',
      })
    } else {
      chatHistory.value.push({
        role: 'assistant',
        content: `Error: ${response.data.error || 'Failed to create user.'}`,
      })
    }
  } catch (error) {
    chatHistory.value.push({
      role: 'assistant',
      content: `Error: ${error.response?.data?.error || 'Could not connect to server.'}`,
    })
  } finally {
    msg.isExecuting = false
    scrollToBottom()
  }
}

const executeAutoSchedule = async (msg) => {
  msg.isExecuting = true
  try {
    const token = localStorage.getItem('token')
    const response = await axios.post(
      'http://localhost:3000/api/timetable/auto-assign',
      {
        startDate: msg.payload.startDate,
        endDate: msg.payload.endDate,
        duration: msg.payload.duration || 10,
        allowedDays: msg.payload.allowedDays || [1, 2, 3, 4, 5],
        avoidWeekend: true,
        avoidOffWorkingHour: true,
        workingHourStart: '08:00',
        workingHourEnd: '17:00',
        avoidLunchHour: true,
        lunchHourStart: '13:00',
        lunchHourEnd: '14:00',
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )

    if (response.data.success) {
      msg.completed = true
      const count = response.data.data.length
      const total = response.data.totalProjects
      const unscheduled = response.data.unscheduledProjects.length

      let replyMsg = `Successfully auto-scheduled **${count}/${total}** FYP project meetings.`
      if (unscheduled > 0) {
        replyMsg += `\n\n⚠️ **${unscheduled}** project(s) could not be scheduled due to conflicts.`
      }
      chatHistory.value.push({ role: 'assistant', content: replyMsg })

      // Dispatch event to reactive listeners (like CreateMeetingView) to fetch new data
      window.dispatchEvent(new CustomEvent('temp-meetings-updated'))
    } else {
      chatHistory.value.push({
        role: 'assistant',
        content: `Error: ${response.data.error || 'Failed to auto-schedule.'}`,
      })
    }
  } catch (error) {
    chatHistory.value.push({
      role: 'assistant',
      content: `Error: ${error.response?.data?.error || 'Could not connect to server.'}`,
    })
  } finally {
    msg.isExecuting = false
    scrollToBottom()
  }
}

const toggleWidgetAllowedDay = (msg, val) => {
  if (!msg.payload.allowedDays) {
    msg.payload.allowedDays = [1, 2, 3, 4, 5]
  }
  if (msg.payload.allowedDays.includes(val)) {
    if (msg.payload.allowedDays.length > 1) {
      msg.payload.allowedDays = msg.payload.allowedDays.filter(d => d !== val)
    }
  } else {
    msg.payload.allowedDays.push(val)
  }
}
</script>

<style scoped>
.markdown-body :deep(p) {
  margin: 0 0 8px 0;
}
.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0 0 8px 0;
  padding-left: 20px;
}
.markdown-body :deep(ul) {
  list-style-type: disc;
}
.markdown-body :deep(ol) {
  list-style-type: decimal;
}
.markdown-body :deep(li) {
  margin-bottom: 4px;
}
.markdown-body :deep(strong) {
  font-weight: 600;
}
.markdown-body :deep(code) {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9em;
}
.markdown-body :deep(pre) {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 8px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
}
.markdown-body :deep(pre code) {
  background-color: transparent;
  padding: 0;
}
.markdown-body :deep(a) {
  color: #f8be17;
  text-decoration: underline;
}
/* Ensure code snippets and lists look good inside user's maroon message bubbles */
.bg-\[\#5C001F\] :deep(code) {
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
}
.bg-\[\#5C001F\] :deep(pre) {
  background-color: rgba(255, 255, 255, 0.1);
}
.bg-\[\#5C001F\] :deep(a) {
  color: #f8be17;
}
</style>
