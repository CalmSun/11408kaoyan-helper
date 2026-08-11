<template>
  <div class="algorithms-page fade-in">
    <div class="page-header">
      <div>
        <h1 class="page-title">算法模板库</h1>
        <p class="page-subtitle">数据结构常用算法代码模板 · 复制即用</p>
      </div>
      <el-button type="primary" @click="showAddDialog = true">
        <el-icon><Plus /></el-icon>
        添加模板
      </el-button>
    </div>

    <!-- 搜索和筛选 -->
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
        placeholder="搜索算法..."
        style="width: 220px;"
        clearable
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <!-- 算法列表 -->
    <div class="algorithms-grid" v-if="filteredAlgorithms.length > 0">
      <div
        v-for="algo in filteredAlgorithms"
        :key="algo.id"
        class="algo-card"
        @click="showAlgoDetail(algo)"
      >
        <div class="algo-header">
          <h3 class="algo-name">{{ algo.name }}</h3>
          <el-tag size="small" type="primary">{{ algo.category }}</el-tag>
        </div>
        <p class="algo-desc">{{ algo.description }}</p>
        <div class="algo-meta">
          <div class="meta-item">
            <span class="meta-label">时间</span>
            <span class="meta-value">{{ algo.timeComplexity }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">空间</span>
            <span class="meta-value">{{ algo.spaceComplexity }}</span>
          </div>
        </div>
        <div class="algo-tags">
          <span v-for="tag in algo.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="empty-state" v-else>
      <el-icon :size="64" color="#b0b6bd"><Cpu /></el-icon>
      <p class="empty-text">没有找到相关算法</p>
    </div>

    <!-- 算法详情弹窗 -->
    <el-dialog
      v-model="showDetail"
      :title="currentAlgo?.name"
      width="700px"
      class="algo-detail-dialog"
    >
      <div class="algo-detail" v-if="currentAlgo">
        <div class="detail-meta">
          <el-tag type="primary">{{ currentAlgo.category }}</el-tag>
          <span class="meta-text">
            时间复杂度: <strong>{{ currentAlgo.timeComplexity }}</strong>
          </span>
          <span class="meta-text">
            空间复杂度: <strong>{{ currentAlgo.spaceComplexity }}</strong>
          </span>
        </div>

        <div class="detail-section">
          <h4>算法描述</h4>
          <p>{{ currentAlgo.description }}</p>
        </div>

        <div class="detail-section">
          <div class="section-header">
            <h4>代码模板</h4>
            <el-button type="primary" link size="small" @click="copyCode">
              <el-icon><CopyDocument /></el-icon>
              复制代码
            </el-button>
          </div>
          <pre class="code-block"><code>{{ currentAlgo.code }}</code></pre>
        </div>

        <div class="detail-tags" v-if="currentAlgo.tags.length > 0">
          <span v-for="tag in currentAlgo.tags" :key="tag" class="tag">
            {{ tag }}
          </span>
        </div>
      </div>
    </el-dialog>

    <!-- 添加模板弹窗 -->
    <el-dialog
      v-model="showAddDialog"
      title="添加算法模板"
      width="600px"
    >
      <el-form :model="addForm" label-width="90px">
        <el-form-item label="算法名称">
          <el-input v-model="addForm.name" placeholder="如：快速排序" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="addForm.category" placeholder="选择分类" style="width: 100%;">
            <el-option label="排序算法" value="排序" />
            <el-option label="查找算法" value="查找" />
            <el-option label="链表操作" value="链表" />
            <el-option label="树与二叉树" value="树" />
            <el-option label="图算法" value="图" />
            <el-option label="动态规划" value="DP" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="addForm.description"
            placeholder="算法简要描述"
            type="textarea"
            :rows="2"
          />
        </el-form-item>
        <el-form-item label="时间复杂度">
          <el-input v-model="addForm.timeComplexity" placeholder="如：O(nlogn)" />
        </el-form-item>
        <el-form-item label="空间复杂度">
          <el-input v-model="addForm.spaceComplexity" placeholder="如：O(logn)" />
        </el-form-item>
        <el-form-item label="代码">
          <el-input
            v-model="addForm.code"
            placeholder="粘贴代码模板..."
            type="textarea"
            :rows="10"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAdd">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Search, Cpu, CopyDocument } from '@element-plus/icons-vue'

interface Algorithm {
  id: string
  name: string
  category: string
  description: string
  code: string
  timeComplexity: string
  spaceComplexity: string
  tags: string[]
}

const currentCategory = ref('all')
const searchKeyword = ref('')
const showDetail = ref(false)
const showAddDialog = ref(false)
const currentAlgo = ref<Algorithm | null>(null)

const addForm = reactive({
  name: '',
  category: '',
  description: '',
  timeComplexity: '',
  spaceComplexity: '',
  code: ''
})

// 内置算法模板
const builtinAlgorithms: Algorithm[] = [
  // 排序算法
  {
    id: '1',
    name: '快速排序',
    category: '排序',
    description: '基于分治思想的高效排序算法，平均时间复杂度O(nlogn)',
    timeComplexity: 'O(nlogn)',
    spaceComplexity: 'O(logn)',
    tags: ['分治', '递归', '不稳定'],
    code: `void quickSort(vector<int>& nums, int left, int right) {
    if (left >= right) return;
    int pivot = nums[left + (right - left) / 2];
    int i = left, j = right;
    while (i <= j) {
        while (nums[i] < pivot) i++;
        while (nums[j] > pivot) j--;
        if (i <= j) {
            swap(nums[i], nums[j]);
            i++;
            j--;
        }
    }
    quickSort(nums, left, j);
    quickSort(nums, i, right);
}`
  },
  {
    id: '2',
    name: '归并排序',
    category: '排序',
    description: '稳定的分治排序算法，时间复杂度稳定O(nlogn)',
    timeComplexity: 'O(nlogn)',
    spaceComplexity: 'O(n)',
    tags: ['分治', '递归', '稳定'],
    code: `void mergeSort(vector<int>& nums, int left, int right) {
    if (left >= right) return;
    int mid = left + (right - left) / 2;
    mergeSort(nums, left, mid);
    mergeSort(nums, mid + 1, right);
    
    vector<int> temp(right - left + 1);
    int i = left, j = mid + 1, k = 0;
    while (i <= mid && j <= right) {
        if (nums[i] <= nums[j]) temp[k++] = nums[i++];
        else temp[k++] = nums[j++];
    }
    while (i <= mid) temp[k++] = nums[i++];
    while (j <= right) temp[k++] = nums[j++];
    
    for (int p = 0; p < temp.size(); p++) {
        nums[left + p] = temp[p];
    }
}`
  },
  {
    id: '3',
    name: '堆排序',
    category: '排序',
    description: '基于堆数据结构的选择排序，原地排序O(nlogn)',
    timeComplexity: 'O(nlogn)',
    spaceComplexity: 'O(1)',
    tags: ['堆', '选择', '不稳定'],
    code: `void heapify(vector<int>& nums, int n, int i) {
    int largest = i;
    int left = 2 * i + 1;
    int right = 2 * i + 2;
    
    if (left < n && nums[left] > nums[largest]) largest = left;
    if (right < n && nums[right] > nums[largest]) largest = right;
    
    if (largest != i) {
        swap(nums[i], nums[largest]);
        heapify(nums, n, largest);
    }
}

void heapSort(vector<int>& nums) {
    int n = nums.size();
    for (int i = n / 2 - 1; i >= 0; i--) {
        heapify(nums, n, i);
    }
    for (int i = n - 1; i > 0; i--) {
        swap(nums[0], nums[i]);
        heapify(nums, i, 0);
    }
}`
  },
  // 查找算法
  {
    id: '4',
    name: '二分查找',
    category: '查找',
    description: '有序数组的高效查找算法，时间复杂度O(logn)',
    timeComplexity: 'O(logn)',
    spaceComplexity: 'O(1)',
    tags: ['有序数组', '迭代'],
    code: `// 基础二分查找
int binarySearch(vector<int>& nums, int target) {
    int left = 0, right = nums.size() - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] == target) return mid;
        else if (nums[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;
}

// 查找左边界
int leftBound(vector<int>& nums, int target) {
    int left = 0, right = nums.size();
    while (left < right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] < target) left = mid + 1;
        else right = mid;
    }
    return left;
}`
  },
  // 链表
  {
    id: '5',
    name: '反转链表',
    category: '链表',
    description: '反转单链表，迭代和递归两种实现',
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(1)',
    tags: ['单链表', '迭代/递归'],
    code: `// 迭代法
ListNode* reverseList(ListNode* head) {
    ListNode* prev = nullptr;
    ListNode* curr = head;
    while (curr) {
        ListNode* next = curr->next;
        curr->next = prev;
        prev = curr;
        curr = next;
    }
    return prev;
}

// 递归法
ListNode* reverseList(ListNode* head) {
    if (!head || !head->next) return head;
    ListNode* newHead = reverseList(head->next);
    head->next->next = head;
    head->next = nullptr;
    return newHead;
}`
  },
  {
    id: '6',
    name: '链表判环',
    category: '链表',
    description: ' Floyd判圈算法（快慢指针），检测链表是否有环',
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(1)',
    tags: ['快慢指针', 'Floyd算法'],
    code: `// 判断是否有环
bool hasCycle(ListNode* head) {
    ListNode* slow = head;
    ListNode* fast = head;
    while (fast && fast->next) {
        slow = slow->next;
        fast = fast->next->next;
        if (slow == fast) return true;
    }
    return false;
}

// 找环的入口
ListNode* detectCycle(ListNode* head) {
    ListNode* slow = head;
    ListNode* fast = head;
    while (fast && fast->next) {
        slow = slow->next;
        fast = fast->next->next;
        if (slow == fast) {
            slow = head;
            while (slow != fast) {
                slow = slow->next;
                fast = fast->next;
            }
            return slow;
        }
    }
    return nullptr;
}`
  },
  // 树
  {
    id: '7',
    name: '二叉树遍历',
    category: '树',
    description: '二叉树前序、中序、后序遍历（递归+迭代）',
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
    tags: ['二叉树', 'DFS', '栈'],
    code: `// 前序遍历 根-左-右
void preorder(TreeNode* root, vector<int>& res) {
    if (!root) return;
    res.push_back(root->val);
    preorder(root->left, res);
    preorder(root->right, res);
}

// 中序遍历 左-根-右
void inorder(TreeNode* root, vector<int>& res) {
    if (!root) return;
    inorder(root->left, res);
    res.push_back(root->val);
    inorder(root->right, res);
}

// 后序遍历 左-右-根
void postorder(TreeNode* root, vector<int>& res) {
    if (!root) return;
    postorder(root->left, res);
    postorder(root->right, res);
    res.push_back(root->val);
}

// 层序遍历 BFS
vector<vector<int>> levelOrder(TreeNode* root) {
    vector<vector<int>> res;
    if (!root) return res;
    queue<TreeNode*> q;
    q.push(root);
    while (!q.empty()) {
        int size = q.size();
        vector<int> level;
        for (int i = 0; i < size; i++) {
            TreeNode* node = q.front();
            q.pop();
            level.push_back(node->val);
            if (node->left) q.push(node->left);
            if (node->right) q.push(node->right);
        }
        res.push_back(level);
    }
    return res;
}`
  },
  {
    id: '8',
    name: 'AVL树旋转',
    category: '树',
    description: '平衡二叉树的四种旋转操作（LL/RR/LR/RL）',
    timeComplexity: 'O(1)',
    spaceComplexity: 'O(1)',
    tags: ['平衡树', 'BST', '旋转'],
    code: `struct AVLNode {
    int val;
    int height;
    AVLNode* left;
    AVLNode* right;
    AVLNode(int x) : val(x), height(1), left(nullptr), right(nullptr) {}
};

int getHeight(AVLNode* node) {
    return node ? node->height : 0;
}

int getBalance(AVLNode* node) {
    return node ? getHeight(node->left) - getHeight(node->right) : 0;
}

// 右旋转 (LL)
AVLNode* rightRotate(AVLNode* y) {
    AVLNode* x = y->left;
    AVLNode* T2 = x->right;
    x->right = y;
    y->left = T2;
    y->height = max(getHeight(y->left), getHeight(y->right)) + 1;
    x->height = max(getHeight(x->left), getHeight(x->right)) + 1;
    return x;
}

// 左旋转 (RR)
AVLNode* leftRotate(AVLNode* x) {
    AVLNode* y = x->right;
    AVLNode* T2 = y->left;
    y->left = x;
    x->right = T2;
    x->height = max(getHeight(x->left), getHeight(x->right)) + 1;
    y->height = max(getHeight(y->left), getHeight(y->right)) + 1;
    return y;
}`
  },
  // 图
  {
    id: '9',
    name: 'Dijkstra最短路径',
    category: '图',
    description: '单源最短路径算法，适用于非负权图',
    timeComplexity: 'O(ElogV)',
    spaceComplexity: 'O(V)',
    tags: ['最短路径', '贪心', '优先队列'],
    code: `// 邻接表表示的图
// Dijkstra 堆优化版
vector<int> dijkstra(int n, vector<vector<pair<int, int>>>& graph, int start) {
    vector<int> dist(n, INT_MAX);
    dist[start] = 0;
    
    // 优先队列：(距离, 节点) 小顶堆
    priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;
    pq.push({0, start});
    
    while (!pq.empty()) {
        auto [d, u] = pq.top();
        pq.pop();
        
        if (d > dist[u]) continue;
        
        for (auto& [v, w] : graph[u]) {
            if (dist[v] > dist[u] + w) {
                dist[v] = dist[u] + w;
                pq.push({dist[v], v});
            }
        }
    }
    
    return dist;
}`
  },
  {
    id: '10',
    name: 'KMP字符串匹配',
    category: '其他',
    description: '高效字符串匹配算法，利用next数组避免回溯',
    timeComplexity: 'O(n+m)',
    spaceComplexity: 'O(m)',
    tags: ['字符串', '前缀函数'],
    code: `// 构建next数组
vector<int> buildNext(string& pattern) {
    int m = pattern.size();
    vector<int> next(m, 0);
    int j = 0;
    for (int i = 1; i < m; i++) {
        while (j > 0 && pattern[i] != pattern[j]) {
            j = next[j - 1];
        }
        if (pattern[i] == pattern[j]) {
            j++;
        }
        next[i] = j;
    }
    return next;
}

// KMP匹配
int kmp(string& text, string& pattern) {
    int n = text.size(), m = pattern.size();
    vector<int> next = buildNext(pattern);
    int j = 0;
    for (int i = 0; i < n; i++) {
        while (j > 0 && text[i] != pattern[j]) {
            j = next[j - 1];
        }
        if (text[i] == pattern[j]) {
            j++;
        }
        if (j == m) {
            return i - m + 1; // 找到匹配，返回起始位置
        }
    }
    return -1; // 未找到
}`
  },
  {
    id: '11',
    name: 'Prim最小生成树',
    category: '图',
    description: '从顶点出发构建最小生成树，适合稠密图',
    timeComplexity: 'O(V²)',
    spaceComplexity: 'O(V)',
    tags: ['MST', '贪心'],
    code: `// Prim算法 邻接矩阵版
int prim(int n, vector<vector<int>>& graph) {
    vector<int> dist(n, INT_MAX); // 各点到当前MST的最小距离
    vector<bool> visited(n, false);
    dist[0] = 0;
    int res = 0;
    
    for (int i = 0; i < n; i++) {
        // 找距离最小的未访问顶点
        int u = -1;
        for (int j = 0; j < n; j++) {
            if (!visited[j] && (u == -1 || dist[j] < dist[u])) {
                u = j;
            }
        }
        
        if (dist[u] == INT_MAX) return -1; // 不连通
        
        visited[u] = true;
        res += dist[u];
        
        // 更新距离
        for (int v = 0; v < n; v++) {
            if (!visited[v] && graph[u][v] < dist[v]) {
                dist[v] = graph[u][v];
            }
        }
    }
    
    return res;
}`
  },
  {
    id: '12',
    name: 'Kruskal最小生成树',
    category: '图',
    description: '从边出发构建最小生成树，适合稀疏图',
    timeComplexity: 'O(ElogE)',
    spaceComplexity: 'O(E)',
    tags: ['MST', '并查集', '贪心'],
    code: `// 并查集
struct DSU {
    vector<int> parent;
    DSU(int n) : parent(n) {
        for (int i = 0; i < n; i++) parent[i] = i;
    }
    int find(int x) {
        if (parent[x] != x) parent[x] = find(parent[x]);
        return parent[x];
    }
    bool unite(int x, int y) {
        x = find(x), y = find(y);
        if (x == y) return false;
        parent[x] = y;
        return true;
    }
};

// Kruskal算法
int kruskal(int n, vector<vector<int>>& edges) {
    // edges: [u, v, weight]
    sort(edges.begin(), edges.end(), [](auto& a, auto& b) {
        return a[2] < b[2];
    });
    
    DSU dsu(n);
    int res = 0;
    int count = 0;
    
    for (auto& e : edges) {
        if (dsu.unite(e[0], e[1])) {
            res += e[2];
            count++;
            if (count == n - 1) break;
        }
    }
    
    return count == n - 1 ? res : -1;
}`
  }
]

const userAlgorithms = ref<Algorithm[]>([])

const allAlgorithms = computed(() => [...builtinAlgorithms, ...userAlgorithms.value])

const categories = computed(() => {
  const set = new Set(allAlgorithms.value.map(a => a.category))
  return Array.from(set)
})

const filteredAlgorithms = computed(() => {
  let result = allAlgorithms.value
  
  if (currentCategory.value !== 'all') {
    result = result.filter(a => a.category === currentCategory.value)
  }
  
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(a =>
      a.name.toLowerCase().includes(keyword) ||
      a.description.toLowerCase().includes(keyword) ||
      a.tags.some(t => t.toLowerCase().includes(keyword))
    )
  }
  
  return result
})

function showAlgoDetail(algo: Algorithm) {
  currentAlgo.value = algo
  showDetail.value = true
}

async function copyCode() {
  if (!currentAlgo.value) return
  try {
    await navigator.clipboard.writeText(currentAlgo.value.code)
    ElMessage.success('代码已复制到剪贴板')
  } catch (e) {
    ElMessage.error('复制失败，请手动复制')
  }
}

function handleAdd() {
  if (!addForm.name.trim()) {
    ElMessage.warning('请输入算法名称')
    return
  }
  if (!addForm.code.trim()) {
    ElMessage.warning('请输入代码')
    return
  }
  
  userAlgorithms.value.unshift({
    id: Date.now().toString(),
    name: addForm.name,
    category: addForm.category || '其他',
    description: addForm.description,
    code: addForm.code,
    timeComplexity: addForm.timeComplexity || '-',
    spaceComplexity: addForm.spaceComplexity || '-',
    tags: []
  })
  
  ElMessage.success('添加成功')
  showAddDialog.value = false
  addForm.name = ''
  addForm.category = ''
  addForm.description = ''
  addForm.timeComplexity = ''
  addForm.spaceComplexity = ''
  addForm.code = ''
}
</script>

<style scoped>
.algorithms-page {
  max-width: 1200px;
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
  padding: 8px 16px;
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
  background: linear-gradient(135deg, #8a9bb5 0%, #9d8bab 100%);
  color: #fff;
}

/* 算法卡片网格 */
.algorithms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.algo-card {
  background: var(--glass-bg);
  backdrop-filter: blur(14px) saturate(1.3);
  -webkit-backdrop-filter: blur(14px) saturate(1.3);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.algo-card:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
  border-color: #8a9bb5;
}

.algo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.algo-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--mo-text-1);
  margin: 0;
}

.algo-desc {
  font-size: 13px;
  color: var(--mo-text-2);
  line-height: 1.6;
  margin-bottom: 14px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.algo-meta {
  display: flex;
  gap: 20px;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: var(--mo-surface);
  border-radius: 8px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 11px;
  color: var(--mo-text-3);
}

.meta-value {
  font-size: 13px;
  font-weight: 600;
  color: #8a9bb5;
  font-family: 'Consolas', monospace;
}

.algo-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  padding: 2px 8px;
  background: rgba(150, 158, 170, 0.10);
  border-radius: 4px;
  font-size: 11px;
  color: var(--mo-text-2);
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

/* 详情弹窗 */
.algo-detail-dialog :deep(.el-dialog__body) {
  padding-top: 0;
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.6);
}

.meta-text {
  font-size: 13px;
  color: var(--mo-text-2);
}

.meta-text strong {
  color: #8a9bb5;
  font-family: 'Consolas', monospace;
}

.detail-section {
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.detail-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--mo-text-1);
  margin: 0 0 10px 0;
}

.detail-section p {
  font-size: 14px;
  color: var(--mo-text-2);
  line-height: 1.7;
  margin: 0;
}

.code-block {
  background: #3d4148;
  color: #dcdde0;
  padding: 16px;
  border-radius: 10px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
}

.code-block code {
  font-family: inherit;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.6);
}

.detail-tags .tag {
  padding: 4px 12px;
  background: rgba(150, 158, 170, 0.10);
  border-radius: 6px;
  font-size: 12px;
  color: var(--mo-text-2);
}
</style>
