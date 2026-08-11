<script setup lang="ts">
/**
 * GlassCard 全局玻璃卡片组件（v7 厚重磨砂玻璃）
 * - 视觉参数全部来自 style.css 的 --glass-* 变量，一处调参全站生效
 * - variant: card（默认页面容器）/ strong（弹窗级）/ lite（无滤镜轻量面，长列表用）
 * - 自身只占一层 backdrop-filter，禁止在 GlassCard 内再嵌套 GlassCard（嵌套区请改用 lite）
 */
interface Props {
  variant?: 'card' | 'strong' | 'lite'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'card'
})

const variantClass = `glass-card--${props.variant}`
</script>

<template>
  <div class="glass-card" :class="variantClass">
    <slot />
  </div>
</template>

<style scoped>
/* 组件内仅做结构占位，全部视觉由全局 .glass-card 工具类承载（便于降级覆盖） */
</style>
