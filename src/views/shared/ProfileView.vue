<script setup>
import { onMounted, reactive, ref } from 'vue'
import { Loader2, Save, UserRound } from 'lucide-vue-next'
import AppHeader from '@/components/AppHeader.vue'
import RoleSidebar from '@/components/RoleSidebar.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import { api, roleFlags } from '@/services/ifamousApi'

const roles = roleFlags()
const loading = ref(true)
const saving = ref(false)
const message = ref('')
const error = ref('')
const form = reactive({
  fullName: '', phoneNumber: '', companyName: '', expertise: '', affiliation: '',
  department: '', organisation: '', biography: '', profilePhotoUrl: '', professionalLink: '',
  isAvailable: true, supervisorSpecialisation: '', examinerSpecialisation: '',
})

onMounted(async () => {
  try {
    const profile = (await api.get('/profile')).data.profile || {}
    Object.assign(form, {
      fullName: profile.full_name || '', phoneNumber: profile.phone_number || '', companyName: profile.company_name || '',
      expertise: profile.expertise || '', affiliation: profile.affiliation || '', department: profile.department || '',
      organisation: profile.organisation || '', biography: profile.biography || '', profilePhotoUrl: profile.profile_photo_url || '',
      professionalLink: profile.professional_link || '', isAvailable: Number(profile.is_available ?? 1) === 1,
      supervisorSpecialisation: profile.supervisor_specialisation || '', examinerSpecialisation: profile.examiner_specialisation || '',
    })
  } catch (err) { error.value = err.response?.data?.error || err.message }
  finally { loading.value = false }
})

async function save() {
  saving.value = true; error.value = ''; message.value = ''
  try { await api.patch('/profile', form); message.value = 'Profile updated successfully.' }
  catch (err) { error.value = err.response?.data?.error || err.message }
  finally { saving.value = false }
}
</script>

<template>
  <div class="min-h-screen bg-[#e7ded3]"><AppHeader /><div class="flex"><AppSidebar v-if="roles.isCoordinator" /><RoleSidebar v-else :role="roles.isStudent ? 'Student' : 'Staff'" /><main class="flex-1 p-8 space-y-6">
    <section class="bg-[#5c001f] text-white rounded-[30px] p-8 shadow-xl"><p class="text-[#f8be17] font-bold uppercase tracking-[0.2em] flex gap-2"><UserRound class="w-5 h-5" /> My Profile</p><h1 class="text-4xl font-bold mt-2">Professional and FYP Profile</h1><p class="text-white/75 mt-2">Expertise and availability support supervisor and examiner recommendations.</p></section>
    <div v-if="loading" class="bg-white rounded-2xl p-10"><Loader2 class="animate-spin mx-auto text-[#5c001f]" /></div>
    <form v-else @submit.prevent="save" class="bg-white rounded-[26px] p-7 shadow space-y-6"><div v-if="message" class="bg-green-50 text-green-800 p-4 rounded-xl font-bold">{{ message }}</div><div v-if="error" class="bg-red-50 text-red-800 p-4 rounded-xl font-bold">{{ error }}</div><div class="grid grid-cols-1 lg:grid-cols-2 gap-5"><label class="space-y-2"><span class="font-bold">Full name</span><input v-model="form.fullName" class="w-full border rounded-xl px-4 py-3" /></label><label class="space-y-2"><span class="font-bold">Phone number</span><input v-model="form.phoneNumber" class="w-full border rounded-xl px-4 py-3" /></label><label class="space-y-2"><span class="font-bold">Department</span><input v-model="form.department" class="w-full border rounded-xl px-4 py-3" /></label><label class="space-y-2"><span class="font-bold">Organisation / Company</span><input v-model="form.organisation" class="w-full border rounded-xl px-4 py-3" /></label><label class="space-y-2 lg:col-span-2"><span class="font-bold">Expertise</span><input v-model="form.expertise" class="w-full border rounded-xl px-4 py-3" placeholder="AI, software engineering, IoT..." /></label><label v-if="roles.isSupervisor" class="space-y-2"><span class="font-bold">Supervisor specialisation</span><input v-model="form.supervisorSpecialisation" class="w-full border rounded-xl px-4 py-3" /></label><label v-if="roles.isExaminer" class="space-y-2"><span class="font-bold">Examiner specialisation</span><input v-model="form.examinerSpecialisation" class="w-full border rounded-xl px-4 py-3" /></label><label class="space-y-2 lg:col-span-2"><span class="font-bold">Biography</span><textarea v-model="form.biography" class="w-full border rounded-xl px-4 py-3 min-h-32" /></label><label class="space-y-2"><span class="font-bold">Professional link</span><input v-model="form.professionalLink" class="w-full border rounded-xl px-4 py-3" placeholder="https://..." /></label><label class="space-y-2"><span class="font-bold">Profile photo URL</span><input v-model="form.profilePhotoUrl" class="w-full border rounded-xl px-4 py-3" placeholder="https://..." /></label></div><label v-if="roles.isSupervisor || roles.isExaminer" class="flex items-center gap-3 font-bold"><input v-model="form.isAvailable" type="checkbox" class="w-5 h-5" /> Available for new assignments</label><button type="submit" :disabled="saving" class="bg-[#5c001f] text-white rounded-xl px-6 py-3 font-bold inline-flex gap-2"><Loader2 v-if="saving" class="w-5 h-5 animate-spin" /><Save v-else class="w-5 h-5" /> Save profile</button></form>
  </main></div></div>
</template>
