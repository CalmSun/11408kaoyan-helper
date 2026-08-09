<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <h1 class="login-title">考研助手</h1>
        <p class="login-subtitle">{{ isLoginMode ? '登录你的账号' : '创建新账号' }}</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="0"
        class="login-form"
      >
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="用户名"
            size="large"
            :prefix-icon="User"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            size="large"
            show-password
            :prefix-icon="Lock"
          />
        </el-form-item>

        <el-form-item v-if="!isLoginMode" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="确认密码"
            size="large"
            show-password
            :prefix-icon="Lock"
          />
        </el-form-item>

        <div v-if="isLoginMode" class="migrate-option">
          <el-checkbox v-model="migrateGuestData">
            登录时导入游客模式下的数据
          </el-checkbox>
        </div>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            class="login-btn"
            :loading="loading"
            @click="handleSubmit"
          >
            {{ isLoginMode ? '登录' : '注册' }}
          </el-button>
        </el-form-item>
      </el-form>

      <div class="login-footer">
        <span>{{ isLoginMode ? '还没有账号？' : '已有账号？' }}</span>
        <el-link type="primary" @click="toggleMode">
          {{ isLoginMode ? '立即注册' : '返回登录' }}
        </el-link>
      </div>

      <div class="guest-link">
        <el-link type="info" @click="continueAsGuest">
          继续以游客身份使用
        </el-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import type { FormInstance, FormRules } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()

const formRef = ref<FormInstance>()
const isLoginMode = ref(true)
const loading = ref(false)
const migrateGuestData = ref(true)

const form = reactive({
  username: '',
  password: '',
  confirmPassword: ''
})

const validateConfirmPassword = (_rule: any, value: string, callback: any) => {
  if (!isLoginMode.value && value !== form.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules = reactive<FormRules>({
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 20, message: '用户名长度在 2 到 20 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 4, message: '密码长度至少 4 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
})

const toggleMode = () => {
  isLoginMode.value = !isLoginMode.value
  formRef.value?.clearValidate()
  form.password = ''
  form.confirmPassword = ''
}

const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate((valid) => {
    if (!valid) return

    loading.value = true

    if (isLoginMode.value) {
      // 登录
      const result = userStore.login(form.username, form.password, migrateGuestData.value)
      if (result.success) {
        ElMessage.success('登录成功')
        router.push('/')
      } else {
        ElMessage.error(result.message)
      }
    } else {
      // 注册
      const result = userStore.register(form.username, form.password)
      if (result.success) {
        ElMessage.success('注册成功，请登录')
        isLoginMode.value = true
        form.password = ''
        form.confirmPassword = ''
      } else {
        ElMessage.error(result.message)
      }
    }

    loading.value = false
  })
}

const continueAsGuest = () => {
  userStore.logout()
  router.push('/')
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: white;
  border-radius: 16px;
  padding: 48px 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.login-header {
  text-align: center;
  margin-bottom: 40px;
}

.login-title {
  font-size: 32px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 8px 0;
}

.login-subtitle {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.login-form {
  margin-bottom: 24px;
}

.migrate-option {
  margin-bottom: 20px;
  text-align: center;
}

.login-btn {
  width: 100%;
  font-size: 16px;
  height: 44px;
}

.login-footer {
  text-align: center;
  margin-bottom: 16px;
  font-size: 14px;
  color: #606266;
}

.login-footer .el-link {
  margin-left: 4px;
}

.guest-link {
  text-align: center;
}
</style>
