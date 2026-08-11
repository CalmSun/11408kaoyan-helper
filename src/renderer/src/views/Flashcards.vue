<template>
  <div class="flashcards-page fade-in">
    <div class="page-header">
      <div>
        <h1 class="page-title">背诵卡片</h1>
        <p class="page-subtitle">共 {{ store.flashcards.length }} 张卡片，已复习 {{ totalReviewCount }} 次</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="showAddDialog = true">
          <el-icon><Plus /></el-icon>
          添加卡片
        </el-button>
        <el-button @click="startReview" v-if="store.flashcards.length > 0">
          <el-icon><VideoPlay /></el-icon>
          开始背诵
        </el-button>
      </div>
    </div>

    <!-- 分类筛选 -->
    <div class="filter-bar">
      <div class="category-tabs">
        <div
          class="tab-item"
          :class="{ active: currentCategory === 'all' }"
          @click="currentCategory = 'all'"
        >
          全部
        </div>
        <div
          v-for="cat in categories"
          :key="cat"
          class="tab-item"
          :class="{ active: currentCategory === cat }"
          @click="currentCategory = cat"
        >
          {{ cat }}
        </div>
      </div>
      <el-input
        v-model="searchKeyword"
        placeholder="搜索卡片..."
        style="width: 200px;"
        clearable
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <!-- 卡片列表 -->
    <div class="cards-grid" v-if="filteredCards.length > 0">
      <div
        v-for="card in filteredCards"
        :key="card.id"
        class="flashcard-item"
        @click="flipCard(card.id)"
      >
        <div class="card-inner" :class="{ flipped: flippedCards.has(card.id) }">
          <div class="card-front">
            <el-tag size="small" class="card-category">{{ card.category }}</el-tag>
            <p class="card-text">{{ card.front }}</p>
            <span class="flip-hint">点击翻面</span>
          </div>
          <div class="card-back">
            <p class="card-text">{{ card.back }}</p>
          </div>
        </div>
        <div class="card-footer">
          <span class="review-count">
            <el-icon><View /></el-icon>
            复习 {{ card.reviewCount }} 次
          </span>
          <div class="card-actions">
            <el-button
              type="danger"
              link
              size="small"
              @click.stop="deleteCard(card.id)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="empty-state" v-else>
      <el-icon :size="64" color="#b0b6bd"><Collection /></el-icon>
      <p class="empty-text">还没有背诵卡片，添加一些吧~</p>
      <el-button type="primary" @click="showAddDialog = true">添加卡片</el-button>
    </div>

    <!-- 添加卡片弹窗 -->
    <el-dialog
      v-model="showAddDialog"
      title="添加背诵卡片"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="addForm" label-width="80px">
        <el-form-item label="分类">
          <el-select
            v-model="addForm.category"
            placeholder="选择或输入分类"
            filterable
            allow-create
            default-first-option
            style="width: 100%;"
          >
            <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
            <el-option label="政治" value="政治" />
            <el-option label="英语" value="英语" />
            <el-option label="数学" value="数学" />
            <el-option label="数据结构" value="数据结构" />
            <el-option label="组成原理" value="组成原理" />
            <el-option label="操作系统" value="操作系统" />
            <el-option label="计算机网络" value="计算机网络" />
          </el-select>
        </el-form-item>
        <el-form-item label="正面">
          <el-input
            v-model="addForm.front"
            placeholder="正面内容（问题/单词）"
            type="textarea"
            :rows="3"
          />
        </el-form-item>
        <el-form-item label="背面">
          <el-input
            v-model="addForm.back"
            placeholder="背面内容（答案/释义）"
            type="textarea"
            :rows="3"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAdd">确认添加</el-button>
      </template>
    </el-dialog>

    <!-- 背诵模式弹窗 -->
    <el-dialog
      v-model="showReviewDialog"
      title="背诵模式"
      width="600px"
      :close-on-click-modal="false"
      :show-close="false"
      class="review-dialog"
    >
      <div class="review-progress">
        <span>{{ currentReviewIndex + 1 }} / {{ reviewCards.length }}</span>
        <el-progress
          :percentage="reviewProgress"
          :show-text="false"
          :stroke-width="6"
          style="flex: 1; margin: 0 16px;"
        />
        <el-button link type="primary" @click="showReviewDialog = false">退出</el-button>
      </div>

      <div class="review-card" @click="isFlipped = !isFlipped">
        <div class="review-card-inner" :class="{ flipped: isFlipped }">
          <div class="review-front">
            <el-tag size="small" class="card-category">{{ currentReviewCard?.category }}</el-tag>
            <p class="review-text">{{ currentReviewCard?.front }}</p>
            <span class="flip-hint">点击查看答案</span>
          </div>
          <div class="review-back">
            <p class="review-text">{{ currentReviewCard?.back }}</p>
            <span class="flip-hint">点击返回</span>
          </div>
        </div>
      </div>

      <div class="review-actions">
        <el-button size="large" @click="prevCard" :disabled="currentReviewIndex === 0">
          <el-icon><ArrowLeft /></el-icon>
          上一张
        </el-button>
        <el-button
          type="danger"
          size="large"
          @click="markWrong"
          :disabled="!isFlipped"
        >
          <el-icon><Close /></el-icon>
          没记住
        </el-button>
        <el-button
          type="success"
          size="large"
          @click="markCorrect"
          :disabled="!isFlipped"
        >
          <el-icon><Check /></el-icon>
          记住了
        </el-button>
        <el-button
          size="large"
          @click="nextCard"
          :disabled="currentReviewIndex >= reviewCards.length - 1"
        >
          下一张
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useMainStore, Flashcard } from '@/stores'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Search,
  View,
  Delete,
  Collection,
  VideoPlay,
  ArrowLeft,
  ArrowRight,
  Check,
  Close
} from '@element-plus/icons-vue'

const store = useMainStore()

const currentCategory = ref('all')
const searchKeyword = ref('')
const showAddDialog = ref(false)
const showReviewDialog = ref(false)
const flippedCards = ref(new Set<string>())

const addForm = reactive({
  category: '',
  front: '',
  back: ''
})

// 背诵模式状态
const reviewCards = ref<Flashcard[]>([])
const currentReviewIndex = ref(0)
const isFlipped = ref(false)

const categories = computed(() => {
  const set = new Set(store.flashcards.map(c => c.category))
  return Array.from(set)
})

const filteredCards = computed(() => {
  let result = store.flashcards
  
  if (currentCategory.value !== 'all') {
    result = result.filter(c => c.category === currentCategory.value)
  }
  
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(c =>
      c.front.toLowerCase().includes(keyword) ||
      c.back.toLowerCase().includes(keyword)
    )
  }
  
  return result
})

const totalReviewCount = computed(() => {
  return store.flashcards.reduce((sum, c) => sum + c.reviewCount, 0)
})

const currentReviewCard = computed(() => reviewCards.value[currentReviewIndex.value])

const reviewProgress = computed(() => {
  if (reviewCards.value.length === 0) return 0
  return Math.round(((currentReviewIndex.value + 1) / reviewCards.value.length) * 100)
})

function flipCard(id: string) {
  if (flippedCards.value.has(id)) {
    flippedCards.value.delete(id)
  } else {
    flippedCards.value.add(id)
  }
  // 触发响应式更新
  flippedCards.value = new Set(flippedCards.value)
}

function handleAdd() {
  if (!addForm.category.trim()) {
    ElMessage.warning('请输入分类')
    return
  }
  if (!addForm.front.trim()) {
    ElMessage.warning('请输入正面内容')
    return
  }
  if (!addForm.back.trim()) {
    ElMessage.warning('请输入背面内容')
    return
  }
  
  store.addFlashcard({
    category: addForm.category.trim(),
    front: addForm.front.trim(),
    back: addForm.back.trim()
  })
  
  ElMessage.success('添加成功')
  showAddDialog.value = false
  addForm.category = ''
  addForm.front = ''
  addForm.back = ''
}

function deleteCard(id: string) {
  ElMessageBox.confirm('确定要删除这张卡片吗？', '提示', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    store.deleteFlashcard(id)
    ElMessage.success('删除成功')
  }).catch(() => {})
}

function startReview() {
  // Fisher-Yates 洗牌算法
  const cards = [...filteredCards.value]
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  reviewCards.value = cards
  currentReviewIndex.value = 0
  isFlipped.value = false
  showReviewDialog.value = true
}

function prevCard() {
  if (currentReviewIndex.value > 0) {
    currentReviewIndex.value--
    isFlipped.value = false
  }
}

function nextCard() {
  if (currentReviewIndex.value < reviewCards.value.length - 1) {
    currentReviewIndex.value++
    isFlipped.value = false
  }
}

function markWrong() {
  if (currentReviewCard.value) {
    store.updateFlashcard(currentReviewCard.value.id, {
      reviewCount: currentReviewCard.value.reviewCount + 1
    })
  }
  nextCard()
}

function markCorrect() {
  if (currentReviewCard.value) {
    store.updateFlashcard(currentReviewCard.value.id, {
      reviewCount: currentReviewCard.value.reviewCount + 1,
      correctCount: currentReviewCard.value.correctCount + 1
    })
  }
  nextCard()
}
</script>

<style scoped>
.flashcards-page {
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--mo-text-1);
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 14px;
  color: var(--mo-text-3);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* 筛选栏 */
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(14px) saturate(1.3);
  -webkit-backdrop-filter: blur(14px) saturate(1.3);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.category-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tab-item {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--mo-text-2);
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--mo-surface);
}

.tab-item:hover {
  background: rgba(255, 255, 255, 0.6);
}

.tab-item.active {
  background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
  color: #fff;
}

/* 卡片网格 */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}

.flashcard-item {
  cursor: pointer;
}

.card-inner {
  position: relative;
  width: 100%;
  height: 200px;
  transition: transform 0.6s;
  transform-style: preserve-3d;
}

.card-inner.flipped {
  transform: rotateY(180deg);
}

.card-front,
.card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.card-front {
  background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
  color: #fff;
}

.card-back {
  background: var(--glass-bg);
  backdrop-filter: blur(14px) saturate(1.3);
  -webkit-backdrop-filter: blur(14px) saturate(1.3);
  border: 1px solid var(--glass-border);
  color: var(--mo-text-1);
  transform: rotateY(180deg);
  border: 2px solid rgba(255, 255, 255, 0.6);
}

.card-category {
  align-self: flex-start;
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #fff;
}

.card-back .card-category {
  background: rgba(150, 158, 170, 0.10);
  color: var(--mo-text-2);
}

.card-text {
  flex: 1;
  font-size: 16px;
  line-height: 1.6;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  margin: 0;
  word-break: break-word;
}

.flip-hint {
  font-size: 12px;
  opacity: 0.7;
  text-align: center;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 4px 0;
  font-size: 12px;
  color: var(--mo-text-3);
}

.review-count {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 16px;
  background: var(--glass-bg);
  backdrop-filter: blur(14px) saturate(1.3);
  -webkit-backdrop-filter: blur(14px) saturate(1.3);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
}

.empty-text {
  color: var(--mo-text-3);
  font-size: 14px;
  margin: 0;
}

/* 背诵模式弹窗 */
.review-dialog :deep(.el-dialog__body) {
  padding-top: 0;
}

.review-progress {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
  font-size: 14px;
  color: var(--mo-text-2);
}

.review-card {
  perspective: 1000px;
  margin-bottom: 24px;
  cursor: pointer;
}

.review-card-inner {
  position: relative;
  width: 100%;
  height: 300px;
  transition: transform 0.6s;
  transform-style: preserve-3d;
}

.review-card-inner.flipped {
  transform: rotateY(180deg);
}

.review-front,
.review-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 16px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.review-front {
  background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
  color: #fff;
}

.review-back {
  background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%);
  color: var(--mo-text-1);
  transform: rotateY(180deg);
}

.review-text {
  font-size: 22px;
  line-height: 1.8;
  text-align: center;
  margin: 20px 0;
  word-break: break-word;
}

.review-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>
