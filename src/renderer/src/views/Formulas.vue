<template>
  <div class="formulas-page fade-in">
    <div class="page-header">
      <div>
        <h1 class="page-title">公式速查</h1>
        <p class="page-subtitle">11408 核心公式与重要概念 · 随时查阅</p>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <div class="filter-bar">
      <div class="subject-tabs">
        <div
          class="tab-item"
          :class="{ active: currentSubject === 'all' }"
          @click="currentSubject = 'all'"
        >
          全部
        </div>
        <div
          v-for="(config, key) in majorSubjects"
          :key="key"
          class="tab-item"
          :class="{ active: currentSubject === key }"
          :style="currentSubject === key ? { background: config.color, borderColor: config.color } : {}"
          @click="currentSubject = key as string"
        >
          {{ config.shortName }}
        </div>
      </div>
      <el-input
        v-model="searchKeyword"
        placeholder="搜索公式/概念..."
        style="width: 240px;"
        clearable
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <!-- 公式列表 -->
    <div class="formulas-list" v-if="filteredFormulas.length > 0">
      <div
        v-for="formula in filteredFormulas"
        :key="formula.id"
        class="formula-card"
      >
        <div class="formula-header">
          <h3 class="formula-name">{{ formula.name }}</h3>
          <el-tag
            :color="getSubjectColor(formula.subject)"
            style="color: #fff; border: none;"
            size="small"
          >
            {{ getSubjectName(formula.subject) }}
          </el-tag>
        </div>
        <div class="formula-category" v-if="formula.category">
          {{ formula.category }}
        </div>
        
        <div class="formula-content">
          <pre>{{ formula.content }}</pre>
        </div>
        
        <div class="formula-description" v-if="formula.description">
          <div class="desc-label">说明</div>
          <p>{{ formula.description }}</p>
        </div>
        
        <div class="formula-example" v-if="formula.example">
          <div class="example-label">示例</div>
          <pre class="example-code">{{ formula.example }}</pre>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="empty-state" v-else>
      <el-icon :size="64" color="#b0b6bd"><Operation /></el-icon>
      <p class="empty-text">没有找到相关公式</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, Operation } from '@element-plus/icons-vue'
import { useMainStore } from '@/stores'
import { politicsFormulas } from '@/data/politics-formulas'
import { mathFormulas } from '@/data/math-formulas'
import { englishFormulas } from '@/data/english-formulas'

const store = useMainStore()

const currentSubject = ref('all')
const searchKeyword = ref('')

const majorSubjects = computed(() => {
  return store.SUBJECT_CONFIG
})

interface Formula {
  id: string
  name: string
  subject: string
  category: string
  content: string
  description: string
  example?: string
}

const builtinFormulas: Formula[] = [
  // ========== 数据结构 ==========
  {
    id: 'ds-1',
    name: '时间复杂度计算',
    subject: 'cs408',
    category: '基础概念',
    content: `O(1) < O(logn) < O(n) < O(nlogn) < O(n²) < O(n³) < O(2ⁿ) < O(n!) < O(nⁿ)`,
    description: '常见时间复杂度从小到大排列。算法分析中，只关心最高阶项，忽略常数系数和低阶项。'
  },
  {
    id: 'ds-2',
    name: '顺序查找 ASL',
    subject: 'cs408',
    category: '查找',
    content: `ASL = Σ (Pi × Ci)

成功平均查找长度：
ASL成功 = (n+1)/2 （等概率）

失败平均查找长度：
ASL失败 = n+1`,
    description: '顺序查找的平均查找长度。Pi为查找第i个元素的概率，Ci为比较次数。',
    example: `n=10个元素，等概率查找：
ASL成功 = (10+1)/2 = 5.5`
  },
  {
    id: 'ds-3',
    name: '折半查找 ASL',
    subject: 'cs408',
    category: '查找',
    content: `判定树高度：h = ⌈log₂(n+1)⌉

ASL成功 ≈ log₂(n+1) - 1

ASL ≈ (n+1)/n × log₂(n+1) - 1`,
    description: '折半查找（二分查找）的平均查找长度。折半查找的判定树是平衡二叉树。',
    example: `n=11个元素的判定树：
第1层：1个节点
第2层：2个节点  
第3层：4个节点
第4层：4个节点
ASL = (1×1 + 2×2 + 3×4 + 4×4) / 11 = 33/11 = 3`
  },
  {
    id: 'ds-4',
    name: 'B树性质',
    subject: 'cs408',
    category: '查找',
    content: `m阶B树性质：
1. 每个节点最多有m棵子树
2. 根节点至少有2棵子树（非根节点至少⌈m/2⌉棵）
3. 子树数 = 关键字数 + 1
4. 所有叶子节点在同一层
5. 关键字数范围：⌈m/2⌉-1 ~ m-1`,
    description: 'B树是一种多路平衡查找树，常用于数据库和文件系统索引。'
  },
  {
    id: 'ds-5',
    name: '散列表 ASL（线性探测）',
    subject: 'cs408',
    category: '查找',
    content: `装填因子 α = 表中记录数 / 散列表长度

线性探测：
ASL成功 ≈ (1 + 1/(1-α)) / 2
ASL失败 ≈ (1 + 1/(1-α)²) / 2`,
    description: '散列表的平均查找长度与装填因子α有关，α越大冲突越多。'
  },
  {
    id: 'ds-6',
    name: '排序算法复杂度对比',
    subject: 'cs408',
    category: '排序',
    content: `算法        时间(平均)  时间(最坏)  空间    稳定
─────────────────────────────────────────
直接插入    O(n²)       O(n²)       O(1)    是
冒泡排序    O(n²)       O(n²)       O(1)    是
简单选择    O(n²)       O(n²)       O(1)    否
希尔排序    O(n^1.3)    -           O(1)    否
快速排序    O(nlogn)    O(n²)       O(logn) 否
堆排序      O(nlogn)    O(nlogn)    O(1)    否
归并排序    O(nlogn)    O(nlogn)    O(n)    是
基数排序    O(d(n+r))   O(d(n+r))   O(r)    是`,
    description: '常用排序算法的时间复杂度、空间复杂度和稳定性对比表。'
  },
  {
    id: 'ds-7',
    name: '哈夫曼树 WPL',
    subject: 'cs408',
    category: '树',
    content: `带权路径长度 WPL = Σ (wi × li)

其中：
  wi = 第i个叶子节点的权值
  li = 第i个叶子节点到根的路径长度

哈夫曼树特点：
- 没有度为1的节点
- n个叶子节点的哈夫曼树共有 2n-1 个节点`,
    description: '哈夫曼树（最优二叉树）是带权路径长度最小的二叉树。',
    example: `权值 {2, 3, 5, 7}：
合并 2+3=5 → {5, 5, 7}
合并 5+5=10 → {7, 10}
合并 7+10=17
WPL = 2×3 + 3×3 + 5×2 + 7×1 = 6+9+10+7 = 32`
  },
  {
    id: 'ds-8',
    name: '图的基本概念',
    subject: 'cs408',
    category: '图',
    content: `无向完全图：n(n-1)/2 条边
有向完全图：n(n-1) 条边

连通图（无向）：任意两顶点连通
强连通图（有向）：任意两顶点双向连通

连通分量：无向图的极大连通子图
强连通分量：有向图的极大强连通子图

生成树：包含全部顶点的极小连通子图
       边数 = n-1`,
    description: '图论中的基本概念和性质。'
  },

  // ========== 组成原理 ==========
  {
    id: 'co-1',
    name: '性能指标公式',
    subject: 'cs408',
    category: '性能指标',
    content: `主频 f = 1 / 时钟周期 T

CPI = 执行一条指令的平均时钟周期数
    = Σ (ICi × CPIi) / 总指令数

MIPS = 指令数 / (执行时间 × 10⁶)
     = 主频 / (CPI × 10⁶)

MFLOPS = 浮点操作数 / (执行时间 × 10⁶)

CPU执行时间 = 指令数 × CPI × 时钟周期
            = 指令数 × CPI / 主频`,
    description: '计算机系统的核心性能指标计算公式。',
    example: `主频 2GHz，CPI=2：
MIPS = 2000MHz / (2 × 10⁶) = 1000 MIPS

1000万条指令，CPI=2，主频1GHz：
执行时间 = 10⁷ × 2 / 10⁹ = 0.02 秒`
  },
  {
    id: 'co-2',
    name: 'Cache 命中率与平均访问时间',
    subject: 'cs408',
    category: '存储系统',
    content: `命中率 H = Cache命中次数 / 总访问次数

平均访问时间 Ta = H × Tc + (1-H) × Tm

其中：
  Tc = Cache访问时间
  Tm = 主存访问时间

访问效率 e = Tc / Ta
           = 1 / (H + (1-H) × Tm/Tc)`,
    description: 'Cache命中率和平均访问时间的计算公式。',
    example: `Cache访问 2ns，主存 20ns，命中率 95%：
Ta = 0.95×2 + 0.05×20 = 1.9 + 1.0 = 2.9ns
e = 2 / 2.9 ≈ 69%`
  },
  {
    id: 'co-3',
    name: 'Cache 地址映射',
    subject: 'cs408',
    category: '存储系统',
    content: `地址结构：
  直接映射：  标记 + Cache行号 + 块内地址
  全相联：    标记 + 块内地址
  组相联：    标记 + 组号 + 块内地址

块大小 = 2^b 字节 → 块内地址 b位
Cache行数 = 2^c → 行号 c位
组数 = 2^g → 组号 g位

主存块号 = 标记位 + 行号/组号位`,
    description: 'Cache三种地址映射方式的地址结构。'
  },
  {
    id: 'co-4',
    name: '流水线性能',
    subject: 'cs408',
    category: 'CPU',
    content: `流水线周期 Δt = max(各段时间)

n条指令顺序执行时间：
  T顺序 = n × k × Δt  （k段流水线）

n条指令流水线执行时间：
  T流水 = (k + n - 1) × Δt

加速比 S = T顺序 / T流水
        = n×k / (k+n-1)
        ≈ k （n很大时）

吞吐率 TP = n / T流水
         = n / [(k+n-1) × Δt]
  最大吞吐率 = 1/Δt

效率 E = n / (k + n - 1)
  最大效率 = 100%（理想）`,
    description: '指令流水线的性能指标计算公式。',
    example: `5段流水线，100条指令，Δt=1ns：
T流水 = (5+100-1) × 1 = 104ns
S = 100×5 / 104 ≈ 4.8
TP = 100 / 104ns ≈ 962 MIPS`
  },
  {
    id: 'co-5',
    name: '浮点数表示 IEEE754',
    subject: 'cs408',
    category: '数据表示',
    content: `单精度 float（32位）：
  符号位 1位 + 阶码 8位 + 尾数 23位
  阶码偏移量 = 127
  真值 = (-1)^s × 1.M × 2^(E-127)

双精度 double（64位）：
  符号位 1位 + 阶码 11位 + 尾数 52位
  阶码偏移量 = 1023
  真值 = (-1)^s × 1.M × 2^(E-1023)

规格化：最高位隐含为1，不存储`,
    description: 'IEEE 754标准的浮点数表示格式。'
  },
  {
    id: 'co-6',
    name: '存储器扩展',
    subject: 'cs408',
    category: '存储系统',
    content: `位扩展（增加字长）：
  芯片数 = 位数 / 每芯片位数

字扩展（增加字数）：
  芯片数 = 字数 / 每芯片字数

字位同时扩展：
  芯片数 = (总容量) / (每芯片容量)
         = (字数 × 位数) / (每片字数 × 每片位数)

地址线数 = log₂(总字数)
数据线数 = 位数`,
    description: '存储器扩展的芯片数量计算。',
    example: `用 1K×4位 芯片组成 4K×8位：
位扩展：8/4 = 2片（一组）
字扩展：4K/1K = 4组
总芯片数 = 2 × 4 = 8片
地址线：log₂(4K) = 12根
数据线：8根`
  },

  // ========== 操作系统 ==========
  {
    id: 'os-1',
    name: '银行家算法',
    subject: 'cs408',
    category: '死锁',
    content: `数据结构：
  Available[m]    可用资源数
  Max[n×m]       最大需求矩阵
  Allocation[n×m] 已分配矩阵
  Need[n×m]      需求矩阵 = Max - Allocation

安全性检查：
  Work = Available
  Finish[i] = false
  
  找一个进程Pi满足：
    Finish[i]=false 且 Need[i] ≤ Work
  找到则：
    Work += Allocation[i]
    Finish[i] = true
    重复查找
  所有Finish[i]=true则安全`,
    description: '银行家算法是死锁避免的经典算法，通过检查系统是否处于安全状态来决定是否分配资源。'
  },
  {
    id: 'os-2',
    name: '页面置换算法',
    subject: 'cs408',
    category: '内存管理',
    content: `OPT最佳置换：
  置换以后最久不使用（或永不使用）的页
  缺页率最低，但无法实现

FIFO先进先出：
  置换最早进入的页
  可能出现Belady异常（页框增多，缺页反而增多）

LRU最近最久未使用：
  置换最久未访问的页
  堆栈类算法，无Belady异常

Clock时钟算法：
  循环检查访问位，找到第一个为0的置换
  访问位为1则置0并跳过`,
    description: '常用页面置换算法的原理和特点。'
  },
  {
    id: 'os-3',
    name: '磁盘调度算法',
    subject: 'cs408',
    category: 'I/O管理',
    content: `FCFS先来先服务：
  按请求顺序处理，公平但效率低

SSTF最短寻道优先：
  每次选最近的磁道
  平均寻道短，但可能饥饿

SCAN电梯算法：
  沿一个方向处理，到头再反向
  类似电梯运行

CSCAN循环扫描：
  沿一个方向处理到头
  立即跳回另一端继续
  请求响应更均匀`,
    description: '磁盘调度的几种经典算法。'
  },
  {
    id: 'os-4',
    name: 'PV操作 信号量',
    subject: 'cs408',
    category: '进程同步',
    content: `P操作（wait）：
  P(S): S = S - 1
        if S < 0 then 阻塞该进程

V操作（signal）：
  V(S): S = S + 1
        if S ≤ 0 then 唤醒一个等待进程

信号量含义：
  S > 0：可用资源数
  S = 0：无可用资源，无等待进程
  S < 0：|S|个进程在等待队列

互斥信号量初值 = 1
同步信号量初值 = 资源数`,
    description: '信号量PV操作是进程同步与互斥的经典机制。'
  },
  {
    id: 'os-5',
    name: '死锁四个必要条件',
    subject: 'cs408',
    category: '死锁',
    content: `1. 互斥条件
   资源独占使用，不能同时被多个进程占用

2. 不剥夺条件
   资源只能由持有者主动释放，不能被强行剥夺

3. 请求并保持条件
   进程已持有部分资源，又请求新的资源

4. 循环等待条件
   存在进程资源的循环等待链

死锁预防：破坏四个条件之一
死锁避免：银行家算法（安全状态）
死锁检测：资源分配图
死锁解除：剥夺资源/撤销进程`,
    description: '死锁产生的四个必要条件，缺一不可。'
  },
  {
    id: 'os-6',
    name: '调度算法比较',
    subject: 'cs408',
    category: '处理机调度',
    content: `FCFS先来先服务：
  非抢占，利于长作业，不利于短作业

SJF短作业优先：
  非抢占，平均等待时间最短
  可能饥饿长作业

优先级调度：
  抢占/非抢占，优先级高的先执行
  动态优先级可防饥饿

时间片轮转RR：
  抢占，分时系统常用
  时间片大小影响性能

多级反馈队列：
  综合多种算法优点
  新进程进高优先级队列
  时间片用完降级
  常用系统的实际算法`,
    description: '常用进程调度算法的特点对比。'
  },

  // ========== 计算机网络 ==========
  {
    id: 'cn-1',
    name: '奈奎斯特定理',
    subject: 'cs408',
    category: '物理层',
    content: `无噪声信道的极限数据传输率：

  R_max = 2W × log₂V  (bps)

其中：
  W = 信道带宽 (Hz)
  V = 每个码元的离散电平数
  R_max = 最大数据传输率

结论：
  码元传输速率上限 = 2W 波特
  每个码元携带 log₂V 比特信息`,
    description: '奈奎斯特定理给出了无噪声信道的最高码元传输速率。',
    example: `带宽 3kHz，16个电平：
R_max = 2 × 3000 × log₂16
      = 6000 × 4
      = 24000 bps = 24 kbps`
  },
  {
    id: 'cn-2',
    name: '香农定理',
    subject: 'cs408',
    category: '物理层',
    content: `有噪声信道的极限数据传输率：

  C = W × log₂(1 + S/N)  (bps)

其中：
  W = 信道带宽 (Hz)
  S/N = 信噪比（功率比）
  C = 信道的极限数据传输率

信噪比 dB 转换：
  dB = 10 × log₁₀(S/N)
  S/N = 10^(dB/10)`,
    description: '香农定理给出了有噪声信道的极限传输速率。',
    example: `带宽 3kHz，信噪比 30dB：
S/N = 10^(30/10) = 1000
C = 3000 × log₂(1+1000)
  ≈ 3000 × 9.97
  ≈ 29900 bps ≈ 30 kbps`
  },
  {
    id: 'cn-3',
    name: 'CRC 循环冗余校验',
    subject: 'cs408',
    category: '数据链路层',
    content: `计算步骤：
1. 设生成多项式 G(x) 阶数为 r
2. 在数据后添加 r 个 0
3. 用模2除法（异或）除以 G(x)
4. 得到的 r 位余数就是 CRC 冗余码

发送：数据 + CRC码
接收：收到的数据除以 G(x)
      余数为0则无差错

特点：
  检错能力强，漏检率极低
  常用于数据链路层和传输层`,
    description: 'CRC循环冗余校验是常用的差错检测方法。',
    example: `数据 1101，G(x)=x³+x²+1=1101
数据后加3个0：1101000
模2除以 1101：
  1101000 ÷ 1101 = 1000 余 000
CRC码 = 000
发送：1101000`
  },
  {
    id: 'cn-4',
    name: 'TCP 拥塞控制',
    subject: 'cs408',
    category: '传输层',
    content: `四个阶段：

1. 慢开始
   cwnd从1开始，每RTT翻倍
   直到达到ssthresh

2. 拥塞避免
   cwnd每RTT加1（线性增长）
   出现丢包则：
     ssthresh = cwnd/2
     cwnd = 1（或 ssthresh，快恢复）

3. 快重传
   收到3个重复ACK立即重传
   不必等超时

4. 快恢复
   收到3个重复ACK时：
     ssthresh = cwnd/2
     cwnd = ssthresh
     进入拥塞避免`,
    description: 'TCP拥塞控制的四个核心算法。'
  },
  {
    id: 'cn-5',
    name: '滑动窗口 流量控制',
    subject: 'cs408',
    category: '传输层',
    content: `可靠传输机制：
  停止-等待：发送1帧等确认，窗口=1
  后退N帧GBN：发送窗口>1，接收窗口=1
  选择重传SR：发送窗口>1，接收窗口>1

GBN后退N帧：
  发送窗口 Wt ≤ 2ⁿ - 1
  接收窗口 Wr = 1
  出错重传所有未确认帧

SR选择重传：
  发送窗口 Wt ≤ 2^(n-1)
  接收窗口 Wr ≤ 2^(n-1)
  只重传出错的帧

n为序号位数`,
    description: '滑动窗口机制实现流量控制和可靠传输。'
  },
  {
    id: 'cn-6',
    name: '时延计算',
    subject: 'cs408',
    category: '性能指标',
    content: `总时延 = 发送时延 + 传播时延 + 处理时延 + 排队时延

发送时延 = 数据长度 / 信道带宽
        = 比特数 / 数据率 (s)

传播时延 = 信道长度 / 电磁波速率
         = 距离 / (2×10⁸ m/s) （铜线/光纤约2/3光速）

时延带宽积 = 传播时延 × 带宽
           = 链路上能容纳的比特数

往返时间 RTT = 2 × 传播时延 + 处理时间`,
    description: '网络时延的组成和计算公式。',
    example: `1000km链路，10Mbps带宽，1KB数据：
发送时延 = 8192bit / 10⁷bps = 0.8192ms
传播时延 = 10⁶m / (2×10⁸m/s) = 5ms
总时延 ≈ 5.82ms`
  },
  {
    id: 'cn-7',
    name: 'OSI七层模型',
    subject: 'cs408',
    category: '体系结构',
    content: `应用层     第7层  用户接口
表示层     第6层  数据格式、加密压缩
会话层     第5层  会话管理、同步
传输层     第4层  端到端、可靠传输
网络层     第3层  路由选择、IP
数据链路层 第2层  帧、差错控制、MAC
物理层     第1层  比特流、电气特性

数据封装：
  发送方：数据逐层加首部（封装）
  接收方：逐层去首部（拆封）

每层的PDU：
  应用层：报文 message
  传输层：报文段 segment
  网络层：分组/包 packet
  链路层：帧 frame
  物理层：比特 bit`,
    description: 'OSI七层参考模型各层的功能和数据单元。'
  },
  {
    id: 'cn-8',
    name: 'TCP三次握手/四次挥手',
    subject: 'cs408',
    category: '传输层',
    content: `三次握手（建立连接）：
  1. 客户端 → 服务端：SYN, seq=x
  2. 服务端 → 客户端：SYN+ACK, seq=y, ack=x+1
  3. 客户端 → 服务端：ACK, ack=y+1

四次挥手（释放连接）：
  1. 客户端 → 服务端：FIN, seq=u
  2. 服务端 → 客户端：ACK, ack=u+1
     （此时客户端→服务端方向关闭，半关闭）
  3. 服务端 → 客户端：FIN, seq=v
  4. 客户端 → 服务端：ACK, ack=v+1
     （客户端等待 2MSL 后关闭）

为什么三次握手？
  防止已失效的连接请求到达
为什么四次挥手？
  TCP全双工，两个方向各自关闭`,
    description: 'TCP连接建立和释放的过程。'
  }
]

// 合并所有科目的公式
const formulas: Formula[] = [
  ...builtinFormulas,
  ...politicsFormulas as Formula[],
  ...mathFormulas as Formula[],
  ...englishFormulas as Formula[]
]

const filteredFormulas = computed(() => {
  let result = formulas
  
  if (currentSubject.value !== 'all') {
    result = result.filter(f => f.subject === currentSubject.value)
  }
  
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(f =>
      f.name.toLowerCase().includes(keyword) ||
      f.description.toLowerCase().includes(keyword) ||
      f.category.toLowerCase().includes(keyword)
    )
  }
  
  return result
})

function getSubjectColor(subject: string) {
  const config = store.SUBJECT_CONFIG[subject as keyof typeof store.SUBJECT_CONFIG]
  return config?.color || '#3b82f6'
}

function getSubjectName(subject: string) {
  const config = store.SUBJECT_CONFIG[subject as keyof typeof store.SUBJECT_CONFIG]
  return config?.shortName || subject
}
</script>

<style scoped>
.formulas-page {
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
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
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  box-shadow: var(--glass-shadow);
}

.subject-tabs {
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
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
  background: var(--mo-surface);
  border: 1px solid transparent;
}

.tab-item:hover {
  background: var(--mo-surface-hover);
}

.tab-item.active {
  color: #fff;
  background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
}

/* 公式列表 */
.formulas-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.formula-card {
  background: var(--glass-lite-bg);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 20px 24px;
  box-shadow: var(--glass-shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.formula-card:hover {
  box-shadow: var(--glass-shadow-hover);
}

.formula-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.formula-name {
  font-size: 17px;
  font-weight: 600;
  color: var(--mo-text-1);
  margin: 0;
}

.formula-category {
  font-size: 12px;
  color: var(--mo-text-3);
  margin-bottom: 14px;
}

.formula-content {
  background: var(--mo-surface);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 14px;
  border-left: 3px solid var(--mo-primary);
}

.formula-content pre {
  margin: 0;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.8;
  color: var(--mo-text-1);
  white-space: pre-wrap;
  word-wrap: break-word;
}

.formula-description {
  margin-bottom: 12px;
}

.desc-label {
  font-size: 12px;
  font-weight: 600;
  color: #34d399;
  margin-bottom: 6px;
}

.formula-description p {
  font-size: 14px;
  color: var(--mo-text-2);
  line-height: 1.7;
  margin: 0;
}

.formula-example {
  background: var(--mo-surface);
  border-radius: 8px;
  padding: 12px 16px;
  border-left: 3px solid var(--mo-info);
}

.example-label {
  font-size: 12px;
  font-weight: 600;
  color: #8fa5b5;
  margin-bottom: 6px;
}

.example-code {
  margin: 0;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.7;
  color: var(--mo-text-2);
  white-space: pre-wrap;
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
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
}

.empty-text {
  color: var(--mo-text-3);
  font-size: 14px;
  margin: 0;
}
</style>
