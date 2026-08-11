<template>
  <div class="dictionary-page fade-in">
    <h1 class="page-title">单词词典</h1>
    <p class="page-subtitle">考研英语词汇速查 · 本地词库查不到的单词将自动在线查询</p>

    <!-- 搜索框 -->
    <div class="search-section">
      <el-input
        v-model="searchWord"
        placeholder="输入单词或中文释义搜索..."
        size="large"
        @keyup.enter="search"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
        <template #append>
          <el-button type="primary" @click="search">搜索</el-button>
        </template>
      </el-input>
    </div>

    <!-- 高频词分类 -->
    <div class="category-section">
      <div class="category-tabs">
        <div
          v-for="cat in categories"
          :key="cat.key"
          class="cat-item"
          :class="{ active: currentCategory === cat.key }"
          @click="currentCategory = cat.key"
        >
          {{ cat.name }}
          <span class="cat-count">{{ cat.count }}</span>
        </div>
      </div>
    </div>

    <!-- 在线查询加载中 -->
    <div class="online-searching" v-if="isSearchingOnline">
      <el-icon class="is-loading" :size="24" color="#3b82f6"><Loading /></el-icon>
      <span>本地词库未收录，正在在线查询 "{{ searchWord.trim() }}" ...</span>
    </div>

    <!-- 单词列表 -->
    <div class="word-list" v-if="displayWords.length > 0">
      <div
        v-for="word in displayWords"
        :key="word.word"
        class="word-card"
        @click="showWordDetail(word)"
      >
        <div class="word-header">
          <span class="word-text">{{ word.word }}</span>
          <span class="word-phonetic" v-if="word.phonetic">/{{ word.phonetic }}/</span>
          <el-tag size="small" :type="getLevelTagType(word.level)">
            {{ word.level }}
          </el-tag>
        </div>
        <div class="word-meaning">{{ word.meaning }}</div>
        <div class="word-actions">
          <el-button
            type="primary"
            link
            size="small"
            @click.stop="addToFlashcards(word)"
          >
            <el-icon><Plus /></el-icon>
            加入背诵
          </el-button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="empty-state" v-else-if="!isSearchingOnline">
      <template v-if="onlineSearchFailed && searchWord.trim()">
        <el-icon :size="64" color="#b0b6bd"><Warning /></el-icon>
        <p class="empty-text">未找到 "{{ searchWord.trim() }}" 的释义</p>
        <p class="empty-hint">本地词库未收录该词，在线查询也未获取到结果（可能是网络原因），请检查网络后重试</p>
      </template>
      <template v-else-if="searchWord.trim() && isEnglishWord(searchWord.trim()) && localMatchCount === 0">
        <el-icon :size="64" color="#b0b6bd"><Reading /></el-icon>
        <p class="empty-text">本地词库未收录 "{{ searchWord.trim() }}"</p>
        <p class="empty-hint">按回车键或点击「搜索」按钮，将自动在线查询该单词的音标与释义</p>
      </template>
      <template v-else>
        <el-icon :size="64" color="#b0b6bd"><Reading /></el-icon>
        <p class="empty-text">{{ searchWord ? '没有找到相关单词' : '开始搜索单词吧' }}</p>
      </template>
    </div>

    <!-- 单词详情弹窗 -->
    <el-dialog
      v-model="showDetail"
      :title="currentWord?.word"
      width="500px"
    >
      <div class="word-detail" v-if="currentWord">
        <div class="detail-header">
          <span class="detail-phonetic" v-if="currentWord.phonetic">
            /{{ currentWord.phonetic }}/
          </span>
          <el-tag :type="getLevelTagType(currentWord.level)">
            {{ currentWord.level }}
          </el-tag>
        </div>
        <div class="detail-section">
          <h4>释义</h4>
          <p>{{ currentWord.meaning }}</p>
        </div>
        <div class="detail-section" v-if="currentWord.example">
          <h4>例句</h4>
          <p class="example-en">{{ currentWord.example.en }}</p>
          <p class="example-cn">{{ currentWord.example.cn }}</p>
        </div>
      </div>
      <template #footer>
        <el-button @click="showDetail = false">关闭</el-button>
        <el-button type="primary" @click="addToFlashcards(currentWord!)">
          加入背诵卡片
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMainStore } from '@/stores'
import { ElMessage } from 'element-plus'
import { Search, Plus, Reading, Loading, Warning } from '@element-plus/icons-vue'

const store = useMainStore()

const searchWord = ref('')
const currentCategory = ref('high')
const showDetail = ref(false)
const currentWord = ref<WordItem | null>(null)

// 在线查询状态
const isSearchingOnline = ref(false)
const onlineWord = ref<WordItem | null>(null)
const onlineSearchFailed = ref(false)

interface WordItem {
  word: string
  phonetic: string
  meaning: string
  level: string
  example?: {
    en: string
    cn: string
  }
}

// 内置考研高频词汇
const wordDatabase: WordItem[] = [
  // 高频核心词 - A
  { word: 'abandon', phonetic: 'əˈbændən', meaning: 'v. 放弃，抛弃；离弃', level: '高频', example: { en: 'He abandoned his car and walked home.', cn: '他弃车步行回家。' } },
  { word: 'ability', phonetic: 'əˈbɪləti', meaning: 'n. 能力，才能；本领', level: '高频', example: { en: 'She has the ability to solve complex problems.', cn: '她有解决复杂问题的能力。' } },
  { word: 'absolute', phonetic: 'ˈæbsəluːt', meaning: 'adj. 绝对的，完全的；确实的', level: '高频', example: { en: 'There is no absolute truth in science.', cn: '科学中没有绝对真理。' } },
  { word: 'absorb', phonetic: 'əbˈzɔːrb', meaning: 'v. 吸收；吸引注意；理解掌握', level: '高频', example: { en: 'Plants absorb carbon dioxide from the air.', cn: '植物从空气中吸收二氧化碳。' } },
  { word: 'abstract', phonetic: 'ˈæbstrækt', meaning: 'adj. 抽象的 n. 摘要 v. 提取', level: '高频', example: { en: 'Beauty is an abstract concept.', cn: '美是一个抽象的概念。' } },
  { word: 'academic', phonetic: 'ˌækəˈdemɪk', meaning: 'adj. 学术的；学院的 n. 学者', level: '高频', example: { en: 'She has great academic achievements.', cn: '她有杰出的学术成就。' } },
  { word: 'accept', phonetic: 'əkˈsept', meaning: 'v. 接受，认可；同意', level: '高频', example: { en: 'I accept your apology.', cn: '我接受你的道歉。' } },
  { word: 'access', phonetic: 'ˈækses', meaning: 'n. 通道；使用权 v. 访问，存取', level: '高频', example: { en: 'Students have access to the library.', cn: '学生可以使用图书馆。' } },
  { word: 'accident', phonetic: 'ˈæksɪdənt', meaning: 'n. 事故，意外；偶然事件', level: '高频', example: { en: 'He was injured in a car accident.', cn: '他在车祸中受伤了。' } },
  { word: 'accompany', phonetic: 'əˈkʌmpəni', meaning: 'v. 陪伴，伴随；伴奏', level: '高频', example: { en: 'She accompanied me to the hospital.', cn: '她陪我去了医院。' } },
  { word: 'accomplish', phonetic: 'əˈkɑːmplɪʃ', meaning: 'v. 完成，实现；达到目的', level: '高频', example: { en: 'We accomplished our goal on time.', cn: '我们按时完成了目标。' } },
  { word: 'account', phonetic: 'əˈkaʊnt', meaning: 'n. 账户；描述 v. 解释；占比', level: '高频', example: { en: 'Please open a bank account.', cn: '请开一个银行账户。' } },
  { word: 'accurate', phonetic: 'ˈækjərət', meaning: 'adj. 准确的，精确的', level: '高频', example: { en: 'The data must be accurate.', cn: '数据必须准确。' } },
  { word: 'achieve', phonetic: 'əˈtʃiːv', meaning: 'v. 实现，达到；获得成就', level: '高频', example: { en: 'She achieved great success.', cn: '她取得了巨大的成功。' } },
  { word: 'acknowledge', phonetic: 'əkˈnɑːlɪdʒ', meaning: 'v. 承认；确认收到；感谢', level: '高频', example: { en: 'He acknowledged his mistake.', cn: '他承认了自己的错误。' } },
  { word: 'acquire', phonetic: 'əˈkwaɪər', meaning: 'v. 获得，取得；学到知识', level: '高频', example: { en: 'She acquired a lot of knowledge.', cn: '她获得了很多知识。' } },
  { word: 'adapt', phonetic: 'əˈdæpt', meaning: 'v. 适应；改编，改写', level: '高频', example: { en: 'You must adapt to the new environment.', cn: '你必须适应新环境。' } },
  { word: 'adequate', phonetic: 'ˈædɪkwət', meaning: 'adj. 足够的，适当的；合格的', level: '高频', example: { en: 'We have adequate time to finish.', cn: '我们有足够的时间完成。' } },
  { word: 'adjust', phonetic: 'əˈdʒʌst', meaning: 'v. 调整，调节；适应', level: '高频', example: { en: 'Please adjust the temperature.', cn: '请调节温度。' } },
  { word: 'admire', phonetic: 'ədˈmaɪər', meaning: 'v. 钦佩，赞赏；欣赏', level: '高频', example: { en: 'I admire her courage.', cn: '我钦佩她的勇气。' } },
  { word: 'adopt', phonetic: 'əˈdɑːpt', meaning: 'v. 采纳，采用；收养', level: '高频', example: { en: 'They adopted a new teaching method.', cn: '他们采用了新的教学方法。' } },
  { word: 'advance', phonetic: 'ədˈvæns', meaning: 'v. 前进，促进 n. 进步，进展', level: '高频', example: { en: 'Technology continues to advance rapidly.', cn: '技术继续快速发展。' } },
  { word: 'advantage', phonetic: 'ədˈvæntɪdʒ', meaning: 'n. 优势，有利条件；利益', level: '高频', example: { en: 'This method has many advantages.', cn: '这个方法有很多优点。' } },
  { word: 'adverse', phonetic: 'ˈædvɜːrs', meaning: 'adj. 不利的，有害的；相反的', level: '高频', example: { en: 'Adverse weather conditions delayed the flight.', cn: '恶劣天气延误了航班。' } },
  { word: 'advocate', phonetic: 'ˈædvəkeɪt', meaning: 'v. 提倡，倡导 n. 拥护者', level: '高频', example: { en: 'He advocates environmental protection.', cn: '他提倡环境保护。' } },
  { word: 'affect', phonetic: 'əˈfekt', meaning: 'v. 影响，作用于；感动', level: '高频', example: { en: 'The weather affects our mood.', cn: '天气影响我们的心情。' } },
  { word: 'afford', phonetic: 'əˈfɔːrd', meaning: 'v. 负担得起；提供，给予', level: '高频', example: { en: 'I cannot afford a new car.', cn: '我买不起新车。' } },
  { word: 'aggressive', phonetic: 'əˈɡresɪv', meaning: 'adj. 好斗的；有进取心的；积极的', level: '高频', example: { en: 'He is aggressive in his approach.', cn: '他的做法很有冲劲。' } },
  { word: 'allocate', phonetic: 'ˈæləkeɪt', meaning: 'v. 分配，分派；拨出', level: '高频', example: { en: 'Resources should be allocated wisely.', cn: '资源应该合理分配。' } },
  { word: 'alternative', phonetic: 'ɔːlˈtɜːrnətɪv', meaning: 'n. 替代品，选择 adj. 供选择的', level: '高频', example: { en: 'We have no alternative but to wait.', cn: '我们别无选择，只能等待。' } },
  { word: 'analyze', phonetic: 'ˈænəlaɪz', meaning: 'v. 分析，解析；细察', level: '高频', example: { en: 'We need to analyze the data carefully.', cn: '我们需要仔细分析数据。' } },
  { word: 'annual', phonetic: 'ˈænjuəl', meaning: 'adj. 每年的，年度的 n. 年刊', level: '高频', example: { en: 'The annual meeting was held in May.', cn: '年会于五月举行。' } },
  { word: 'anticipate', phonetic: 'ænˈtɪsɪpeɪt', meaning: 'v. 预期，期望；先于…行动', level: '高频', example: { en: 'We anticipate a rise in prices.', cn: '我们预期价格会上涨。' } },
  { word: 'apparent', phonetic: 'əˈpærənt', meaning: 'adj. 明显的，显而易见的；表面的', level: '高频', example: { en: 'The reason was apparent to everyone.', cn: '原因对每个人来说都很明显。' } },
  { word: 'apply', phonetic: 'əˈplaɪ', meaning: 'v. 应用；申请；涂抹', level: '高频', example: { en: 'The rules apply to everyone.', cn: '这些规则适用于每个人。' } },
  { word: 'approach', phonetic: 'əˈproʊtʃ', meaning: 'v. 接近 n. 方法，途径；接近', level: '高频', example: { en: 'We need a new approach to this problem.', cn: '我们需要解决这个问题的新方法。' } },
  { word: 'appropriate', phonetic: 'əˈproʊpriət', meaning: 'adj. 适当的，恰当的 v. 拨出', level: '高频', example: { en: 'Choose an appropriate time to talk.', cn: '选择一个合适的时间谈话。' } },
  { word: 'assess', phonetic: 'əˈses', meaning: 'v. 评估，评定；估算', level: '高频', example: { en: 'We need to assess the risks.', cn: '我们需要评估风险。' } },
  { word: 'assign', phonetic: 'əˈsaɪn', meaning: 'v. 分配，指派；指定', level: '高频', example: { en: 'The teacher assigned homework.', cn: '老师布置了作业。' } },
  { word: 'associate', phonetic: 'əˈsoʊʃieɪt', meaning: 'v. 联想，联系 n. 同事 adj. 副的', level: '高频', example: { en: 'I associate summer with happiness.', cn: '我把夏天与幸福联系在一起。' } },
  { word: 'assume', phonetic: 'əˈsuːm', meaning: 'v. 假设，假定；承担；呈现', level: '高频', example: { en: 'I assume you already know the news.', cn: '我猜你已经知道这个消息了。' } },
  { word: 'attempt', phonetic: 'əˈtempt', meaning: 'v. 尝试，企图 n. 尝试，努力', level: '高频', example: { en: 'He attempted to escape from prison.', cn: '他企图越狱。' } },
  { word: 'attend', phonetic: 'əˈtend', meaning: 'v. 出席，参加；照料，护理', level: '高频', example: { en: 'She attended the conference yesterday.', cn: '她昨天参加了会议。' } },
  { word: 'attribute', phonetic: 'əˈtrɪbjuːt', meaning: 'v. 归因于 n. 属性，特质', level: '高频', example: { en: 'She attributes her success to hard work.', cn: '她把成功归因于努力工作。' } },
  { word: 'authority', phonetic: 'əˈθɔːrəti', meaning: 'n. 权威，权力；当局，官方', level: '高频', example: { en: 'He is an authority on this subject.', cn: '他是这个领域的权威。' } },
  { word: 'available', phonetic: 'əˈveɪləbl', meaning: 'adj. 可用的，可获得的；有空的', level: '高频', example: { en: 'The book is available in the library.', cn: '这本书在图书馆可以借到。' } },
  { word: 'average', phonetic: 'ˈævərɪdʒ', meaning: 'n. 平均数 adj. 平均的；普通的', level: '高频', example: { en: 'The average age of the students is 20.', cn: '学生的平均年龄是20岁。' } },
  { word: 'avoid', phonetic: 'əˈvɔɪd', meaning: 'v. 避免，防止；逃避', level: '高频', example: { en: 'You should avoid making the same mistake.', cn: '你应该避免犯同样的错误。' } },

  // 高频核心词 - B
  { word: 'barrier', phonetic: 'ˈbæriər', meaning: 'n. 障碍，屏障；栅栏', level: '高频', example: { en: 'Language is a barrier to communication.', cn: '语言是沟通的障碍。' } },
  { word: 'benefit', phonetic: 'ˈbenɪfɪt', meaning: 'n. 利益，好处 v. 有益于；受益', level: '高频', example: { en: 'Exercise benefits your health.', cn: '锻炼有益于健康。' } },
  { word: 'blame', phonetic: 'bleɪm', meaning: 'v. 责备，归咎于 n. 责备，责任', level: '高频', example: { en: 'Don\'t blame others for your mistakes.', cn: '不要把你的错误归咎于别人。' } },

  // 高频核心词 - C
  { word: 'calculate', phonetic: 'ˈkælkjuleɪt', meaning: 'v. 计算，估算；打算', level: '高频', example: { en: 'Calculate the total cost carefully.', cn: '仔细计算总成本。' } },
  { word: 'campaign', phonetic: 'kæmˈpeɪn', meaning: 'n. 运动，活动；战役', level: '高频', example: { en: 'The election campaign has begun.', cn: '竞选活动已经开始了。' } },
  { word: 'capacity', phonetic: 'kəˈpæsəti', meaning: 'n. 容量，能力；身份', level: '高频', example: { en: 'The stadium has a capacity of 50,000.', cn: '体育场可容纳5万人。' } },
  { word: 'capture', phonetic: 'ˈkæptʃər', meaning: 'v. 捕获，俘获；夺取', level: '高频', example: { en: 'The photo captured a beautiful moment.', cn: '这张照片捕捉到了一个美丽的瞬间。' } },
  { word: 'career', phonetic: 'kəˈrɪr', meaning: 'n. 职业，事业；生涯', level: '高频', example: { en: 'She has a successful career in medicine.', cn: '她在医学领域有成功的职业生涯。' } },
  { word: 'category', phonetic: 'ˈkætəɡəri', meaning: 'n. 类别，种类；范畴', level: '高频', example: { en: 'This book falls into the science category.', cn: '这本书属于科学类别。' } },
  { word: 'challenge', phonetic: 'ˈtʃælɪndʒ', meaning: 'n. 挑战 v. 向…挑战；质疑', level: '高频', example: { en: 'This is a great challenge for us.', cn: '这对我们来说是巨大的挑战。' } },
  { word: 'channel', phonetic: 'ˈtʃænl', meaning: 'n. 渠道，通道；频道', level: '高频', example: { en: 'We should find a new channel of communication.', cn: '我们应该寻找新的沟通渠道。' } },
  { word: 'character', phonetic: 'ˈkærəktər', meaning: 'n. 性格，特征；角色；字符', level: '高频', example: { en: 'She has a strong character.', cn: '她性格坚强。' } },
  { word: 'chemical', phonetic: 'ˈkemɪkl', meaning: 'adj. 化学的 n. 化学品', level: '高频', example: { en: 'The chemical reaction produced heat.', cn: '化学反应产生了热量。' } },
  { word: 'circumstance', phonetic: 'ˈsɜːrkəmstæns', meaning: 'n. 情况，条件；环境', level: '高频', example: { en: 'Under no circumstances should you give up.', cn: '在任何情况下你都不应该放弃。' } },
  { word: 'climate', phonetic: 'ˈklaɪmət', meaning: 'n. 气候；风气，氛围', level: '高频', example: { en: 'Climate change is a global problem.', cn: '气候变化是一个全球性问题。' } },
  { word: 'collapse', phonetic: 'kəˈlæps', meaning: 'v. 倒塌，崩溃 n. 崩溃，失败', level: '高频', example: { en: 'The building collapsed during the earthquake.', cn: '大楼在地震中倒塌了。' } },
  { word: 'colleague', phonetic: 'ˈkɑːliːɡ', meaning: 'n. 同事，同僚', level: '高频', example: { en: 'She discussed the plan with her colleagues.', cn: '她与同事们讨论了这个计划。' } },
  { word: 'command', phonetic: 'kəˈmænd', meaning: 'v. 命令，指挥 n. 命令；指挥', level: '高频', example: { en: 'The captain commanded the soldiers to advance.', cn: '队长命令士兵前进。' } },
  { word: 'commercial', phonetic: 'kəˈmɜːrʃl', meaning: 'adj. 商业的 n. 商业广告', level: '高频', example: { en: 'The commercial center is very busy.', cn: '商业中心非常繁忙。' } },
  { word: 'commit', phonetic: 'kəˈmɪt', meaning: 'v. 犯（罪）；承诺；投入', level: '高频', example: { en: 'He committed himself to the project.', cn: '他全身心投入到这个项目中。' } },
  { word: 'communicate', phonetic: 'kəˈmjuːnɪkeɪt', meaning: 'v. 沟通，传达；通讯', level: '高频', example: { en: 'We communicate mainly by email.', cn: '我们主要通过电子邮件沟通。' } },
  { word: 'community', phonetic: 'kəˈmjuːnəti', meaning: 'n. 社区，社会；团体', level: '高频', example: { en: 'The local community organized a festival.', cn: '当地社区组织了一个节日活动。' } },
  { word: 'companion', phonetic: 'kəmˈpænjən', meaning: 'n. 同伴，伙伴；伴侣', level: '高频', example: { en: 'The dog was his faithful companion.', cn: '那只狗是他忠实的伙伴。' } },
  { word: 'compare', phonetic: 'kəmˈper', meaning: 'v. 比较，对比；比喻', level: '高频', example: { en: 'Compare the two pictures carefully.', cn: '仔细比较这两张图片。' } },
  { word: 'compensate', phonetic: 'ˈkɑːmpenseɪt', meaning: 'v. 补偿，赔偿；弥补', level: '高频', example: { en: 'Nothing can compensate for the loss of health.', cn: '没有什么能弥补健康的损失。' } },
  { word: 'compete', phonetic: 'kəmˈpiːt', meaning: 'v. 竞争，比赛；对抗', level: '高频', example: { en: 'Companies compete for market share.', cn: '公司之间竞争市场份额。' } },
  { word: 'complex', phonetic: 'ˈkɑːmpleks', meaning: 'adj. 复杂的 n. 综合体，情结', level: '高频', example: { en: 'This is a very complex problem.', cn: '这是一个非常复杂的问题。' } },
  { word: 'component', phonetic: 'kəmˈpoʊnənt', meaning: 'n. 组成部分，成分；元件', level: '高频', example: { en: 'The engine has many components.', cn: '发动机有许多零部件。' } },
  { word: 'compose', phonetic: 'kəmˈpoʊz', meaning: 'v. 组成，构成；创作；使平静', level: '高频', example: { en: 'The committee is composed of 12 members.', cn: '委员会由12名成员组成。' } },
  { word: 'comprehensive', phonetic: 'ˌkɑːmprɪˈhensɪv', meaning: 'adj. 全面的，综合的；广泛的', level: '高频', example: { en: 'We need a comprehensive plan.', cn: '我们需要一个全面的计划。' } },
  { word: 'concentrate', phonetic: 'ˈkɑːnsntreɪt', meaning: 'v. 集中注意力；浓缩 n. 浓缩物', level: '高频', example: { en: 'I can\'t concentrate on my work.', cn: '我无法集中精力工作。' } },
  { word: 'concept', phonetic: 'ˈkɑːnsept', meaning: 'n. 概念，观念；思想', level: '高频', example: { en: 'This is a new concept in education.', cn: '这是教育中的一个新概念。' } },
  { word: 'conclude', phonetic: 'kənˈkluːd', meaning: 'v. 结束，总结；推断出', level: '高频', example: { en: 'The report concluded that the project was successful.', cn: '报告得出结论，该项目是成功的。' } },
  { word: 'concrete', phonetic: 'ˈkɑːnkriːt', meaning: 'adj. 具体的，实际的 n. 混凝土', level: '高频', example: { en: 'Give me a concrete example.', cn: '给我一个具体的例子。' } },
  { word: 'conduct', phonetic: 'kənˈdʌkt', meaning: 'v. 实施，进行；指挥 n. 行为', level: '高频', example: { en: 'The scientists conducted an experiment.', cn: '科学家们进行了一项实验。' } },
  { word: 'confident', phonetic: 'ˈkɑːnfɪdənt', meaning: 'adj. 自信的，有信心的', level: '高频', example: { en: 'She is confident about the exam.', cn: '她对考试充满信心。' } },
  { word: 'confine', phonetic: 'kənˈfaɪn', meaning: 'v. 限制， confine n. 范围，界限', level: '高频', example: { en: 'Please confine your remarks to the topic.', cn: '请把你的发言限制在话题范围内。' } },
  { word: 'confirm', phonetic: 'kənˈfɜːrm', meaning: 'v. 确认，证实；批准', level: '高频', example: { en: 'Please confirm your reservation by email.', cn: '请通过电子邮件确认您的预订。' } },
  { word: 'conflict', phonetic: 'ˈkɑːnflɪkt', meaning: 'n. 冲突，矛盾 v. 冲突，抵触', level: '高频', example: { en: 'There is a conflict between the two countries.', cn: '这两个国家之间存在冲突。' } },
  { word: 'conscious', phonetic: 'ˈkɑːnʃəs', meaning: 'adj. 有意识的；自觉的；神志清醒的', level: '高频', example: { en: 'He was conscious of his mistake.', cn: '他意识到了自己的错误。' } },
  { word: 'consequence', phonetic: 'ˈkɑːnsɪkwens', meaning: 'n. 结果，后果；重要性', level: '高频', example: { en: 'You must face the consequences.', cn: '你必须面对后果。' } },
  { word: 'conservative', phonetic: 'kənˈsɜːrvətɪv', meaning: 'adj. 保守的 n. 保守派', level: '高频', example: { en: 'He has conservative views on education.', cn: '他在教育方面持保守观点。' } },
  { word: 'consider', phonetic: 'kənˈsɪdər', meaning: 'v. 考虑；认为；体谅', level: '高频', example: { en: 'Please consider my suggestion carefully.', cn: '请仔细考虑我的建议。' } },
  { word: 'consist', phonetic: 'kənˈsɪst', meaning: 'v. 由…组成；在于', level: '高频', example: { en: 'The exam consists of three parts.', cn: '考试由三部分组成。' } },
  { word: 'constant', phonetic: 'ˈkɑːnstənt', meaning: 'adj. 不断的，恒定的 n. 常数', level: '高频', example: { en: 'The speed of light is a constant.', cn: '光速是一个常数。' } },
  { word: 'construct', phonetic: 'kənˈstrʌkt', meaning: 'v. 建造，构建 n. 构想', level: '高频', example: { en: 'They constructed a bridge over the river.', cn: '他们在河上建了一座桥。' } },
  { word: 'consult', phonetic: 'kənˈsʌlt', meaning: 'v. 咨询，请教；查阅', level: '高频', example: { en: 'You should consult a doctor.', cn: '你应该咨询医生。' } },
  { word: 'consume', phonetic: 'kənˈsuːm', meaning: 'v. 消耗，消费；吃喝', level: '高频', example: { en: 'The car consumes a lot of fuel.', cn: '这辆车消耗大量燃料。' } },
  { word: 'contact', phonetic: 'ˈkɑːntækt', meaning: 'n. 接触，联系 v. 联系', level: '高频', example: { en: 'Please contact me if you have any questions.', cn: '如有问题请联系我。' } },
  { word: 'contain', phonetic: 'kənˈteɪn', meaning: 'v. 包含，含有；控制', level: '高频', example: { en: 'The box contains many books.', cn: '箱子里装了很多书。' } },
  { word: 'context', phonetic: 'ˈkɑːntekst', meaning: 'n. 语境，上下文；背景', level: '高频', example: { en: 'The word has different meanings in different contexts.', cn: '这个词在不同语境中有不同含义。' } },
  { word: 'contribute', phonetic: 'kənˈtrɪbjuːt', meaning: 'v. 贡献，捐献；投稿', level: '高频', example: { en: 'Everyone should contribute to society.', cn: '每个人都应该为社会做贡献。' } },
  { word: 'controversial', phonetic: 'ˌkɑːntrəˈvɜːrʃl', meaning: 'adj. 有争议的，引起争论的', level: '高频', example: { en: 'This is a controversial issue.', cn: '这是一个有争议的问题。' } },
  { word: 'convenient', phonetic: 'kənˈviːniənt', meaning: 'adj. 方便的，便利的', level: '高频', example: { en: 'Is it convenient for you to meet tomorrow?', cn: '你明天见面方便吗？' } },
  { word: 'convince', phonetic: 'kənˈvɪns', meaning: 'v. 说服，使确信', level: '高频', example: { en: 'I convinced him to change his mind.', cn: '我说服他改变了主意。' } },
  { word: 'cooperate', phonetic: 'koʊˈɑːpəreɪt', meaning: 'v. 合作，协作；配合', level: '高频', example: { en: 'The two companies decided to cooperate.', cn: '两家公司决定合作。' } },
  { word: 'cope', phonetic: 'koʊp', meaning: 'v. 应付，处理；对付', level: '高频', example: { en: 'How do you cope with stress?', cn: '你如何应对压力？' } },
  { word: 'core', phonetic: 'kɔːr', meaning: 'n. 核心，中心 adj. 核心的', level: '高频', example: { en: 'This is the core issue of the debate.', cn: '这是辩论的核心问题。' } },
  { word: 'critical', phonetic: 'ˈkrɪtɪkl', meaning: 'adj. 关键的；批评的；危急的', level: '高频', example: { en: 'Critical thinking is important in research.', cn: '批判性思维在研究中很重要。' } },
  { word: 'crucial', phonetic: 'ˈkruːʃl', meaning: 'adj. 至关重要的，决定性的', level: '高频', example: { en: 'This is a crucial moment in the game.', cn: '这是比赛中的关键时刻。' } },
  { word: 'cultivate', phonetic: 'ˈkʌltɪveɪt', meaning: 'v. 培养，养成；耕种', level: '高频', example: { en: 'We should cultivate good habits.', cn: '我们应该培养良好的习惯。' } },
  { word: 'curriculum', phonetic: 'kəˈrɪkjələm', meaning: 'n. 课程，课程体系', level: '高频', example: { en: 'The school revised its curriculum.', cn: '学校修订了课程体系。' } },

  // 高频核心词 - D/E/F
  { word: 'debate', phonetic: 'dɪˈbeɪt', meaning: 'n. 辩论，争论 v. 辩论', level: '高频', example: { en: 'The debate lasted for three hours.', cn: '辩论持续了三个小时。' } },
  { word: 'decade', phonetic: 'ˈdekeɪd', meaning: 'n. 十年', level: '高频', example: { en: 'Great changes have taken place in the last decade.', cn: '在过去十年中发生了巨大变化。' } },
  { word: 'decline', phonetic: 'dɪˈklaɪn', meaning: 'v. 下降，衰退；拒绝 n. 下降', level: '高频', example: { en: 'The population is declining rapidly.', cn: '人口正在迅速下降。' } },
  { word: 'demonstrate', phonetic: 'ˈdemənstreɪt', meaning: 'v. 证明，演示；示威', level: '高频', example: { en: 'He demonstrated the new method.', cn: '他演示了新方法。' } },
  { word: 'depart', phonetic: 'dɪˈpɑːrt', meaning: 'v. 离开，出发；偏离', level: '高频', example: { en: 'The train departs at 9 a.m.', cn: '火车上午9点出发。' } },
  { word: 'deposit', phonetic: 'dɪˈpɑːzɪt', meaning: 'v. 存放，存款 n. 存款；押金', level: '高频', example: { en: 'She deposited money in the bank.', cn: '她把钱存入了银行。' } },
  { word: 'derive', phonetic: 'dɪˈraɪv', meaning: 'v. 源于，得到；推导', level: '高频', example: { en: 'The word derives from Latin.', cn: '这个词源于拉丁语。' } },
  { word: 'desperate', phonetic: 'ˈdespərət', meaning: 'adj. 绝望的；拼命的；极度的', level: '高频', example: { en: 'He was desperate for help.', cn: '他急需帮助。' } },
  { word: 'dimension', phonetic: 'dɪˈmenʃn', meaning: 'n. 尺寸，维度；方面', level: '高频', example: { en: 'The problem has many dimensions.', cn: '这个问题有很多方面。' } },
  { word: 'diminish', phonetic: 'dɪˈmɪnɪʃ', meaning: 'v. 减少，缩小；贬低', level: '高频', example: { en: 'His influence has diminished over time.', cn: '他的影响力随着时间的推移而减弱。' } },
  { word: 'discipline', phonetic: 'ˈdɪsəplɪn', meaning: 'n. 纪律，学科 v. 训练', level: '高频', example: { en: 'Discipline is important in learning.', cn: '纪律在学习中很重要。' } },
  { word: 'discrimination', phonetic: 'dɪˌskrɪmɪˈneɪʃn', meaning: 'n. 歧视；辨别力', level: '高频', example: { en: 'Racial discrimination is illegal.', cn: '种族歧视是违法的。' } },
  { word: 'dispute', phonetic: 'dɪˈspjuːt', meaning: 'n. 争论，纠纷 v. 争论', level: '高频', example: { en: 'The dispute was settled in court.', cn: '这场纠纷在法庭上得到了解决。' } },
  { word: 'distinct', phonetic: 'dɪˈstɪŋkt', meaning: 'adj. 不同的，明显的；明确的', level: '高频', example: { en: 'There is a distinct difference between them.', cn: '它们之间有明显的区别。' } },
  { word: 'distinguish', phonetic: 'dɪˈstɪŋɡwɪʃ', meaning: 'v. 区分，辨别；使杰出', level: '高频', example: { en: 'It\'s hard to distinguish the twins.', cn: '很难区分这对双胞胎。' } },
  { word: 'domestic', phonetic: 'dəˈmestɪk', meaning: 'adj. 国内的，家庭的；驯养的', level: '高频', example: { en: 'The domestic economy is improving.', cn: '国内经济正在改善。' } },
  { word: 'dominate', phonetic: 'ˈdɑːmɪneɪt', meaning: 'v. 支配，统治；占主导', level: '高频', example: { en: 'One team dominated the game.', cn: '一支球队主宰了整场比赛。' } },
  { word: 'dramatic', phonetic: 'drəˈmætɪk', meaning: 'adj. 戏剧性的；巨大的；突然的', level: '高频', example: { en: 'There has been a dramatic increase in prices.', cn: '价格出现了大幅上涨。' } },
  { word: 'duration', phonetic: 'duˈreɪʃn', meaning: 'n. 持续时间，期间', level: '高频', example: { en: 'The duration of the flight is 10 hours.', cn: '飞行时间为10小时。' } },
  { word: 'dynamic', phonetic: 'daɪˈnæmɪk', meaning: 'adj. 动态的；有活力的 n. 动力', level: '高频', example: { en: 'She is a dynamic and creative person.', cn: '她是一个充满活力和创造力的人。' } },
  { word: 'efficient', phonetic: 'ɪˈfɪʃnt', meaning: 'adj. 高效的，有效率的', level: '高频', example: { en: 'This is an efficient way to study.', cn: '这是一种高效的学习方法。' } },
  { word: 'eliminate', phonetic: 'ɪˈlɪmɪneɪt', meaning: 'v. 消除，排除；淘汰', level: '高频', example: { en: 'We must eliminate all errors.', cn: '我们必须消除所有错误。' } },
  { word: 'embrace', phonetic: 'ɪmˈbreɪs', meaning: 'v. 拥抱；接受，采纳 n. 拥抱', level: '高频', example: { en: 'She embraced the new technology.', cn: '她接受了新技术。' } },
  { word: 'emerge', phonetic: 'ɪˈmɜːrdʒ', meaning: 'v. 出现，浮现；兴起', level: '高频', example: { en: 'New problems have emerged.', cn: '新问题出现了。' } },
  { word: 'emphasize', phonetic: 'ˈemfəsaɪz', meaning: 'v. 强调，着重', level: '高频', example: { en: 'He emphasized the importance of study.', cn: '他强调了学习的重要性。' } },
  { word: 'encounter', phonetic: 'ɪnˈkaʊntər', meaning: 'v. 遭遇，遇到 n. 遭遇', level: '高频', example: { en: 'We encountered many difficulties.', cn: '我们遇到了很多困难。' } },
  { word: 'enforce', phonetic: 'ɪnˈfɔːrs', meaning: 'v. 执行，实施；强迫', level: '高频', example: { en: 'The police enforce the law.', cn: '警察执法。' } },
  { word: 'enhance', phonetic: 'ɪnˈhæns', meaning: 'v. 增强，提高；改善', level: '高频', example: { en: 'Exercise can enhance your health.', cn: '锻炼可以增强你的体质。' } },
  { word: 'ensure', phonetic: 'ɪnˈʃʊr', meaning: 'v. 确保，保证', level: '高频', example: { en: 'Ensure that all doors are locked.', cn: '确保所有的门都锁好了。' } },
  { word: 'environment', phonetic: 'ɪnˈvaɪrənmənt', meaning: 'n. 环境，周围的事物', level: '高频', example: { en: 'We should protect the environment.', cn: '我们应该保护环境。' } },
  { word: 'episode', phonetic: 'ˈepɪsoʊd', meaning: 'n. 一段经历，事件；（剧集的）一集', level: '高频', example: { en: 'This episode changed his life.', cn: '这段经历改变了他的生活。' } },
  { word: 'essential', phonetic: 'ɪˈsenʃl', meaning: 'adj. 必要的，本质的 n. 要素', level: '高频', example: { en: 'Water is essential for life.', cn: '水是生命不可缺少的。' } },
  { word: 'establish', phonetic: 'ɪˈstæblɪʃ', meaning: 'v. 建立，设立；确立', level: '高频', example: { en: 'The company was established in 1990.', cn: '这家公司成立于1990年。' } },
  { word: 'evaluate', phonetic: 'ɪˈvæljueɪt', meaning: 'v. 评估，评价；估价', level: '高频', example: { en: 'We need to evaluate the results.', cn: '我们需要评估结果。' } },
  { word: 'eventually', phonetic: 'ɪˈventʃuəli', meaning: 'adv. 最终，终于', level: '高频', example: { en: 'He eventually became a doctor.', cn: '他最终成为了一名医生。' } },
  { word: 'evidence', phonetic: 'ˈevɪdəns', meaning: 'n. 证据，证明', level: '高频', example: { en: 'There is no evidence to support this claim.', cn: '没有证据支持这一说法。' } },
  { word: 'evolve', phonetic: 'ɪˈvɑːlv', meaning: 'v. 进化，演变；逐步发展', level: '高频', example: { en: 'The plan evolved over time.', cn: '这个计划随着时间的推移逐步发展。' } },
  { word: 'exaggerate', phonetic: 'ɪɡˈzædʒəreɪt', meaning: 'v. 夸大，夸张', level: '高频', example: { en: 'Don\'t exaggerate the problem.', cn: '不要夸大问题。' } },
  { word: 'exclude', phonetic: 'ɪkˈskluːd', meaning: 'v. 排除，排斥；不包括', level: '高频', example: { en: 'We cannot exclude this possibility.', cn: '我们不能排除这种可能性。' } },
  { word: 'exploit', phonetic: 'ɪkˈsplɔɪt', meaning: 'v. 开发，利用；剥削', level: '高频', example: { en: 'We should exploit renewable energy sources.', cn: '我们应该开发可再生能源。' } },
  { word: 'explore', phonetic: 'ɪkˈsplɔːr', meaning: 'v. 探索，探究；勘探', level: '高频', example: { en: 'Scientists explore the mysteries of space.', cn: '科学家探索太空的奥秘。' } },
  { word: 'expose', phonetic: 'ɪkˈspoʊz', meaning: 'v. 暴露，揭露；使接触', level: '高频', example: { en: 'The report exposed the truth.', cn: '报告揭露了真相。' } },
  { word: 'extend', phonetic: 'ɪkˈstend', meaning: 'v. 延伸，扩展；延长', level: '高频', example: { en: 'The road extends for miles.', cn: '这条路延伸了好几英里。' } },
  { word: 'external', phonetic: 'ɪkˈstɜːrnl', meaning: 'adj. 外部的，外面的；对外的', level: '高频', example: { en: 'The external appearance of the building is impressive.', cn: '这栋建筑的外观令人印象深刻。' } },
  { word: 'facilitate', phonetic: 'fəˈsɪlɪteɪt', meaning: 'v. 促进，使便利', level: '高频', example: { en: 'Technology facilitates communication.', cn: '技术促进了沟通。' } },
  { word: 'feature', phonetic: 'ˈfiːtʃər', meaning: 'n. 特征，特色 v. 以…为特色', level: '高频', example: { en: 'This phone has many new features.', cn: '这款手机有很多新功能。' } },
  { word: 'flexible', phonetic: 'ˈfleksəbl', meaning: 'adj. 灵活的，柔韧的', level: '高频', example: { en: 'We need a flexible schedule.', cn: '我们需要一个灵活的时间表。' } },
  { word: 'flourish', phonetic: 'ˈflɜːrɪʃ', meaning: 'v. 繁荣，兴旺；茁壮成长', level: '高频', example: { en: 'The business is flourishing.', cn: '生意兴隆。' } },
  { word: 'fundamental', phonetic: 'ˌfʌndəˈmentl', meaning: 'adj. 基本的，根本的 n. 基本原则', level: '高频', example: { en: 'This is a fundamental principle.', cn: '这是一条基本原则。' } },

  // 中频词汇
  { word: 'generate', phonetic: 'ˈdʒenəreɪt', meaning: 'v. 产生，生成；引起', level: '中频', example: { en: 'The factory generates electricity.', cn: '这家工厂发电。' } },
  { word: 'genuine', phonetic: 'ˈdʒenjuɪn', meaning: 'adj. 真正的，真诚的', level: '中频', example: { en: 'She showed genuine concern for others.', cn: '她对他人表现出真诚的关心。' } },
  { word: 'global', phonetic: 'ˈɡloʊbl', meaning: 'adj. 全球的，全世界的；全面的', level: '中频', example: { en: 'Global warming is a serious problem.', cn: '全球变暖是一个严重的问题。' } },
  { word: 'grant', phonetic: 'ɡrænt', meaning: 'v. 授予，批准；承认 n. 拨款', level: '中频', example: { en: 'The university granted him a scholarship.', cn: '大学授予他奖学金。' } },
  { word: 'guarantee', phonetic: 'ˌɡærənˈtiː', meaning: 'v. 保证，担保 n. 保证，担保', level: '中频', example: { en: 'I guarantee the quality of this product.', cn: '我保证这个产品的质量。' } },
  { word: 'highlight', phonetic: 'ˈhaɪlaɪt', meaning: 'v. 强调，突出 n. 最精彩部分', level: '中频', example: { en: 'The report highlights several key issues.', cn: '报告强调了几个关键问题。' } },
  { word: 'horizon', phonetic: 'həˈraɪzn', meaning: 'n. 地平线；视野，眼界', level: '中频', example: { en: 'The sun set below the horizon.', cn: '太阳落到地平线以下了。' } },
  { word: 'hypothesis', phonetic: 'haɪˈpɑːθəsɪs', meaning: 'n. 假设，假说', level: '中频', example: { en: 'The hypothesis needs to be tested.', cn: '这个假设需要验证。' } },
  { word: 'identical', phonetic: 'aɪˈdentɪkl', meaning: 'adj. 完全相同的，同一的', level: '中频', example: { en: 'The two paintings are identical.', cn: '这两幅画完全相同。' } },
  { word: 'identify', phonetic: 'aɪˈdentɪfaɪ', meaning: 'v. 识别，确认；认同', level: '中频', example: { en: 'Can you identify the suspect?', cn: '你能辨认出嫌疑人吗？' } },
  { word: 'ideology', phonetic: 'ˌaɪdiˈɑːlədʒi', meaning: 'n. 意识形态，思想体系', level: '中频', example: { en: 'Political ideology varies across cultures.', cn: '政治意识形态因文化而异。' } },
  { word: 'ignore', phonetic: 'ɪɡˈnɔːr', meaning: 'v. 忽视，忽略；不理睬', level: '中频', example: { en: 'You cannot ignore this problem.', cn: '你不能忽视这个问题。' } },
  { word: 'illustrate', phonetic: 'ˈɪləstreɪt', meaning: 'v. 说明，阐明；给…插图', level: '中频', example: { en: 'The chart illustrates the trend.', cn: '图表说明了这一趋势。' } },
  { word: 'implement', phonetic: 'ˈɪmplɪment', meaning: 'v. 实施，执行 n. 工具', level: '中频', example: { en: 'We will implement the new policy.', cn: '我们将实施新政策。' } },
  { word: 'implication', phonetic: 'ˌɪmplɪˈkeɪʃn', meaning: 'n. 含义，暗示；牵连；影响', level: '中频', example: { en: 'The findings have important implications.', cn: '这些发现具有重要意义。' } },
  { word: 'impose', phonetic: 'ɪmˈpoʊz', meaning: 'v. 强加，征收；施加', level: '中频', example: { en: 'The government imposed a new tax.', cn: '政府征收了一项新税。' } },
  { word: 'incentive', phonetic: 'ɪnˈsentɪv', meaning: 'n. 激励，动机 adj. 激励的', level: '中频', example: { en: 'Financial incentives motivate employees.', cn: '经济激励能激发员工的积极性。' } },
  { word: 'incidence', phonetic: 'ˈɪnsɪdəns', meaning: 'n. 发生率，发病率', level: '中频', example: { en: 'The incidence of the disease has increased.', cn: '这种疾病的发病率增加了。' } },
  { word: 'incorporate', phonetic: 'ɪnˈkɔːrpəreɪt', meaning: 'v. 包含，纳入；合并', level: '中频', example: { en: 'We incorporated their suggestions into the plan.', cn: '我们把他们的建议纳入了计划。' } },
  { word: 'index', phonetic: 'ˈɪndeks', meaning: 'n. 索引；指数 v. 编索引', level: '中频', example: { en: 'The stock market index rose sharply.', cn: '股市指数大幅上涨。' } },
  { word: 'inevitable', phonetic: 'ɪnˈevɪtəbl', meaning: 'adj. 不可避免的，必然的', level: '中频', example: { en: 'Change is inevitable.', cn: '变化是不可避免的。' } },
  { word: 'inherent', phonetic: 'ɪnˈhɪrənt', meaning: 'adj. 固有的，内在的', level: '中频', example: { en: 'There are inherent risks in any investment.', cn: '任何投资都有固有的风险。' } },
  { word: 'initial', phonetic: 'ɪˈnɪʃl', meaning: 'adj. 最初的，开始的 v. 签名', level: '中频', example: { en: 'The initial response was positive.', cn: '最初的反应是积极的。' } },
  { word: 'inquire', phonetic: 'ɪnˈkwaɪər', meaning: 'v. 询问，打听；调查', level: '中频', example: { en: 'I inquired about the job opening.', cn: '我打听了一下那个职位空缺。' } },
  { word: 'insight', phonetic: 'ˈɪnsaɪt', meaning: 'n. 洞察力，深刻见解', level: '中频', example: { en: 'The book provides valuable insights.', cn: '这本书提供了宝贵的见解。' } },
  { word: 'inspect', phonetic: 'ɪnˈspekt', meaning: 'v. 检查，审查；视察', level: '中频', example: { en: 'The officer inspected the factory.', cn: '官员视察了工厂。' } },
  { word: 'integrate', phonetic: 'ˈɪntɪɡreɪt', meaning: 'v. 整合，融合；使一体化', level: '中频', example: { en: 'We need to integrate theory with practice.', cn: '我们需要将理论与实践相结合。' } },
  { word: 'integrity', phonetic: 'ɪnˈteɡrəti', meaning: 'n. 正直，诚信；完整性', level: '中频', example: { en: 'He is a man of great integrity.', cn: '他是一个正直的人。' } },
  { word: 'intellectual', phonetic: 'ˌɪntəˈlektʃuəl', meaning: 'adj. 智力的，学术的 n. 知识分子', level: '中频', example: { en: 'Intellectual property rights must be protected.', cn: '知识产权必须受到保护。' } },
  { word: 'intense', phonetic: 'ɪnˈtens', meaning: 'adj. 强烈的，激烈的；紧张的', level: '中频', example: { en: 'The competition was intense.', cn: '竞争非常激烈。' } },
  { word: 'interact', phonetic: 'ˌɪntərˈækt', meaning: 'v. 互动，相互作用', level: '中频', example: { en: 'Students interact with each other in class.', cn: '学生们在课堂上互相交流。' } },
  { word: 'interpret', phonetic: 'ɪnˈtɜːrprɪt', meaning: 'v. 解释，理解；口译', level: '中频', example: { en: 'How do you interpret this data?', cn: '你如何解读这些数据？' } },
  { word: 'interval', phonetic: 'ˈɪntərvl', meaning: 'n. 间隔，间距；间歇', level: '中频', example: { en: 'There was a long interval between meetings.', cn: '会议之间有很长的间隔。' } },
  { word: 'intimate', phonetic: 'ˈɪntɪmət', meaning: 'adj. 亲密的，私密的 n. 密友', level: '中频', example: { en: 'They have an intimate friendship.', cn: '他们有亲密的友谊。' } },
  { word: 'investigate', phonetic: 'ɪnˈvestɪɡeɪt', meaning: 'v. 调查，研究', level: '中频', example: { en: 'The police are investigating the crime.', cn: '警方正在调查这起犯罪。' } },
  { word: 'involve', phonetic: 'ɪnˈvɑːlv', meaning: 'v. 涉及，包含；使参与', level: '中频', example: { en: 'The project involves many people.', cn: '这个项目涉及很多人。' } },
  { word: 'isolate', phonetic: 'ˈaɪsəleɪt', meaning: 'v. 隔离，孤立；分离', level: '中频', example: { en: 'The patient was isolated to prevent infection.', cn: '病人被隔离以防止感染。' } },
  { word: 'justify', phonetic: 'ˈdʒʌstɪfaɪ', meaning: 'v. 证明…正当；为…辩护', level: '中频', example: { en: 'How can you justify your decision?', cn: '你怎么证明你的决定是正当的？' } },
  { word: 'label', phonetic: 'ˈleɪbl', meaning: 'n. 标签，标记 v. 贴标签', level: '中频', example: { en: 'Read the label before taking the medicine.', cn: '吃药前先看标签。' } },
  { word: 'launch', phonetic: 'lɔːntʃ', meaning: 'v. 发射，发起；推出 n. 发射', level: '中频', example: { en: 'The company launched a new product.', cn: '公司推出了一款新产品。' } },
  { word: 'legislation', phonetic: 'ˌledʒɪsˈleɪʃn', meaning: 'n. 立法，法律', level: '中频', example: { en: 'New legislation was introduced.', cn: '引入了新的立法。' } },
  { word: 'legitimate', phonetic: 'lɪˈdʒɪtɪmət', meaning: 'adj. 合法的，正当的', level: '中频', example: { en: 'He has a legitimate reason for being late.', cn: '他迟到有正当的理由。' } },
  { word: 'likewise', phonetic: 'ˈlaɪkwaɪz', meaning: 'adv. 同样地；也', level: '中频', example: { en: 'She felt the same way, and I likewise.', cn: '她有同样的感觉，我也一样。' } },
  { word: 'maintain', phonetic: 'meɪnˈteɪn', meaning: 'v. 维持，保持；维修；主张', level: '中频', example: { en: 'It\'s important to maintain good health.', cn: '保持健康很重要。' } },
  { word: 'mechanism', phonetic: 'ˈmekənɪzəm', meaning: 'n. 机制，机理；机械装置', level: '中频', example: { en: 'We need to understand the mechanism behind this.', cn: '我们需要了解这背后的机制。' } },
  { word: 'military', phonetic: 'ˈmɪləteri', meaning: 'adj. 军事的 n. 军队', level: '中频', example: { en: 'The military budget has increased.', cn: '军事预算增加了。' } },
  { word: 'minimize', phonetic: 'ˈmɪnɪmaɪz', meaning: 'v. 最小化，减少；轻视', level: '中频', example: { en: 'We should minimize waste.', cn: '我们应该尽量减少浪费。' } },
  { word: 'modify', phonetic: 'ˈmɑːdɪfaɪ', meaning: 'v. 修改，改进；修饰', level: '中频', example: { en: 'We need to modify the design.', cn: '我们需要修改设计。' } },
  { word: 'monitor', phonetic: 'ˈmɑːnɪtər', meaning: 'v. 监控，监测 n. 监视器', level: '中频', example: { en: 'Doctors monitor the patient\'s condition.', cn: '医生监控病人的状况。' } },
  { word: 'negotiate', phonetic: 'nɪˈɡoʊʃieɪt', meaning: 'v. 谈判，协商', level: '中频', example: { en: 'They negotiated a new contract.', cn: '他们协商了一份新合同。' } },
  { word: 'notion', phonetic: 'ˈnoʊʃn', meaning: 'n. 概念，想法；意图', level: '中频', example: { en: 'I have no notion of what you mean.', cn: '我不知道你是什么意思。' } },
  { word: 'obtain', phonetic: 'əbˈteɪn', meaning: 'v. 获得，得到', level: '中频', example: { en: 'She obtained her degree last year.', cn: '她去年获得了学位。' } },
  { word: 'obvious', phonetic: 'ˈɑːbviəs', meaning: 'adj. 明显的，显而易见的', level: '中频', example: { en: 'The answer is obvious.', cn: '答案是显而易见的。' } },
  { word: 'occupy', phonetic: 'ˈɑːkjupaɪ', meaning: 'v. 占据，占领；使忙碌', level: '中频', example: { en: 'The army occupied the city.', cn: '军队占领了这座城市。' } },
  { word: 'option', phonetic: 'ˈɑːpʃn', meaning: 'n. 选择，选项；选择权', level: '中频', example: { en: 'You have several options to choose from.', cn: '你有几个选项可以选择。' } },
  { word: 'orient', phonetic: 'ˈɔːrient', meaning: 'v. 使适应，确定方向 n. 东方', level: '中频', example: { en: 'The course is oriented toward beginners.', cn: '这门课程面向初学者。' } },
  { word: 'outcome', phonetic: 'ˈaʊtkʌm', meaning: 'n. 结果，成果', level: '中频', example: { en: 'The outcome of the election was surprising.', cn: '选举结果令人惊讶。' } },
  { word: 'overcome', phonetic: 'ˌoʊvərˈkʌm', meaning: 'v. 克服，战胜', level: '中频', example: { en: 'She overcame many obstacles.', cn: '她克服了许多障碍。' } },
  { word: 'overlook', phonetic: 'ˌoʊvərˈlʊk', meaning: 'v. 忽视，忽略；俯瞰', level: '中频', example: { en: 'Don\'t overlook any details.', cn: '不要忽视任何细节。' } },

  // 低频词汇
  { word: 'ambiguous', phonetic: 'æmˈbɪɡjuəs', meaning: 'adj. 模糊的，模棱两可的', level: '低频', example: { en: 'His answer was ambiguous.', cn: '他的回答模棱两可。' } },
  { word: 'benevolent', phonetic: 'bəˈnevələnt', meaning: 'adj. 仁慈的，慈善的', level: '低频' },
  { word: 'bureaucracy', phonetic: 'bjʊˈrɑːkrəsi', meaning: 'n. 官僚主义，官僚机构', level: '低频' },
  { word: 'candid', phonetic: 'ˈkændɪd', meaning: 'adj. 坦率的，直言的', level: '低频', example: { en: 'She gave a candid interview.', cn: '她接受了一次坦率的采访。' } },
  { word: 'chronic', phonetic: 'ˈkrɑːnɪk', meaning: 'adj. 慢性的，长期的', level: '低频', example: { en: 'He suffers from chronic back pain.', cn: '他患有慢性背痛。' } },
  { word: 'conscientious', phonetic: 'ˌkɑːnʃiˈenʃəs', meaning: 'adj. 认真的，尽责的', level: '低频' },
  { word: 'contemplate', phonetic: 'ˈkɑːntəmpleɪt', meaning: 'v. 沉思，深思；打算', level: '低频', example: { en: 'She contemplated her future.', cn: '她沉思着自己的未来。' } },
  { word: 'deteriorate', phonetic: 'dɪˈtɪriəreɪt', meaning: 'v. 恶化，变坏；退化', level: '低频' },
  { word: 'dilemma', phonetic: 'dɪˈlemə', meaning: 'n. 困境，进退两难', level: '低频', example: { en: 'She faced a moral dilemma.', cn: '她面临道德困境。' } },
  { word: 'elaborate', phonetic: 'ɪˈlæbərət', meaning: 'adj. 精心制作的 v. 详细阐述', level: '低频', example: { en: 'Could you elaborate on your plan?', cn: '你能详细阐述一下你的计划吗？' } },
  { word: 'eloquent', phonetic: 'ˈeləkwənt', meaning: 'adj. 雄辩的，有口才的', level: '低频', example: { en: 'She gave an eloquent speech.', cn: '她发表了一场雄辩的演讲。' } },
  { word: 'empirical', phonetic: 'ɪmˈpɪrɪkl', meaning: 'adj. 经验的，实证的', level: '低频', example: { en: 'The theory lacks empirical evidence.', cn: '这个理论缺乏实证证据。' } },
  { word: 'endeavor', phonetic: 'ɪnˈdevər', meaning: 'n. 努力，尝试 v. 努力', level: '低频', example: { en: 'We should endeavor to improve.', cn: '我们应该努力改进。' } },
  { word: 'exacerbate', phonetic: 'ɪɡˈzæsərbeɪt', meaning: 'v. 使恶化，加剧', level: '低频' },
  { word: 'fluctuate', phonetic: 'ˈflʌktʃueɪt', meaning: 'v. 波动，起伏不定', level: '低频' },
  { word: 'gregarious', phonetic: 'ɡrɪˈɡeriəs', meaning: 'adj. 爱交际的，群居的', level: '低频' },
  { word: 'hierarchy', phonetic: 'ˈhaɪərɑːrki', meaning: 'n. 等级制度，层次结构', level: '低频', example: { en: 'The company has a strict hierarchy.', cn: '公司有严格的等级制度。' } },
  { word: 'hypocrisy', phonetic: 'hɪˈpɑːkrəsi', meaning: 'n. 虚伪，伪善', level: '低频' },
  { word: 'indigenous', phonetic: 'ɪnˈdɪdʒənəs', meaning: 'adj. 本土的，土著的', level: '低频', example: { en: 'Indigenous cultures should be preserved.', cn: '本土文化应该得到保护。' } },
  { word: 'juxtapose', phonetic: 'ˈdʒʌkstəpoʊz', meaning: 'v. 并列，并置', level: '低频' },
  { word: 'meticulous', phonetic: 'məˈtɪkjələs', meaning: 'adj. 一丝不苟的，非常仔细的', level: '低频', example: { en: 'She is meticulous in her work.', cn: '她工作一丝不苟。' } },
  { word: 'paradigm', phonetic: 'ˈpærədaɪm', meaning: 'n. 范式，典范；模式', level: '低频', example: { en: 'A new paradigm has emerged in education.', cn: '教育中出现了新的范式。' } },
  { word: 'persevere', phonetic: 'ˌpɜːrsəˈvɪr', meaning: 'v. 坚持不懈，锲而不舍', level: '低频', example: { en: 'You must persevere to succeed.', cn: '你必须坚持不懈才能成功。' } },
  { word: 'plausible', phonetic: 'ˈplɔːzəbl', meaning: 'adj. 貌似合理的，可信的', level: '低频', example: { en: 'His explanation seems plausible.', cn: '他的解释看似合理。' } },
  { word: 'pragmatic', phonetic: 'præɡˈmætɪk', meaning: 'adj. 务实的，实用主义的', level: '低频', example: { en: 'We need a pragmatic approach.', cn: '我们需要一种务实的方法。' } },
  { word: 'prevalent', phonetic: 'ˈprevələnt', meaning: 'adj. 流行的，普遍的', level: '低频', example: { en: 'This disease is prevalent in tropical areas.', cn: '这种疾病在热带地区很普遍。' } },
  { word: 'reconcile', phonetic: 'ˈrɑːnkəsaɪl', meaning: 'v. 调和，和解；使一致', level: '低频', example: { en: 'They finally reconciled after years of conflict.', cn: '经过多年冲突，他们终于和解了。' } },
  { word: 'scrutiny', phonetic: 'ˈskruːtəni', meaning: 'n. 仔细审查，细察', level: '低频', example: { en: 'The plan came under close scrutiny.', cn: '该计划受到了仔细审查。' } },
  { word: 'subordinate', phonetic: 'səˈbɔːrdɪnət', meaning: 'adj. 下级的，次要的 n. 下属', level: '低频', example: { en: 'He treats his subordinates with respect.', cn: '他尊重下属。' } },
  { word: 'supplement', phonetic: 'ˈsʌplɪmənt', meaning: 'n. 补充，增补 v. 补充', level: '低频', example: { en: 'Take vitamin supplements to stay healthy.', cn: '服用维生素补充剂保持健康。' } },
  { word: 'tangible', phonetic: 'ˈtændʒəbl', meaning: 'adj. 有形的，可触摸的；切实的', level: '低频', example: { en: 'We need tangible results.', cn: '我们需要切实的成果。' } },
  { word: 'undermine', phonetic: 'ˌʌndərˈmaɪn', meaning: 'v. 破坏，削弱；暗中损害', level: '低频', example: { en: 'This could undermine public trust.', cn: '这可能会削弱公众信任。' } },
  { word: 'unprecedented', phonetic: 'ʌnˈpresɪdentɪd', meaning: 'adj. 史无前例的，空前的', level: '低频', example: { en: 'The crisis was unprecedented.', cn: '这场危机是史无前例的。' } },
  { word: 'versatile', phonetic: 'ˈvɜːrsətl', meaning: 'adj. 多才多艺的；通用的', level: '低频', example: { en: 'She is a versatile musician.', cn: '她是一位多才多艺的音乐家。' } },
  { word: 'vulnerable', phonetic: 'ˈvʌlnərəbl', meaning: 'adj. 脆弱的，易受攻击的', level: '低频', example: { en: 'Children are vulnerable to infections.', cn: '儿童容易受到感染。' } },
]

const categories = [
  { key: 'high', name: '高频词', count: wordDatabase.filter(w => w.level === '高频').length },
  { key: 'mid', name: '中频词', count: wordDatabase.filter(w => w.level === '中频').length },
  { key: 'low', name: '低频词', count: wordDatabase.filter(w => w.level === '低频').length },
  { key: 'all', name: '全部', count: wordDatabase.length }
]

// 在线查询结果（本地词库之外的补充结果）
const onlineResults = ref<WordItem[]>([])

const filteredByCategory = computed(() => {
  if (currentCategory.value === 'all') return wordDatabase
  const levelMap: Record<string, string> = {
    high: '高频',
    mid: '中频',
    low: '低频'
  }
  return wordDatabase.filter(w => w.level === levelMap[currentCategory.value])
})

const displayWords = computed(() => {
  if (!searchWord.value.trim()) {
    return filteredByCategory.value.slice(0, 50)
  }
  const keyword = searchWord.value.trim().toLowerCase()
  const localMatches = wordDatabase.filter(w =>
    w.word.toLowerCase().includes(keyword) ||
    w.meaning.includes(keyword)
  )
  // 本地匹配结果 + 在线查询结果（去重）
  const merged = [...localMatches]
  onlineResults.value.forEach(w => {
    if (!merged.some(m => m.word.toLowerCase() === w.word.toLowerCase())) {
      merged.push(w)
    }
  })
  return merged
})

// 判断是否为纯英文单词（可在线查询）
function isEnglishWord(text: string): boolean {
  return /^[a-zA-Z][a-zA-Z\-']*$/.test(text.trim())
}

// 本地词库匹配数量（用于空状态引导提示）
const localMatchCount = computed(() => {
  const keyword = searchWord.value.trim().toLowerCase()
  if (!keyword) return 0
  return wordDatabase.filter(w =>
    w.word.toLowerCase().includes(keyword) || w.meaning.includes(keyword)
  ).length
})

/**
 * 在线查询单词：
 * 1. dictionaryapi.dev 获取音标与英文释义
 * 2. MyMemory 翻译接口获取中文释义（免费无需 key）
 */
async function searchOnline(word: string): Promise<WordItem | null> {
  const lower = word.trim().toLowerCase()

  // 第一步：获取音标与英文释义
  let phonetic = ''
  let enDefinitions: { partOfSpeech: string; definition: string; example?: string }[] = []
  try {
    const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lower)}`)
    if (resp.ok) {
      const data = await resp.json()
      if (Array.isArray(data) && data.length > 0) {
        const entry = data[0]
        if (entry.phonetic) {
          phonetic = entry.phonetic.replace(/^\//, '').replace(/\/$/, '')
        } else if (entry.phonetics && entry.phonetics.length > 0) {
          const p = entry.phonetics.find((ph: any) => ph.text)
          if (p && p.text) phonetic = p.text.replace(/^\//, '').replace(/\/$/, '')
        }
        if (entry.meanings && entry.meanings.length > 0) {
          for (const meaning of entry.meanings) {
            const defs = (meaning.definitions || []).slice(0, 2)
            for (const d of defs) {
              enDefinitions.push({
                partOfSpeech: meaning.partOfSpeech || '',
                definition: d.definition || '',
                example: d.example
              })
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('在线词典查询失败:', e)
  }

  // 第二步：获取中文释义
  let cnMeaning = ''
  try {
    const resp = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(lower)}&langpair=en|zh-CN`)
    if (resp.ok) {
      const data = await resp.json()
      if (data.responseStatus === 200 && data.responseData && data.responseData.translatedText) {
        cnMeaning = data.responseData.translatedText
        // 过滤无效翻译（翻译接口对单词有时会返回整句）
        if (cnMeaning.toLowerCase() === lower || cnMeaning.length > 60) {
          cnMeaning = ''
        }
      }
    }
  } catch (e) {
    console.error('中文释义查询失败:', e)
  }

  // 两个来源都失败则返回 null
  if (!phonetic && enDefinitions.length === 0 && !cnMeaning) {
    return null
  }

  // 组装结果
  const parts: string[] = []
  enDefinitions.slice(0, 3).forEach(d => {
    parts.push(`${d.partOfSpeech ? d.partOfSpeech + '. ' : ''}${d.definition}`)
  })

  const meaning = [
    cnMeaning ? `中文：${cnMeaning}` : '',
    parts.length > 0 ? `英文：${parts.join('；')}` : ''
  ].filter(Boolean).join('\n')

  const example = enDefinitions.find(d => d.example)

  return {
    word: lower,
    phonetic,
    meaning,
    level: '在线查询',
    example: example ? { en: example.example ?? '', cn: cnMeaning } : undefined
  }
}

async function search() {
  const keyword = searchWord.value.trim()
  if (!keyword) {
    ElMessage.info('请输入搜索关键词')
    return
  }
  // 本地已有匹配，无需在线查询
  const kw = keyword.toLowerCase()
  const localMatches = wordDatabase.filter(w =>
    w.word.toLowerCase().includes(kw) || w.meaning.includes(kw)
  )
  onlineResults.value = []
  onlineSearchFailed.value = false
  if (localMatches.length > 0) return

  // 本地无匹配且是英文单词 → 在线查询
  if (!isEnglishWord(keyword)) {
    onlineSearchFailed.value = true
    return
  }

  isSearchingOnline.value = true
  try {
    const result = await searchOnline(keyword)
    if (result) {
      onlineResults.value = [result]
    } else {
      onlineSearchFailed.value = true
    }
  } catch (e) {
    console.error('在线查询失败:', e)
    onlineSearchFailed.value = true
  } finally {
    isSearchingOnline.value = false
  }
}

function getLevelTagType(level: string) {
  const map: Record<string, string> = {
    '高频': 'danger',
    '中频': 'warning',
    '低频': 'info',
    '在线查询': 'success'
  }
  return map[level] as any || 'info'
}

function showWordDetail(word: WordItem) {
  currentWord.value = word
  showDetail.value = true
}

function addToFlashcards(word: WordItem) {
  store.addFlashcard({
    front: word.word,
    back: `${word.phonetic ? '/' + word.phonetic + '/\n' : ''}${word.meaning}${word.example ? '\n\n例句：' + word.example.en + '\n' + word.example.cn : ''}`,
    category: '英语单词'
  })
  ElMessage.success('已加入背诵卡片')
}
</script>

<style scoped>
.dictionary-page {
  max-width: 900px;
  margin: 0 auto;
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
  margin-bottom: 24px;
}

/* 搜索区域 */
.search-section {
  margin-bottom: 20px;
}

/* 分类标签 */
.category-section {
  margin-bottom: 20px;
  padding: 16px 20px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  box-shadow: var(--glass-shadow);
}

.category-tabs {
  display: flex;
  gap: 10px;
}

.cat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 10px;
  font-size: 14px;
  color: var(--mo-text-2);
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
  background: var(--mo-surface);
}

.cat-item:hover {
  background: var(--mo-surface-hover);
}

.cat-item.active {
  background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
  color: #fff;
}

.cat-count {
  font-size: 12px;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  font-family: 'DIN Alternate', sans-serif;
}

.cat-item:not(.active) .cat-count {
  background: rgba(59, 130, 246, 0.08);
  color: var(--mo-text-3);
}

/* 单词列表 */
.word-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.word-card {
  background: var(--glass-lite-bg);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 18px 20px;
  box-shadow: var(--glass-shadow);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.word-card:hover {
  box-shadow: var(--glass-shadow-hover);
  transform: translateY(-2px);
}

.word-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.word-text {
  font-size: 20px;
  font-weight: 600;
  color: var(--mo-text-1);
}

.word-phonetic {
  font-size: 13px;
  color: var(--mo-text-3);
  font-style: italic;
}

.word-meaning {
  font-size: 14px;
  color: var(--mo-text-2);
  line-height: 1.6;
  margin-bottom: 12px;
  white-space: pre-line;
}

.word-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 10px;
  border-top: 1px solid var(--mo-border);
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

.empty-hint {
  color: var(--mo-text-disabled);
  font-size: 12px;
  margin: 0;
  max-width: 420px;
  text-align: center;
  line-height: 1.6;
}

/* 在线查询中 */
.online-searching {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  background: rgba(59, 130, 246, 0.10);
  border: 1px solid rgba(59, 130, 246, 0.25);
  border-radius: 12px;
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--mo-primary);
}

/* 单词详情 */
.word-detail {
  padding: 10px 0;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.6);
}

.detail-phonetic {
  font-size: 16px;
  color: var(--mo-text-3);
  font-style: italic;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section h4 {
  font-size: 14px;
  color: #3b82f6;
  margin-bottom: 10px;
}

.detail-section p {
  font-size: 15px;
  color: var(--mo-text-1);
  line-height: 1.7;
  margin: 0;
}

.example-en {
  font-style: italic;
  color: var(--mo-text-2) !important;
  margin-bottom: 6px !important;
}

.example-cn {
  color: var(--mo-text-3) !important;
}
</style>
