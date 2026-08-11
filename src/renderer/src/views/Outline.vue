<template>
  <div class="outline-page fade-in">
    <div class="page-header">
      <div>
        <h1 class="page-title">知识大纲</h1>
        <p class="page-subtitle">考研全科复习进度追踪 · 随时查阅知识点</p>
      </div>
    </div>

    <!-- 总体进度 -->
    <div class="overall-progress-card">
      <div class="progress-header">
        <h3>总体复习进度</h3>
        <span class="progress-total">{{ overallProgress }}%</span>
      </div>
      <el-progress
        :percentage="overallProgress"
        :show-text="false"
        :stroke-width="16"
        color="url(#overallGradient)"
      />
      <svg width="0" height="0">
        <defs>
          <linearGradient id="overallGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#3b82f6" />
            <stop offset="100%" stop-color="#60a5fa" />
          </linearGradient>
        </defs>
      </svg>
    </div>

    <!-- 各科进度卡片 -->
    <div class="subject-progress-grid">
      <div
        v-for="(config, key) in majorSubjects"
        :key="key"
        class="subject-progress-card"
        :style="{ borderTopColor: config.color }"
        @click="currentSubject = key as SubjectType"
      >
        <div class="subject-header">
          <h4>{{ config.name }}</h4>
          <span class="subject-percent" :style="{ color: config.color }">
            {{ store.subjectProgress[key as SubjectType] }}%
          </span>
        </div>
        <el-progress
          :percentage="store.subjectProgress[key as SubjectType]"
          :show-text="false"
          :stroke-width="8"
          :color="config.color"
        />
        <div class="subject-stats">
          <span>学习时长: {{ formatHours(store.subjectStudyMinutes[key as SubjectType]) }}h</span>
        </div>
      </div>
    </div>

    <!-- 知识点大纲 -->
    <div class="outline-card">
      <div class="outline-tabs">
        <div
          v-for="(config, key) in majorSubjects"
          :key="key"
          class="outline-tab"
          :class="{ active: currentSubject === key }"
          :style="currentSubject === key ? { background: config.color, borderColor: config.color } : {}"
          @click="currentSubject = key as SubjectType"
        >
          {{ config.shortName }}
        </div>
      </div>

      <!-- 进度调节 -->
      <div class="progress-adjust">
        <span class="adjust-label">当前科目进度：</span>
        <el-slider
          v-model="currentProgress"
          :min="0"
          :max="100"
          :step="5"
          show-input
          style="width: 300px;"
          @change="updateProgress"
        />
      </div>

      <!-- 知识点树 -->
      <div class="outline-tree">
        <div
          v-for="(chapter, index) in currentOutline"
          :key="index"
          class="chapter-item"
        >
          <div class="chapter-header" @click="toggleChapter(index)">
            <el-icon class="expand-icon" :class="{ expanded: expandedChapters.has(index) }">
              <ArrowRight />
            </el-icon>
            <span class="chapter-title">{{ chapter.title }}</span>
            <el-tag size="small" type="info" v-if="chapter.weight">
              分值约 {{ chapter.weight }} 分
            </el-tag>
          </div>
          <div class="chapter-content" v-show="expandedChapters.has(index)">
            <div
              v-for="(section, sIndex) in chapter.sections"
              :key="sIndex"
              class="section-item"
            >
              <div class="section-title">
                <el-icon><Document /></el-icon>
                {{ section.title }}
              </div>
              <div class="section-points" v-if="section.points">
                <span
                  v-for="(point, pIndex) in section.points"
                  :key="pIndex"
                  class="point-tag"
                >
                  {{ point }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useMainStore, SubjectType } from '@/stores'
import { ElMessage } from 'element-plus'
import { ArrowRight, Document } from '@element-plus/icons-vue'
import { politicsOutline } from '@/data/politics-outline'
import { mathOutline } from '@/data/math-outline'

const store = useMainStore()

const currentSubject = ref<SubjectType>('cs408')
const expandedChapters = ref(new Set<number>([0]))

const majorSubjects = computed(() => {
  return store.SUBJECT_CONFIG
})

const overallProgress = computed(() => {
  const keys = Object.keys(store.SUBJECT_CONFIG) as SubjectType[]
  const sum = keys.reduce((acc, key) => acc + store.subjectProgress[key], 0)
  return Math.round(sum / keys.length)
})

const currentProgress = computed({
  get: () => store.subjectProgress[currentSubject.value],
  set: (val: number) => { store.setSubjectProgress(currentSubject.value, val) }
})

function updateProgress(val: number) {
  store.setSubjectProgress(currentSubject.value, val)
  ElMessage.success('进度已更新')
}

function toggleChapter(index: number) {
  if (expandedChapters.value.has(index)) {
    expandedChapters.value.delete(index)
  } else {
    expandedChapters.value.add(index)
  }
  expandedChapters.value = new Set(expandedChapters.value)
}

function formatHours(minutes: number) {
  return (minutes / 60).toFixed(1)
}

// 数据结构大纲
const dataStructOutline = [
  {
    title: '第一章 线性表',
    weight: '10-15',
    sections: [
      {
        title: '1.1 线性表的定义和基本操作',
        points: ['定义', '基本操作（插入/删除/查找）', '抽象数据类型']
      },
      {
        title: '1.2 线性表的顺序表示',
        points: ['顺序存储结构', '动态数组', '插入删除算法', '时间复杂度分析']
      },
      {
        title: '1.3 线性表的链式表示',
        points: ['单链表', '双链表', '循环链表', '静态链表', '链表操作']
      }
    ]
  },
  {
    title: '第二章 栈、队列和数组',
    weight: '10-12',
    sections: [
      {
        title: '2.1 栈',
        points: ['栈的定义', '顺序栈', '链栈', '共享栈', '栈的应用']
      },
      {
        title: '2.2 队列',
        points: ['队列定义', '顺序队列', '循环队列', '链队列', '双端队列']
      },
      {
        title: '2.3 栈和队列的应用',
        points: ['括号匹配', '表达式求值', '递归', '层次遍历', 'BFS']
      },
      {
        title: '2.4 数组和特殊矩阵',
        points: ['数组存储', '对称矩阵', '三角矩阵', '三对角矩阵', '稀疏矩阵']
      }
    ]
  },
  {
    title: '第三章 树与二叉树',
    weight: '20-25',
    sections: [
      {
        title: '3.1 树的基本概念',
        points: ['定义', '术语', '性质', '存储结构']
      },
      {
        title: '3.2 二叉树',
        points: ['定义与性质', '顺序存储', '链式存储', '前序/中序/后序遍历', '层次遍历']
      },
      {
        title: '3.3 树、森林',
        points: ['树的存储', '树与二叉树转换', '森林与二叉树转换', '树和森林的遍历']
      },
      {
        title: '3.4 树与二叉树的应用',
        points: ['二叉排序树BST', '平衡二叉树AVL', '哈夫曼树', '哈夫曼编码']
      }
    ]
  },
  {
    title: '第四章 图',
    weight: '15-20',
    sections: [
      {
        title: '4.1 图的基本概念',
        points: ['定义', '术语', '有向图/无向图', '完全图', '连通性']
      },
      {
        title: '4.2 图的存储及基本操作',
        points: ['邻接矩阵', '邻接表', '十字链表', '邻接多重表']
      },
      {
        title: '4.3 图的遍历',
        points: ['BFS广度优先', 'DFS深度优先', '遍历序列', '连通分量']
      },
      {
        title: '4.4 图的应用',
        points: ['最小生成树Prim/Kruskal', '最短路径Dijkstra/Floyd', '拓扑排序', '关键路径']
      }
    ]
  },
  {
    title: '第五章 查找',
    weight: '10-15',
    sections: [
      {
        title: '5.1 查找的基本概念',
        points: ['查找表', '关键字', '平均查找长度ASL']
      },
      {
        title: '5.2 顺序查找和折半查找',
        points: ['顺序查找', '折半查找', '分块查找', 'ASL计算']
      },
      {
        title: '5.3 B树和B+树',
        points: ['B树定义', 'B树插入删除', 'B+树', 'B树与B+树区别']
      },
      {
        title: '5.4 散列表',
        points: ['散列函数', '冲突处理', '线性探测', '平方探测', '拉链法', 'ASL']
      }
    ]
  },
  {
    title: '第六章 排序',
    weight: '15-20',
    sections: [
      {
        title: '6.1 排序的基本概念',
        points: ['定义', '稳定性', '分类']
      },
      {
        title: '6.2 插入排序',
        points: ['直接插入', '折半插入', '希尔排序']
      },
      {
        title: '6.3 交换排序',
        points: ['冒泡排序', '快速排序', '快排优化']
      },
      {
        title: '6.4 选择排序',
        points: ['简单选择', '堆排序', '堆的调整']
      },
      {
        title: '6.5 归并排序和基数排序',
        points: ['归并排序', '基数排序']
      },
      {
        title: '6.6 各种排序算法比较',
        points: ['时间复杂度', '空间复杂度', '稳定性', '适用场景']
      }
    ]
  }
]

// 组成原理大纲
const compositionOutline = [
  {
    title: '第一章 计算机系统概述',
    weight: '5-8',
    sections: [
      {
        title: '1.1 计算机发展历程',
        points: ['四代计算机', '摩尔定律']
      },
      {
        title: '1.2 计算机系统层次结构',
        points: ['硬件系统', '软件系统', '层次结构', '虚拟机']
      },
      {
        title: '1.3 计算机性能指标',
        points: ['字长', '主频', 'CPI', 'MIPS', 'MFLOPS', '吞吐量', '响应时间']
      }
    ]
  },
  {
    title: '第二章 数据的表示和运算',
    weight: '10-15',
    sections: [
      {
        title: '2.1 数制与编码',
        points: ['进位计数制', 'BCD码', '字符编码', '字符串']
      },
      {
        title: '2.2 定点数的表示和运算',
        points: ['原码/反码/补码', '移码', '加减运算', '溢出判断', '乘除运算']
      },
      {
        title: '2.3 浮点数的表示和运算',
        points: ['IEEE754标准', '规格化', '加减运算', '精度问题']
      },
      {
        title: '2.4 算术逻辑单元ALU',
        points: ['加法器', '进位链', 'ALU功能']
      }
    ]
  },
  {
    title: '第三章 存储系统',
    weight: '20-25',
    sections: [
      {
        title: '3.1 存储器的分类',
        points: ['分类方式', '层次结构']
      },
      {
        title: '3.2 主存储器',
        points: ['SRAM', 'DRAM', 'ROM', '内存扩展', '芯片连接']
      },
      {
        title: '3.3 并行主存与双口RAM',
        points: ['多模块存储器', '双端口RAM']
      },
      {
        title: '3.4 Cache高速缓存',
        points: ['工作原理', '地址映射', '直接映射', '全相联', '组相联', '替换算法', '写策略', '命中率计算']
      },
      {
        title: '3.5 虚拟存储器',
        points: ['页式虚拟存储', '段式', '段页式', 'TLB快表', '缺页']
      }
    ]
  },
  {
    title: '第四章 指令系统',
    weight: '10-12',
    sections: [
      {
        title: '4.1 指令格式',
        points: ['指令基本格式', '定长指令', '变长指令', '扩展操作码']
      },
      {
        title: '4.2 指令的寻址方式',
        points: ['立即寻址', '直接寻址', '间接寻址', '寄存器寻址', '寄存器间接', '相对寻址', '基址寻址', '变址寻址']
      },
      {
        title: '4.3 CISC和RISC',
        points: ['CISC特点', 'RISC特点', '比较']
      }
    ]
  },
  {
    title: '第五章 中央处理器',
    weight: '15-20',
    sections: [
      {
        title: '5.1 CPU的功能和基本结构',
        points: ['功能', '组成', '寄存器']
      },
      {
        title: '5.2 指令执行过程',
        points: ['取指周期', '间址周期', '执行周期', '中断周期', '指令周期']
      },
      {
        title: '5.3 数据通路的功能和基本结构',
        points: ['数据通路', '总线结构']
      },
      {
        title: '5.4 控制器',
        points: ['硬布线控制器', '微程序控制器', '微指令', '微地址']
      },
      {
        title: '5.5 指令流水线',
        points: ['基本概念', '流水线性能', '冒险', '数据冒险', '控制冒险', '结构冒险', '流水线优化']
      }
    ]
  },
  {
    title: '第六章 总线',
    weight: '5-8',
    sections: [
      {
        title: '6.1 总线概述',
        points: ['分类', '性能指标', '总线事务']
      },
      {
        title: '6.2 总线仲裁',
        points: ['集中仲裁', '链式查询', '计数器定时', '独立请求', '分布仲裁']
      },
      {
        title: '6.3 总线操作和定时',
        points: ['同步定时', '异步定时', '半同步']
      }
    ]
  },
  {
    title: '第七章 输入输出系统',
    weight: '8-12',
    sections: [
      {
        title: '7.1 I/O系统基本概念',
        points: ['I/O设备', 'I/O接口']
      },
      {
        title: '7.2 I/O设备',
        points: ['输入设备', '输出设备', '外存储器']
      },
      {
        title: '7.3 I/O接口',
        points: ['功能', '分类', '端口']
      },
      {
        title: '7.4 I/O方式',
        points: ['程序查询', '程序中断', 'DMA', '通道']
      }
    ]
  }
]

// 操作系统大纲
const osOutline = [
  {
    title: '第一章 操作系统概述',
    weight: '5-8',
    sections: [
      {
        title: '1.1 操作系统的概念、特征、功能',
        points: ['定义', '并发性', '共享性', '虚拟性', '异步性', '功能']
      },
      {
        title: '1.2 操作系统发展与分类',
        points: ['批处理', '分时', '实时', '网络', '分布式']
      },
      {
        title: '1.3 运行环境',
        points: ['核心态/用户态', '中断', '异常', '系统调用']
      },
      {
        title: '1.4 体系结构',
        points: ['大内核', '微内核']
      }
    ]
  },
  {
    title: '第二章 进程与线程',
    weight: '20-25',
    sections: [
      {
        title: '2.1 进程与线程',
        points: ['进程概念', 'PCB', '状态转换', '线程', '进程与线程比较']
      },
      {
        title: '2.2 处理机调度',
        points: ['调度层次', '调度准则', '先来先服务', '短作业优先', '优先级', '时间片轮转', '多级反馈队列']
      },
      {
        title: '2.3 进程同步',
        points: ['临界区', '信号量', 'PV操作', '管程', '经典同步问题']
      },
      {
        title: '2.4 死锁',
        points: ['死锁条件', '死锁预防', '死锁避免', '银行家算法', '死锁检测', '死锁解除']
      }
    ]
  },
  {
    title: '第三章 内存管理',
    weight: '15-20',
    sections: [
      {
        title: '3.1 内存管理概念',
        points: ['功能', '重定位', '链接', '装入', '逻辑地址/物理地址']
      },
      {
        title: '3.2 交换与覆盖',
        points: ['覆盖技术', '交换技术']
      },
      {
        title: '3.3 连续分配管理方式',
        points: ['单一连续', '固定分区', '动态分区', '分配算法']
      },
      {
        title: '3.4 非连续分配管理方式',
        points: ['分页', '分段', '段页式', '地址变换']
      },
      {
        title: '3.5 虚拟内存',
        points: ['基本概念', '请求分页', '页面置换算法', '页面分配', '抖动', '工作集']
      }
    ]
  },
  {
    title: '第四章 文件管理',
    weight: '12-15',
    sections: [
      {
        title: '4.1 文件系统基础',
        points: ['文件概念', '文件属性', '文件操作', '文件类型']
      },
      {
        title: '4.2 文件的逻辑结构',
        points: ['顺序文件', '索引文件', '索引顺序文件']
      },
      {
        title: '4.3 目录管理',
        points: ['目录结构', '文件控制块', '索引节点', '目录操作']
      },
      {
        title: '4.4 文件的物理结构',
        points: ['连续分配', '链接分配', '索引分配']
      },
      {
        title: '4.5 文件存储空间管理',
        points: ['空闲表', '空闲链表', '位示图', '成组链接']
      },
      {
        title: '4.6 文件系统实现',
        points: ['文件系统层次结构', '虚拟文件系统VFS']
      }
    ]
  },
  {
    title: '第五章 输入输出管理',
    weight: '10-12',
    sections: [
      {
        title: '5.1 I/O管理概述',
        points: ['I/O设备', 'I/O管理目标', 'I/O应用接口']
      },
      {
        title: '5.2 I/O核心子系统',
        points: ['I/O调度', '设备分配', '缓冲管理', '假脱机SPOOLing']
      },
      {
        title: '5.3 磁盘管理',
        points: ['磁盘结构', '磁盘调度', 'FCFS', 'SSTF', 'SCAN', 'CSCAN', '磁盘管理']
      }
    ]
  }
]

// 计算机网络大纲
const networkOutline = [
  {
    title: '第一章 计算机网络体系结构',
    weight: '5-8',
    sections: [
      {
        title: '1.1 计算机网络概述',
        points: ['概念', '组成', '功能', '分类']
      },
      {
        title: '1.2 计算机网络体系结构',
        points: ['OSI七层模型', 'TCP/IP四层', '五层协议', '协议', '接口', '服务']
      },
      {
        title: '1.3 性能指标',
        points: ['速率', '带宽', '吞吐量', '时延', '时延带宽积', '往返时间RTT', '利用率']
      }
    ]
  },
  {
    title: '第二章 物理层',
    weight: '8-10',
    sections: [
      {
        title: '2.1 通信基础',
        points: ['信道', '奈奎斯特定理', '香农定理', '编码', '调制']
      },
      {
        title: '2.2 传输介质',
        points: ['双绞线', '同轴电缆', '光纤', '无线传输']
      },
      {
        title: '2.3 物理层设备',
        points: ['中继器', '集线器']
      }
    ]
  },
  {
    title: '第三章 数据链路层',
    weight: '15-20',
    sections: [
      {
        title: '3.1 数据链路层功能',
        points: ['封装成帧', '透明传输', '差错控制', '流量控制', '可靠传输']
      },
      {
        title: '3.2 组帧',
        points: ['字符计数', '字符填充', '比特填充', '违规编码']
      },
      {
        title: '3.3 差错控制',
        points: ['奇偶校验', 'CRC循环冗余', '海明码']
      },
      {
        title: '3.4 流量控制与可靠传输',
        points: ['停止-等待', '后退N帧GBN', '选择重传SR', '滑动窗口']
      },
      {
        title: '3.5 介质访问控制',
        points: ['信道划分', 'ALOHA', 'CSMA', 'CSMA/CD', 'CSMA/CA', '令牌传递']
      },
      {
        title: '3.6 局域网',
        points: ['以太网', 'MAC帧', '交换机', 'VLAN', '生成树协议']
      },
      {
        title: '3.7 广域网',
        points: ['PPP', 'HDLC']
      },
      {
        title: '3.8 数据链路层设备',
        points: ['网桥', '交换机', '自学习']
      }
    ]
  },
  {
    title: '第四章 网络层',
    weight: '20-25',
    sections: [
      {
        title: '4.1 网络层功能',
        points: ['异构网络互联', '路由与转发', '拥塞控制']
      },
      {
        title: '4.2 路由算法',
        points: ['静态路由', '动态路由', '距离向量', '链路状态', '层次路由']
      },
      {
        title: '4.3 IPv4',
        points: ['IPv4分组', 'IPv4地址', '子网划分', 'CIDR', '路由聚合', 'ARP', 'DHCP', 'ICMP']
      },
      {
        title: '4.4 IPv6',
        points: ['IPv6特点', '地址格式', '与IPv4比较']
      },
      {
        title: '4.5 路由协议',
        points: ['RIP', 'OSPF', 'BGP']
      },
      {
        title: '4.6 IP组播',
        points: ['组播概念', '组播地址', 'IGMP']
      },
      {
        title: '4.7 移动IP',
        points: ['移动IP概念', '工作过程']
      },
      {
        title: '4.8 网络层设备',
        points: ['路由器', '路由表', '转发']
      }
    ]
  },
  {
    title: '第五章 传输层',
    weight: '15-20',
    sections: [
      {
        title: '5.1 传输层提供的服务',
        points: ['功能', '端口', '复用分用', 'UDP/TCP比较']
      },
      {
        title: '5.2 UDP',
        points: ['UDP特点', 'UDP首部', 'UDP校验']
      },
      {
        title: '5.3 TCP',
        points: ['TCP特点', 'TCP首部', '连接管理三次握手/四次挥手', '可靠传输', '流量控制滑动窗口', '拥塞控制慢开始/拥塞避免/快重传/快恢复']
      }
    ]
  },
  {
    title: '第六章 应用层',
    weight: '8-12',
    sections: [
      {
        title: '6.1 网络应用模型',
        points: ['C/S', 'P2P']
      },
      {
        title: '6.2 DNS',
        points: ['层次域名空间', '域名服务器', '解析过程']
      },
      {
        title: '6.3 FTP',
        points: ['FTP工作原理', '控制连接', '数据连接']
      },
      {
        title: '6.4 电子邮件',
        points: ['SMTP', 'POP3', 'IMAP', '邮件格式']
      },
      {
        title: '6.5 WWW',
        points: ['WWW概念', 'HTTP', 'HTTP/1.1', 'HTTPS']
      }
    ]
  }
]

// 408 计算机学科专业基础综合大纲（合并数据结构、组成原理、操作系统、计算机网络）
const cs408Outline = [
  {
    title: '第一部分 数据结构（约45分）',
    weight: '45',
    sections: dataStructOutline.flatMap(chapter => 
      chapter.sections.map(section => ({
        title: `${chapter.title} - ${section.title}`,
        points: section.points
      }))
    )
  },
  {
    title: '第二部分 计算机组成原理（约45分）',
    weight: '45',
    sections: compositionOutline.flatMap(chapter =>
      chapter.sections.map(section => ({
        title: `${chapter.title} - ${section.title}`,
        points: section.points
      }))
    )
  },
  {
    title: '第三部分 操作系统（约35分）',
    weight: '35',
    sections: osOutline.flatMap(chapter =>
      chapter.sections.map(section => ({
        title: `${chapter.title} - ${section.title}`,
        points: section.points
      }))
    )
  },
  {
    title: '第四部分 计算机网络（约25分）',
    weight: '25',
    sections: networkOutline.flatMap(chapter =>
      chapter.sections.map(section => ({
        title: `${chapter.title} - ${section.title}`,
        points: section.points
      }))
    )
  }
]

const outlineMap: Record<string, any[]> = {
  cs408: cs408Outline,
  politics: politicsOutline,
  math: mathOutline
}

const currentOutline = computed(() => outlineMap[currentSubject.value] || [])

// 切换科目时重置展开状态（避免展开索引错位）
watch(currentSubject, () => {
  expandedChapters.value = new Set<number>([0])
})
</script>

<style scoped>
.outline-page {
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

/* 总体进度 */
.overall-progress-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: var(--glass-shadow);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.progress-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--mo-text-1);
  margin: 0;
}

.progress-total {
  font-size: 28px;
  font-weight: 700;
  color: #60a5fa;
  font-family: 'DIN Alternate', sans-serif;
}

/* 科目进度卡片 */
.subject-progress-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.subject-progress-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 20px;
  box-shadow: var(--glass-shadow);
  border-top: 2px solid rgba(59, 130, 246, 0.4);
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.subject-progress-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
}

.subject-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.subject-header h4 {
  font-size: 15px;
  font-weight: 600;
  color: var(--mo-text-1);
  margin: 0;
}

.subject-percent {
  font-size: 22px;
  font-weight: 700;
  font-family: 'DIN Alternate', sans-serif;
}

.subject-stats {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  font-size: 12px;
  color: var(--mo-text-3);
}

/* 大纲卡片 */
.outline-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 24px;
  box-shadow: var(--glass-shadow);
}

.outline-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.6);
}

.outline-tab {
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 14px;
  color: var(--mo-text-2);
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
  background: var(--mo-surface);
  border: 1px solid transparent;
}

.outline-tab:hover {
  background: var(--mo-surface-hover);
}

.outline-tab.active {
  color: #fff;
  background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
}

/* 进度调节 */
.progress-adjust {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px 20px;
  background: var(--mo-surface);
  border-radius: 10px;
}

.adjust-label {
  font-size: 14px;
  color: var(--mo-text-2);
  flex-shrink: 0;
}

/* 大纲树 */
.outline-tree {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chapter-item {
  border-radius: 10px;
  overflow: hidden;
}

.chapter-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: var(--mo-surface);
  cursor: pointer;
  transition: background 0.2s ease;
}

.chapter-header:hover {
  background: var(--mo-surface-hover);
}

.expand-icon {
  transition: transform 0.3s ease;
  color: var(--mo-text-3);
  flex-shrink: 0;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.chapter-title {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: var(--mo-text-1);
}

.chapter-content {
  padding: 12px 16px 12px 40px;
  background: var(--mo-surface);
}

.section-item {
  padding: 10px 0;
  border-bottom: 1px dashed var(--glass-border);
}

.section-item:last-child {
  border-bottom: none;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--mo-text-2);
  margin-bottom: 8px;
}

.section-points {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-left: 24px;
}

.point-tag {
  padding: 4px 10px;
  background: var(--mo-surface);
  border: 1px solid var(--mo-border);
  border-radius: 6px;
  font-size: 12px;
  color: var(--mo-text-2);
}
</style>
