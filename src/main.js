import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { setupAuthInterceptor } from './utils/authInterceptor'
import './assets/main.css'

setupAuthInterceptor(router)

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

