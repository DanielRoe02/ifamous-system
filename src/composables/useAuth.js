import { ref } from 'vue'

// Initialize user state from local storage if it exists
const user = ref(JSON.parse(localStorage.getItem('userSession')) || null)
const token = ref(localStorage.getItem('token') || null)

export function useAuth() {
  const login = (userData, authToken) => {
    user.value = userData
    token.value = authToken
    localStorage.setItem('userSession', JSON.stringify(userData))
    localStorage.setItem('token', authToken)
  }

  const logout = () => {
    user.value = null
    token.value = null
    localStorage.removeItem('userSession')
    localStorage.removeItem('token')
  }

  return {
    user,
    token,
    login,
    logout,
  }
}
