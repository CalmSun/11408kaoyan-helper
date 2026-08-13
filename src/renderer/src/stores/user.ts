import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  getCurrentUsername,
  setCurrentUsername,
  registerUser,
  authenticateUser,
  migrateGuestData,
  getUserList,
  deleteUserAccount,
  onStorageReady
} from '@/utils/storage'

export const useUserStore = defineStore('user', () => {
  const currentUsername = ref(getCurrentUsername())
  const userList = ref(getUserList())

  // v2.9.0：存储层就绪后刷新当前用户（修复重启掉登录：
  // store 初始化时 IndexedDB 可能尚未载入，getCurrentUsername 读到空值，
  // 就绪后需同步刷新 ref，否则路由守卫虽放行但顶栏/用户态仍显示游客）
  function refreshCurrentUser() {
    currentUsername.value = getCurrentUsername()
    userList.value = getUserList()
  }
  onStorageReady(refreshCurrentUser)

  const isLoggedIn = computed(() => !!currentUsername.value)
  const displayName = computed(() => currentUsername.value || '游客')

  function refreshUserList() {
    userList.value = getUserList()
  }

  /** 注册 */
  function register(username: string, password: string): { success: boolean; message: string } {
    const result = registerUser(username, password)
    if (result.success) {
      refreshUserList()
    }
    return result
  }

  /** 登录 */
  function login(username: string, password: string, migrateData: boolean): { success: boolean; message: string } {
    const result = authenticateUser(username, password)
    if (result.success) {
      if (migrateData) {
        migrateGuestData(username)
      }
      setCurrentUsername(username)
      currentUsername.value = username
    }
    return result
  }

  /** 登出（回到游客模式） */
  function logout() {
    setCurrentUsername('')
    currentUsername.value = ''
  }

  /** 删除当前账号 */
  function deleteAccount(username: string): boolean {
    if (!username) return false
    deleteUserAccount(username)
    if (currentUsername.value === username) {
      currentUsername.value = ''
    }
    refreshUserList()
    return true
  }

  return {
    currentUsername,
    userList,
    isLoggedIn,
    displayName,
    register,
    login,
    logout,
    deleteAccount,
    refreshUserList,
    refreshCurrentUser
  }
})
