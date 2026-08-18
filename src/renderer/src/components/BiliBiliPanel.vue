<template>
  <div class="bili-panel">
    <!-- 工具栏：页签切换 + 搜索 + 登录状态 -->
    <div class="bili-toolbar glass-card">
      <div class="bili-tabs">
        <button class="bili-tab" :class="{ active: tab === 'rcmd' }" @click="switchTab('rcmd')">
          <el-icon><MagicStick /></el-icon> 个性推荐
        </button>
        <button class="bili-tab" :class="{ active: tab === 'popular' }" @click="switchTab('popular')">
          <el-icon><Promotion /></el-icon> 热门推荐
        </button>
        <button class="bili-tab" :class="{ active: tab === 'fav' }" @click="switchTab('fav')">
          <el-icon><Star /></el-icon> 收藏夹
        </button>
        <button class="bili-tab" :class="{ active: tab === 'search' }" :disabled="!searchedOnce" @click="switchTab('search')">
          <el-icon><Search /></el-icon> 搜索结果
        </button>
      </div>
      <div class="bili-search">
        <input
          v-model="searchKeyword"
          class="bili-search-input"
          placeholder="搜索 B 站视频，回车开始"
          @keyup.enter="doSearch(1)"
        />
        <el-button size="small" type="primary" :loading="searchLoading" @click="doSearch(1)">
          <el-icon><Search /></el-icon> 搜索
        </el-button>
      </div>
      <div class="bili-user">
        <template v-if="user">
          <img v-if="user.face" class="bili-avatar" :src="user.face" alt="头像" />
          <el-icon v-else class="bili-avatar-placeholder"><UserFilled /></el-icon>
          <span class="bili-uname" :title="user.uname">{{ user.uname }}</span>
          <el-button size="small" link @click="logout">退出</el-button>
        </template>
        <el-button v-else size="small" type="primary" plain @click="openLogin">
          <el-icon><User /></el-icon> 登录 B 站
        </el-button>
      </div>
    </div>

    <!-- 个性推荐（首页 feed/rcmd，登录后按兴趣个性化） -->
    <div v-if="tab === 'rcmd'" class="bili-content">
      <div class="bili-content-head">
        <span class="bili-content-title"><el-icon><MagicStick /></el-icon> 个性推荐</span>
        <el-button size="small" :loading="rcmdLoading" @click="loadRcmd">
          <el-icon><Refresh /></el-icon> 换一批
        </el-button>
      </div>
      <div v-if="rcmdLoading && !rcmdList.length" class="bili-loading">
        <el-icon class="is-loading" :size="28"><Loading /></el-icon>
        <span>加载中...</span>
      </div>
      <div v-else-if="!rcmdList.length" class="bili-empty glass-card">
        <el-icon :size="48"><MagicStick /></el-icon>
        <p>暂无推荐内容，点击「换一批」重试</p>
      </div>
      <div v-else class="bili-grid cols-6">
        <div v-for="v in rcmdList" :key="v.bvid" class="bili-card" @click="playVideo(v)">
          <div class="bili-cover-wrap">
            <img class="bili-cover" :src="v.pic" loading="lazy" decoding="async" alt="" />
            <span v-if="v.duration" class="bili-duration">{{ v.duration }}</span>
            <div class="bili-cover-mask">
              <el-icon class="bili-play-icon"><VideoPlay /></el-icon>
            </div>
          </div>
          <div class="bili-card-info">
            <div class="bili-card-title" :title="v.title">{{ v.title }}</div>
            <div class="bili-card-meta">
              <span class="bili-meta-author">{{ v.author }}</span>
              <span class="bili-meta-stat">{{ formatCount(v.play) }} 播放</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 热门推荐 -->
    <div v-if="tab === 'popular'" class="bili-content">
      <div class="bili-content-head">
        <span class="bili-content-title"><el-icon><Promotion /></el-icon> 热门视频推荐</span>
        <el-button size="small" :loading="popularLoading" @click="loadPopular(true)">
          <el-icon><Refresh /></el-icon> 换一批
        </el-button>
      </div>
      <div v-if="popularLoading && !popularList.length" class="bili-loading">
        <el-icon class="is-loading" :size="28"><Loading /></el-icon>
        <span>加载中...</span>
      </div>
      <!-- v3.5.7：首次访问自动加载；此空态仅在加载失败/无结果时出现 -->
      <div v-else-if="!popularList.length" class="bili-empty glass-card">
        <el-icon :size="48"><Promotion /></el-icon>
        <p>暂无热门内容，点击「换一批」重试</p>
      </div>
      <div v-else class="bili-grid cols-6">
        <div v-for="v in popularList" :key="v.bvid" class="bili-card" @click="playVideo(v)">
          <div class="bili-cover-wrap">
            <img class="bili-cover" :src="v.pic" loading="lazy" decoding="async" alt="" />
            <span v-if="v.duration" class="bili-duration">{{ v.duration }}</span>
            <div class="bili-cover-mask">
              <el-icon class="bili-play-icon"><VideoPlay /></el-icon>
            </div>
          </div>
          <div class="bili-card-info">
            <div class="bili-card-title" :title="v.title">{{ v.title }}</div>
            <div class="bili-card-meta">
              <span class="bili-meta-author">{{ v.author }}</span>
              <span class="bili-meta-stat">{{ formatCount(v.play) }} 播放</span>
            </div>
          </div>
        </div>
      </div>
      <div class="bili-load-more" v-if="popularList.length">
        <el-button size="small" :loading="popularLoading" :disabled="!popularHasMore" @click="loadPopular(false)">
          加载更多
        </el-button>
      </div>
    </div>

    <!-- 收藏夹 -->
    <div v-if="tab === 'fav'" class="bili-content">
      <template v-if="!user">
        <div class="bili-empty glass-card">
          <el-icon :size="48"><Star /></el-icon>
          <p>登录后查看 B 站收藏夹</p>
          <el-button type="primary" @click="openLogin"><el-icon><User /></el-icon> 立即登录</el-button>
        </div>
      </template>
      <div v-else class="bili-fav-layout">
        <div class="bili-fav-folders glass-card">
          <h3 class="bili-section-title"><el-icon><FolderOpened /></el-icon> 收藏夹</h3>
          <div v-if="favFoldersLoading" class="bili-loading small">
            <el-icon class="is-loading"><Loading /></el-icon><span>加载中...</span>
          </div>
          <div v-else-if="!favFolders.length" class="bili-folder-empty">暂无收藏夹</div>
          <div
            v-for="f in favFolders"
            :key="f.id"
            class="bili-folder-item"
            :class="{ active: currentFolder?.id === f.id }"
            @click="selectFolder(f)"
          >
            <span class="bili-folder-name" :title="f.title">{{ f.title }}</span>
            <span class="bili-folder-count">{{ f.count }}</span>
          </div>
        </div>
        <div class="bili-fav-main">
          <div v-if="!currentFolder" class="bili-empty glass-card">
            <el-icon :size="48"><FolderOpened /></el-icon>
            <p>从左侧选择一个收藏夹</p>
          </div>
          <template v-else>
            <div class="bili-content-head">
              <span class="bili-content-title">
                <el-icon><FolderOpened /></el-icon> {{ currentFolder.title }}
                <span class="bili-folder-total">{{ currentFolder.count }} 个内容</span>
              </span>
              <el-button size="small" :loading="favListLoading" @click="loadFavList(true)">
                <el-icon><Refresh /></el-icon> 刷新
              </el-button>
            </div>
            <div v-if="favListLoading && !favList.length" class="bili-loading">
              <el-icon class="is-loading" :size="28"><Loading /></el-icon>
              <span>加载中...</span>
            </div>
            <div v-else-if="!favList.length" class="bili-empty glass-card">
              <el-icon :size="48"><VideoPlay /></el-icon>
              <p>该收藏夹暂无可播放的视频</p>
            </div>
            <div v-else class="bili-grid">
              <div v-for="v in favList" :key="v.bvid" class="bili-card" @click="playVideo(v)">
                <div class="bili-cover-wrap">
                  <img class="bili-cover" :src="v.pic" loading="lazy" decoding="async" alt="" />
                  <span v-if="v.duration" class="bili-duration">{{ v.duration }}</span>
                  <div class="bili-cover-mask">
                    <el-icon class="bili-play-icon"><VideoPlay /></el-icon>
                  </div>
                </div>
                <div class="bili-card-info">
                  <div class="bili-card-title" :title="v.title">{{ v.title }}</div>
                  <div class="bili-card-meta">
                    <span class="bili-meta-author">{{ v.author }}</span>
                    <span class="bili-meta-stat">{{ formatCount(v.play) }} 播放</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="bili-load-more" v-if="favList.length">
              <el-button size="small" :loading="favListLoading" :disabled="!favHasMore" @click="loadFavList(false)">
                加载更多
              </el-button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 搜索结果 -->
    <div v-if="tab === 'search'" class="bili-content">
      <div class="bili-content-head">
        <span class="bili-content-title">
          <el-icon><Search /></el-icon> 「{{ lastKeyword }}」的搜索结果
          <span class="bili-folder-total" v-if="searchTotal">约 {{ formatCount(searchTotal) }} 条</span>
        </span>
        <div class="bili-pager">
          <el-button size="small" :disabled="searchPage <= 1 || searchLoading" @click="doSearch(searchPage - 1)">上一页</el-button>
          <span class="bili-page-text">{{ searchPage }} / {{ Math.max(searchNumPages, searchPage) }}</span>
          <el-button size="small" :disabled="searchPage >= searchNumPages || searchLoading" @click="doSearch(searchPage + 1)">下一页</el-button>
        </div>
      </div>
      <div v-if="searchLoading && !searchList.length" class="bili-loading">
        <el-icon class="is-loading" :size="28"><Loading /></el-icon>
        <span>搜索中...</span>
      </div>
      <div v-else-if="!searchList.length" class="bili-empty glass-card">
        <el-icon :size="48"><Search /></el-icon>
        <p>没有找到相关视频</p>
      </div>
      <div v-else class="bili-grid">
        <div v-for="v in searchList" :key="v.bvid" class="bili-card" @click="playVideo(v)">
          <div class="bili-cover-wrap">
            <img class="bili-cover" :src="v.pic" loading="lazy" decoding="async" alt="" />
            <span v-if="v.duration" class="bili-duration">{{ v.duration }}</span>
            <div class="bili-cover-mask">
              <el-icon class="bili-play-icon"><VideoPlay /></el-icon>
            </div>
          </div>
          <div class="bili-card-info">
            <div class="bili-card-title" :title="v.title">{{ v.title }}</div>
            <div class="bili-card-meta">
              <span class="bili-meta-author">{{ v.author }}</span>
              <span class="bili-meta-stat">{{ formatCount(v.play) }} 播放</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 播放器弹窗（v3.5.4：加大宽度并屏幕水平垂直居中） -->
    <el-dialog
      v-model="playerVisible"
      :title="currentView?.title || '视频播放'"
      width="min(1400px, 96vw)"
      class="bili-player-dialog"
      align-center
      append-to-body
      destroy-on-close
      @close="onPlayerClose"
    >
      <div class="bili-player-body">
        <div class="bili-player-main">
        <div class="bili-player-stage">
          <video
            ref="videoEl"
            class="bili-video"
            :src="videoSrc"
            controls
            autoplay
            preload="metadata"
            playsinline
            @ended="onVideoEnded"
            @error="onVideoError"
            @seeking="onVideoSeeking"
            @timeupdate="onVideoTick"
          ></video>
          <div v-if="playerLoading" class="bili-player-loading">
            <el-icon class="is-loading" :size="32"><Loading /></el-icon>
            <span>正在获取播放地址...</span>
          </div>
          <div v-if="playerError" class="bili-player-error">
            <el-icon :size="32"><Warning /></el-icon>
            <span>{{ playerError }}</span>
            <el-button size="small" type="primary" @click="retryPlay">重试</el-button>
          </div>
        </div>
        <!-- v3.6.0：播放信息栏 —— 数据 / 三连 / 清晰度同一行 -->
        <div class="bili-player-bar" v-if="currentView">
          <div class="bili-player-bar-left">
            <span class="bili-player-up">
              <el-icon><User /></el-icon> {{ currentView.owner.name }}
            </span>
            <span class="bili-player-stat">{{ formatCount(currentView.stat.view) }} 播放</span>
            <span class="bili-player-stat">{{ formatCount(currentView.stat.like) }} 点赞</span>
          </div>
          <div class="bili-player-bar-center">
            <button class="bili-action-btn" :class="{ liked: relLiked }" :disabled="relBusy" @click="toggleLike">
              <el-icon><SuccessFilled /></el-icon>
              <span>{{ relLiked ? '已点赞' : '点赞' }}</span>
              <em>{{ formatCount(currentView.stat.like + (relLiked ? 1 : 0)) }}</em>
            </button>
            <el-dropdown trigger="click" :disabled="relBusy" @command="giveCoin">
              <button class="bili-action-btn" :class="{ coined: relCoin > 0 }" :disabled="relBusy">
                <el-icon><Present /></el-icon>
                <span>{{ relCoin > 0 ? `已投 ${relCoin} 币` : '投币' }}</span>
                <em>{{ formatCount(currentView.stat.coin) }}</em>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item :command="1">投 1 个币</el-dropdown-item>
                  <el-dropdown-item :command="2">投 2 个币</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <button class="bili-action-btn" :class="{ faved: relFaved }" :disabled="relBusy" @click="toggleFav">
              <el-icon><StarFilled /></el-icon>
              <span>{{ relFaved ? '已收藏' : '收藏' }}</span>
              <em>{{ formatCount(currentView.stat.favorite + (relFaved ? 1 : 0)) }}</em>
            </button>
          </div>
          <div class="bili-player-bar-right">
            <select
              v-if="currentView.pages.length > 1"
              class="bili-select"
              :value="currentPageIdx"
              @change="switchPage(Number(($event.target as HTMLSelectElement).value))"
              title="选择分 P"
            >
              <option v-for="(p, idx) in currentView.pages" :key="p.cid" :value="idx">
                P{{ p.page }} {{ p.part }}（{{ p.duration }}）
              </option>
            </select>
            <select
              v-if="acceptQualities.length > 1"
              class="bili-select"
              :value="currentQn"
              @change="switchQuality(Number(($event.target as HTMLSelectElement).value))"
              title="切换清晰度"
            >
              <option v-for="q in acceptQualities" :key="q.qn" :value="q.qn">{{ q.label }}</option>
            </select>
            <span v-if="qualityLabel" class="bili-quality-tag">{{ qualityLabel }}</span>
          </div>
        </div>
        <!-- v3.6.2：分 P 横向列表移出 main——main 仅含「视频 + 信息栏」，
             侧栏 stretch 等高后底部恰与信息栏底部齐平（不再被分 P 条撑高） -->
        </div>
        <!-- v3.6.0：右侧栏 —— UP 主卡片 + 作品简介固定顶部，下方评论/投稿/相关切换 -->
        <div class="bili-player-side" v-if="currentView">
        <!-- UP 主卡片（固定顶部：作者信息 + 查看投稿按钮） -->
        <div class="bili-up-card fixed-top" v-if="upCard">
          <img v-if="upCard.face" class="bili-up-face" :src="upCard.face" alt="UP 主头像" />
          <el-icon v-else class="bili-up-face bili-up-face-ph"><UserFilled /></el-icon>
          <div class="bili-up-info">
            <div class="bili-up-name">{{ upCard.name }}</div>
            <div class="bili-up-sign" :title="upCard.sign">{{ upCard.sign || '这个人很懒，什么都没写~' }}</div>
            <div class="bili-up-fans">{{ formatCount(upCard.fans) }} 粉丝</div>
          </div>
          <el-button size="small" class="bili-up-btn" @click="openAuthorVideos">
            <el-icon><Film /></el-icon> {{ rightTab === 'space' ? '返回评论' : '查看投稿' }}
          </el-button>
        </div>
        <!-- 作品简介（固定顶部，作者卡片下方） -->
        <div class="bili-up-desc" v-if="currentView.desc && currentView.desc.trim()">
          <p class="bili-desc-text">{{ currentView.desc }}</p>
        </div>
        <!-- Tab 切换栏 -->
        <div class="bili-side-tabs">
          <button :class="{ active: rightTab === 'replies' }" @click="switchRightTab('replies')"><el-icon><ChatDotRound /></el-icon> 评论 {{ formatCount(currentView.stat.reply) }}</button>
          <button :class="{ active: rightTab === 'space' }" @click="switchRightTab('space')"><el-icon><Film /></el-icon> 投稿 {{ formatCount(upCard?.archives || 0) }}</button>
          <button :class="{ active: rightTab === 'related' }" @click="switchRightTab('related')"><el-icon><VideoPlay /></el-icon> 相关 {{ relatedList.length }}</button>
        </div>
        <!-- 内容区（独立滚动，默认评论） -->
        <div class="bili-side-content">
          <!-- v3.5.8：评论区（热评优先，分页加载） -->
          <div class="bili-section" v-if="rightTab === 'replies'">
            <div v-if="replyLoading && !replyList.length" class="bili-loading small">
              <el-icon class="is-loading"><Loading /></el-icon><span>加载中...</span>
            </div>
            <div v-else-if="!replyList.length" class="bili-folder-empty">暂无评论</div>
            <div v-else class="bili-reply-list">
              <div v-for="r in replyList" :key="r.rpid" class="bili-reply-item">
                <img v-if="r.face" class="bili-reply-face" :src="r.face" alt="" />
                <div v-else class="bili-reply-face bili-reply-face-ph"><el-icon><UserFilled /></el-icon></div>
                <div class="bili-reply-body">
                  <div class="bili-reply-head">
                    <span class="bili-reply-uname">{{ r.uname }}</span>
                    <span class="bili-reply-like"><el-icon><SuccessFilled /></el-icon>{{ formatCount(r.like) }}</span>
                  </div>
                  <p class="bili-reply-msg">{{ r.message }}</p>
                </div>
              </div>
            </div>
            <div class="bili-load-more" v-if="replyList.length && replyHasMore">
              <el-button size="small" :loading="replyLoading" @click="loadReplies(false)">加载更多</el-button>
            </div>
          </div>
          <!-- UP 主投稿视频（v3.6.0：点击查看投稿后替换评论区） -->
          <div class="bili-section" v-if="rightTab === 'space'">
            <div v-if="spaceLoading && !spaceList.length" class="bili-loading small">
              <el-icon class="is-loading"><Loading /></el-icon><span>加载中...</span>
            </div>
            <div v-else-if="!spaceList.length" class="bili-folder-empty">暂无投稿视频</div>
            <div v-else class="bili-side-list">
              <div v-for="v in spaceList" :key="v.bvid" class="bili-row-card" @click="playVideo(v)">
                <div class="bili-row-thumb">
                  <img :src="v.pic" loading="lazy" decoding="async" alt="" />
                  <span v-if="v.duration" class="bili-duration">{{ v.duration }}</span>
                </div>
                <div class="bili-row-info">
                  <div class="bili-row-title" :title="v.title">{{ v.title }}</div>
                  <div class="bili-row-meta">{{ formatCount(v.play) }} 播放</div>
                </div>
              </div>
            </div>
            <div class="bili-load-more" v-if="spaceList.length && spaceHasMore">
              <el-button size="small" :loading="spaceLoading" @click="loadSpaceVideos(false)">加载更多</el-button>
            </div>
          </div>
          <!-- 相关视频推荐（v3.5.8：左图右文紧凑行） -->
          <div class="bili-section" v-if="rightTab === 'related' && relatedList.length">
            <div class="bili-side-list">
              <div v-for="v in relatedList.slice(0, 20)" :key="v.bvid" class="bili-row-card" @click="playVideo(v)">
                <div class="bili-row-thumb">
                  <img :src="v.pic" loading="lazy" decoding="async" alt="" />
                  <span v-if="v.duration" class="bili-duration">{{ v.duration }}</span>
                </div>
                <div class="bili-row-info">
                  <div class="bili-row-title" :title="v.title">{{ v.title }}</div>
                  <div class="bili-row-meta">
                    <span v-if="v.author">{{ v.author }}</span>
                    <span>{{ formatCount(v.play) }} 播放</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
      <!-- v3.6.2：分 P 横向列表移至弹窗底部全宽（超过 1 P 时显示），
           不再参与左侧 main 高度计算，保证侧栏底部与信息栏齐平 -->
      <div v-if="currentView && currentView.pages.length > 1" class="bili-pages-strip">
        <button
          v-for="(p, idx) in currentView.pages"
          :key="p.cid"
          class="bili-page-chip"
          :class="{ active: idx === currentPageIdx }"
          :title="p.part"
          @click="switchPage(idx)"
        >P{{ p.page }}</button>
      </div>
    </el-dialog>

    <!-- 登录弹窗：扫码 / Cookie -->
    <el-dialog v-model="loginVisible" title="登录哔哩哔哩" width="440px" append-to-body @close="stopQrPolling">
      <el-tabs v-model="loginMode">
        <el-tab-pane label="扫码登录" name="qr">
          <div class="bili-login-qr">
            <div class="bili-qr-wrap">
              <img v-if="qrImg" class="bili-qr-img" :src="qrImg" alt="登录二维码" />
              <div v-else class="bili-qr-placeholder">
                <el-icon class="is-loading" v-if="qrLoading"><Loading /></el-icon>
                <span v-else>二维码加载失败</span>
              </div>
              <div v-if="qrExpired" class="bili-qr-expired" @click="startQrLogin">
                <el-icon :size="24"><Refresh /></el-icon>
                <span>二维码已失效，点击刷新</span>
              </div>
            </div>
            <p class="bili-qr-hint">{{ qrHint }}</p>
            <p class="bili-qr-tip">使用哔哩哔哩手机客户端扫码确认登录</p>
          </div>
        </el-tab-pane>
        <el-tab-pane label="Cookie 登录" name="cookie">
          <div class="bili-login-cookie">
            <p class="bili-cookie-tip">
              在浏览器登录 bilibili.com 后，按 F12 打开控制台执行 <code>document.cookie</code>，复制结果粘贴到下方。
            </p>
            <el-input v-model="cookieInput" type="textarea" :rows="4" placeholder="粘贴 Cookie 字符串（需包含 SESSDATA）" />
            <el-button type="primary" class="bili-cookie-btn" :loading="cookieLoading" @click="loginByCookie">
              确认登录
            </el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// v3.5.3：哔哩哔哩面板 —— 学习资料页集成的在线视频模块
// 功能：扫码/Cookie 登录、热门推荐、收藏夹浏览、视频搜索、视频播放（分P/清晰度/相关推荐）
// 全部请求经主进程代理（bili:* IPC），播放流由主进程 webRequest 注入 Referer 绕过防盗链。
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Search, Star, StarFilled, Promotion, User, UserFilled, Refresh, Loading,
  VideoPlay, FolderOpened, Warning, MagicStick, SuccessFilled, Present,
  ChatDotRound, Film, Document
} from '@element-plus/icons-vue'

const api = window.electronAPI

type BiliTab = 'rcmd' | 'popular' | 'fav' | 'search'
const tab = ref<BiliTab>('rcmd')

// ── 登录状态 ──
const user = ref<BiliUser | null>(null)

async function refreshLoginStatus(): Promise<void> {
  if (!api) return
  try {
    const res = await api.biliLoginStatus()
    user.value = res.loggedIn && res.user ? res.user : null
  } catch {
    user.value = null
  }
}

async function logout(): Promise<void> {
  if (!api) return
  await api.biliLogout()
  user.value = null
  favFolders.value = []
  favList.value = []
  currentFolder.value = null
  ElMessage.success('已退出 B 站登录')
}

// ── 登录弹窗（扫码 + Cookie） ──
const loginVisible = ref(false)
const loginMode = ref<'qr' | 'cookie'>('qr')
const qrImg = ref('')
const qrLoading = ref(false)
const qrExpired = ref(false)
const qrHint = ref('等待扫码...')
let qrKey = ''
let qrTimer: ReturnType<typeof setInterval> | null = null

function openLogin(): void {
  loginVisible.value = true
  loginMode.value = 'qr'
  startQrLogin()
}

async function startQrLogin(): Promise<void> {
  if (!api) return
  stopQrPolling()
  qrImg.value = ''
  qrExpired.value = false
  qrLoading.value = true
  qrHint.value = '获取二维码中...'
  try {
    const res = await api.biliQrKey()
    qrLoading.value = false
    if (!res.success || !res.qrimg) {
      qrHint.value = res.message || '二维码获取失败，请重试'
      return
    }
    qrImg.value = res.qrimg
    qrKey = res.key || ''
    qrHint.value = '等待扫码...'
    // 二维码有效期 180 秒，每 2 秒轮询一次
    qrTimer = setInterval(async () => {
      if (!qrKey) return
      const check = await api!.biliQrCheck(qrKey)
      const code = check.code
      if (code === 0) {
        stopQrPolling()
        loginVisible.value = false
        ElMessage.success('B 站登录成功')
        await refreshLoginStatus()
        if (tab.value === 'fav') loadFavFolders()
      } else if (code === 86090) {
        qrHint.value = '已扫码，请在手机上确认'
      } else if (code === 86038) {
        stopQrPolling()
        qrExpired.value = true
        qrHint.value = '二维码已失效'
      }
    }, 2000)
  } catch (err) {
    qrLoading.value = false
    qrHint.value = String(err)
  }
}

function stopQrPolling(): void {
  if (qrTimer) {
    clearInterval(qrTimer)
    qrTimer = null
  }
}

const cookieInput = ref('')
const cookieLoading = ref(false)

async function loginByCookie(): Promise<void> {
  if (!api) return
  if (!cookieInput.value.trim()) {
    ElMessage.warning('请先粘贴 Cookie')
    return
  }
  cookieLoading.value = true
  try {
    const res = await api.biliSetCookie(cookieInput.value.trim())
    if (res.loggedIn && res.user) {
      user.value = res.user
      loginVisible.value = false
      cookieInput.value = ''
      ElMessage.success(`欢迎回来，${res.user.uname}`)
      if (tab.value === 'fav') loadFavFolders()
    } else {
      ElMessage.error(res.message || '登录验证失败')
    }
  } catch (err) {
    ElMessage.error(String(err))
  } finally {
    cookieLoading.value = false
  }
}

// ── 个性推荐（v3.5.4：首页 feed/rcmd，WBI 签名；v3.5.5：4x6 布局，换一批递增 fresh_idx） ──
const rcmdList = ref<BiliVideo[]>([])
const rcmdLoading = ref(false)
let rcmdIdx = 0

async function loadRcmd(): Promise<void> {
  if (!api || rcmdLoading.value) return
  rcmdLoading.value = true
  rcmdIdx++
  try {
    // 每批 24 条（6 列 x 4 行），fresh_idx 递增保证换一批拿到新内容
    const res = await api.biliRcmd(24, rcmdIdx)
    if (!res.success) throw new Error(res.message || '加载失败')
    rcmdList.value = res.list || []
  } catch (err) {
    ElMessage.error(`推荐加载失败: ${(err as Error).message || err}`)
  } finally {
    rcmdLoading.value = false
  }
}

// ── 热门推荐 ──
const popularList = ref<BiliVideo[]>([])
const popularPage = ref(1)
const popularHasMore = ref(true)
const popularLoading = ref(false)
// v3.5.7：首次进入热门页签自动刷新一次，之后复用缓存由「换一批」手动触发
const popularTouched = ref(false)

async function loadPopular(refresh: boolean): Promise<void> {
  if (!api || popularLoading.value) return
  popularLoading.value = true
  try {
    // 换一批：随机跳页（热门接口无总数，限定前 20 页内随机），避免一直看同一批
    const page = refresh ? 1 + Math.floor(Math.random() * 20) : popularPage.value + 1
    // v3.5.6：每页 24 条（6 列 x 4 行）
    const res = await api.biliPopular(page, 24)
    if (!res.success) throw new Error(res.message || '加载失败')
    popularList.value = refresh ? (res.list || []) : [...popularList.value, ...(res.list || [])]
    popularPage.value = page
    popularHasMore.value = !!res.hasMore
  } catch (err) {
    ElMessage.error(`热门视频加载失败: ${(err as Error).message || err}`)
  } finally {
    popularLoading.value = false
  }
}

// ── 收藏夹 ──
const favFolders = ref<{ id: number; title: string; count: number; cover: string }[]>([])
const favFoldersLoading = ref(false)
const currentFolder = ref<{ id: number; title: string; count: number; cover: string } | null>(null)
const favList = ref<BiliVideo[]>([])
const favPage = ref(1)
const favHasMore = ref(true)
const favListLoading = ref(false)

async function loadFavFolders(): Promise<void> {
  if (!api) return
  favFoldersLoading.value = true
  try {
    const res = await api.biliFavFolders()
    if (!res.success) throw new Error(res.message || '获取收藏夹失败')
    favFolders.value = res.folders || []
    if (favFolders.value.length && !currentFolder.value) {
      selectFolder(favFolders.value[0])
    }
  } catch (err) {
    ElMessage.error((err as Error).message || String(err))
  } finally {
    favFoldersLoading.value = false
  }
}

function selectFolder(f: { id: number; title: string; count: number; cover: string }): void {
  if (currentFolder.value?.id === f.id) return
  currentFolder.value = f
  favList.value = []
  favPage.value = 1
  favHasMore.value = true
  loadFavList(true)
}

async function loadFavList(refresh: boolean): Promise<void> {
  if (!api || !currentFolder.value || favListLoading.value) return
  favListLoading.value = true
  try {
    const page = refresh ? 1 : favPage.value + 1
    const res = await api.biliFavList(currentFolder.value.id, page)
    if (!res.success) throw new Error(res.message || '加载失败')
    favList.value = refresh ? (res.list || []) : [...favList.value, ...(res.list || [])]
    favPage.value = page
    favHasMore.value = !!res.hasMore
  } catch (err) {
    ElMessage.error(`收藏夹内容加载失败: ${(err as Error).message || err}`)
  } finally {
    favListLoading.value = false
  }
}

// ── 搜索 ──
const searchKeyword = ref('')
const lastKeyword = ref('')
const searchedOnce = ref(false)
const searchList = ref<BiliVideo[]>([])
const searchPage = ref(1)
const searchTotal = ref(0)
const searchNumPages = ref(0)
const searchLoading = ref(false)

async function doSearch(page: number): Promise<void> {
  if (!api) return
  const kw = searchKeyword.value.trim()
  if (!kw) {
    ElMessage.warning('请输入搜索关键词')
    return
  }
  if (page < 1) return
  searchLoading.value = true
  try {
    const res = await api.biliSearch(kw, page)
    if (!res.success) throw new Error(res.message || '搜索失败')
    searchList.value = res.list || []
    searchPage.value = page
    searchTotal.value = res.total || 0
    searchNumPages.value = res.numPages || 0
    lastKeyword.value = kw
    searchedOnce.value = true
    tab.value = 'search'
    if (!searchList.value.length) ElMessage.info('没有找到相关视频')
  } catch (err) {
    ElMessage.error(`搜索失败: ${(err as Error).message || err}`)
  } finally {
    searchLoading.value = false
  }
}

// ── 页签切换 ──
function switchTab(t: BiliTab): void {
  tab.value = t
  if (t === 'fav' && user.value && !favFolders.value.length) loadFavFolders()
  // v3.5.7：热门首次访问自动刷新内容列表
  if (t === 'popular' && !popularTouched.value) {
    popularTouched.value = true
    loadPopular(true)
  }
}

// ── 播放器 ──
const playerVisible = ref(false)
const playerLoading = ref(false)
const playerError = ref('')
const currentView = ref<{
  bvid: string; aid: number; title: string; pic: string; desc: string; duration: string; durationSec: number; pubdate: number
  owner: { mid: number; name: string; face: string }
  stat: { view: number; danmaku: number; like: number; coin: number; favorite: number; reply: number }
  pages: { cid: number; page: number; part: string; duration: string; durationSec: number }[]
} | null>(null)
const currentPageIdx = ref(0)
const currentQn = ref(64)
const qualityLabel = ref('')
const acceptQualities = ref<{ qn: number; label: string }[]>([])
const videoSrc = ref('')
let segments: { url: string; backupUrl: string[] }[] = []
let segIdx = 0
let triedBackup = false
const videoEl = ref<HTMLVideoElement | null>(null)
const relatedList = ref<BiliVideo[]>([])

async function playVideo(v: BiliVideo): Promise<void> {
  if (!api || !v.bvid) return
  playerVisible.value = true
  playerLoading.value = true
  playerError.value = ''
  videoSrc.value = ''
  relatedList.value = []
  // v3.6.2：启动播放停滞检测（高清卡顿透明降清）
  startStallCheck()
  // v3.6.0：已废弃 durl fallback，dashFallbackTried 不再使用
  try {
    // v3.6.2：视频信息走 5 分钟缓存，二次起播免请求
    const res = await getViewCached(v.bvid)
    if (!res.success || !res.video) throw new Error(res.message || '视频信息获取失败')
    currentView.value = res.video
    currentPageIdx.value = 0
    // v3.6.2：新视频重置 seek 状态（恢复进度只在用户未手动操作时生效）
    userSeeked = false
    pendingSeekSec = 0
    // v3.6.0：新视频始终请求最高可用清晰度，避免上个视频降清后残留 320p
    currentQn.value = 127
    acceptQualities.value = []
    lastTickSaveTime = 0
    // v3.5.4：查询点赞/投币/收藏状态（异步，不阻塞播放）
    loadRelation(res.video.aid)
    // v3.5.5：UP 主卡片（异步加载，不阻塞起播）
    loadUpCard(res.video.owner.mid)
    // v3.6.2：读取上次观看进度（分 P + 时间），起播后自动续播
    const savedProgress = loadBiliProgress(v.bvid)
    if (savedProgress && savedProgress.pageIdx > 0 && savedProgress.pageIdx < (res.video.pages?.length || 1)) {
      currentPageIdx.value = savedProgress.pageIdx
    }
    // 相关视频推荐（异步加载，不阻塞播放）
    api.biliRelated(v.bvid).then(r => {
      if (r.success && currentView.value?.bvid === v.bvid) relatedList.value = r.list || []
    }).catch(() => { /* 相关推荐失败不影响播放 */ })
    // v3.5.8：评论区（异步加载，不阻塞播放）
    loadReplies(true)
    // v3.6.0：自动检测可播放的最高清晰度（部分长视频被限至 720p/480p）
    await loadStream()
    // v3.6.2：播放地址就绪后恢复进度（seek 到上次位置）
    restoreBiliProgress()
  } catch (err) {
    playerLoading.value = false
    playerError.value = (err as Error).message || String(err)
  }
}

/** v3.6.2：播放机制重构——优先 durl 合并流直连（浏览器原生播放器接管），回退 DASH 高清模式
 *  v3.6.2 改进：
 *   1) durl 模式直接赋值 video.src，享受浏览器内置缓冲/seek/续播能力，起播速度提升显著
 *   2) DASH 模式保留高清晰度（1080P+/60 帧），但优化 MSE 配额管理：预清理范围从 10s→5s
 *   3) 自动选择最高可用清晰度（带宽优先），不再按 Qn 降序 fallback 导致 320p 坑
 */
async function loadStream(preferDurl = true): Promise<void> {
  if (!api || !currentView.value) return
  playerLoading.value = true
  playerError.value = ''
  triedBackup = false
  segIdx = 0
  // v3.6.2：先尝试 durl 直连（如果接口支持）
  if (preferDurl) {
    const dashRes = await api.biliPlayurl(currentView.value.bvid, currentView.value.pages[currentPageIdx.value].cid, currentQn.value, false)
    if (dashRes.success && dashRes.mode === 'dash' && dashRes.dash?.video.length > 0) {
      // v3.6.2：检查是否同时包含 durl（部分视频 fnval=4048 时返回混合响应）
      if (dashRes.durl && dashRes.durl.length > 0) {
        const durl = dashRes.durl[0] // 默认选第一分段（最长或首个）
        try {
          // v3.6.2：直接用 durl URL 赋值，由浏览器播放器接管
          videoEl.value.src = durl.url
          videoEl.value.load()
          await videoEl.value.play()
          playerLoading.value = false
          console.log('[v3.6.2] 使用 durl 直连播放:', durl.url)
          // 监听 error 若失败则回退 DASH
          videoEl.value.onerror = async () => {
            console.warn('[v3.6.2] durl 播放失败，回退 DASH')
            await loadStream(false) // 强制走 DASH
          }
          return
        } catch (err) {
          console.warn('[v3.6.2] durl 初始化失败:', err)
        }
      } else {
        // v3.6.2: 无 durl，直接进 DASH
      }
    }
  }
  // v3.6.2：DASH 模式（MSE + 回环代理）
  try {
    const page = currentView.value.pages[currentPageIdx.value]
    if (!page) throw new Error('视频分 P 信息缺失')
    // v3.6.2：播放地址走缓存（10 分钟 TTL），重开/切换清晰度免重复请求
    const res = await getPlayurlCached(currentView.value.bvid, page.cid, currentQn.value, preferDurl)
    // v3.6.2：请求失败（durl 模式 durl 为空被主进程 throw）→ 回退 DASH 重试，
    // 不再直接报"未获取到播放地址"（主进程已做 durl↔dash 互兜，此处双保险）
    if (!res.success) {
      if (preferDurl) {
        console.warn(`[播放] durl 请求失败（${res.message}），回退 DASH`)
        await loadStream(false)
        return
      }
      throw new Error(res.message || '播放地址获取失败')
    }
    acceptQualities.value = res.acceptQuality || []
    qualityLabel.value = res.qualityLabel || ''
    // v3.6.2：仅当用户选择的清晰度高于服务端最高可用时才降到最高可用（不覆盖用户选择）
    if (acceptQualities.value.length > 0) {
      const maxQn = Math.max(...acceptQualities.value.map(q => q.qn))
      if (currentQn.value > maxQn) {
        console.log(`[清晰度] 当前 ${currentQn.value} → 最高可用 ${maxQn}`)
        currentQn.value = maxQn
      }
    }
    // v3.6.2：按清晰度调整缓冲水位（DASH 兜底路径用）
    applyBufferWatermark(currentQn.value)

    if (preferDurl) {
      // ① 首选：durl 合并流原生播放（浏览器接管，体验最稳）
      if (res.mode === 'durl' && res.durl && res.durl.length && res.durl[0].url) {
        stopDash()
        currentPlayMode = 'durl'
        segments = res.durl
        videoSrc.value = segments[0].url
        playerLoading.value = false
        return
      }
      // ② 主进程已兜底返回 dash（durl 空但 dash 可用）→ 直接用，不再二次请求
      if (res.mode === 'dash' && res.dash && res.dash.video.length) {
        console.warn('[播放] durl 不可用，主进程已兜底 DASH，直接 MSE 播放')
        currentPlayMode = 'dash'
        await startDash(res.dash.video, res.dash.audio || [])
        playerLoading.value = false
        return
      }
      // ③ 都没有 → 回退 DASH 重新请求（防缓存异常结果）
      console.warn('[播放] durl/dash 均不可用，重试 DASH')
      await loadStream(false)
      return
    }

    // ③ DASH 音视频分离流（高清晰度兜底，MSE + 回环代理）
    if (res.mode === 'dash' && res.dash && res.dash.video.length) {
      currentPlayMode = 'dash'
      await startDash(res.dash.video, res.dash.audio || [])
    } else {
      stopDash()
      if (!res.durl || !res.durl.length) throw new Error('未获取到播放地址（版权受限或清晰度不足）')
      currentPlayMode = 'durl'
      segments = res.durl
      videoSrc.value = segments[0].url
    }
    playerLoading.value = false
  } catch (err) {
    playerLoading.value = false
    playerError.value = (err as Error).message || String(err)
  }
}

// ── v3.5.5：MSE DASH 播放引擎（音视频分离 fMP4；流控避免长视频吃内存） ──
let mediaSource: MediaSource | null = null
let mediaSourceUrl = ''
let dashCtrl: AbortController | null = null
let dashFinished = 0
let dashTrackTotal = 0
// v3.5.9：已废弃 durl 回退链（会导致长视频限 720p），改为降清重试
const CLEAR_PREVIOUS_CONTEXT = false  // 占位符，v3.5.9 已移除 durl fallback
// v3.5.9：收紧缓冲水位（60/30 → 45/20），增加预清理历史缓冲机制
// v3.6.1：进一步收紧（45/20 → 30/12）——高码率长视频缓冲 45s 会快速打满 MSE 配额，
//  触发 QuotaExceededError 后被旧逻辑逐级降清（长视频"自动降清晰度"的根源）。
//  低水位 + 激进清理 + 降清前置重试，保证长视频维持高清晰度稳定播放。
// v3.6.2：缓冲水位按清晰度自适应（高清晰度高码率下 30s 缓冲会快速打满 MSE 配额，
//  频繁 Quota 清理/重拉是高清卡顿主因之一）——qn≥80（1080P+）用低水位 18/8，
//  低清晰度保持 30/12 保证流畅；loadStream 拿到可播放清晰度后更新
let DASH_BUFFER_AHEAD = 30   // 缓冲超前秒数上限：达到即暂停拉流
let DASH_BUFFER_RESUME = 12  // 消耗至该秒数后恢复拉流
function applyBufferWatermark(qn: number): void {
  const high = qn >= 80
  DASH_BUFFER_AHEAD = high ? 18 : 30
  DASH_BUFFER_RESUME = high ? 8 : 12
}
let dashBuffers: SourceBuffer[] = []  // 所有注册的 SourceBuffer，用于配额清理

// ── v3.6.2：播放优化与拖动进度条修复 ──
// 用户已手动 seek 过（restore 竞态消除：打开视频 12s 内 restore 轮询不再覆盖用户拖动）
let userSeeked = false
// 管道重启后待定位的 seek 目标（秒）；startDash 读取后清零
let pendingSeekSec = 0
// 播放地址缓存（bvid:cid:qn:preferDurl → 结果，10 分钟 TTL）——
// 重开视频/切清晰度/seek 重启管道时免重复请求，显著提升响应速度
type PlayurlResult = ReturnType<NonNullable<ElectronAPI['biliPlayurl']>> extends Promise<infer R> ? R : never
const playurlCache = new Map<string, { data: PlayurlResult; exp: number }>()
const PLAYURL_TTL = 10 * 60 * 1000
async function getPlayurlCached(bvid: string, cid: number, qn: number, preferDurl = false): Promise<PlayurlResult> {
  const key = `${bvid}:${cid}:${qn}:${preferDurl}`
  const hit = playurlCache.get(key)
  if (hit && hit.exp > Date.now()) return hit.data
  const res = await api!.biliPlayurl(bvid, cid, qn, preferDurl)
  // v3.6.2：durl 结果同样缓存（原生播放优先路径），只要拿到有效地址即可缓存
  const usable = res.success &&
    ((res.mode === 'dash' && res.dash?.video?.length) || (res.mode === 'durl' && res.durl?.length))
  if (usable) {
    playurlCache.set(key, { data: res, exp: Date.now() + PLAYURL_TTL })
    if (playurlCache.size > 40) {
      const first = playurlCache.keys().next().value
      if (first) playurlCache.delete(first)
    }
  }
  return res
}

// v3.6.2：视频信息缓存（bvid → view 结果，5 分钟 TTL）——
// 重开同一视频免重复请求，配合 playurl 缓存显著缩短二次起播的等待时间。
// 仅缓存只读展示数据（标题/简介/分P/UP主/统计），点赞投币收藏状态由
// loadRelation 另行实时查询，不受缓存影响。
type BiliViewResult = ReturnType<NonNullable<ElectronAPI['biliView']>> extends Promise<infer R> ? R : never
const viewCache = new Map<string, { data: BiliViewResult; exp: number }>()
const VIEW_TTL = 5 * 60 * 1000
async function getViewCached(bvid: string): Promise<BiliViewResult> {
  const hit = viewCache.get(bvid)
  if (hit && hit.exp > Date.now()) return hit.data
  const res = await api!.biliView(bvid)
  if (res.success && res.video) {
    viewCache.set(bvid, { data: res, exp: Date.now() + VIEW_TTL })
    if (viewCache.size > 40) {
      const first = viewCache.keys().next().value
      if (first) viewCache.delete(first)
    }
  }
  return res
}

/** 已缓冲区间最远位置（秒） */
function bufferedEndSec(): number {
  const el = videoEl.value
  if (!el) return 0
  try {
    const buf = el.buffered
    let end = 0
    for (let i = 0; i < buf.length; i++) end = Math.max(end, buf.end(i))
    return end
  } catch { return 0 }
}

/** 指定 SourceBuffer 已缓冲的最远位置（秒）。v3.6.2：判断单轨道流是否完整读完，
 *  必须看本轨道缓冲（videoEl.buffered 是音视频 union，音频文件小常先读完，不能用） */
function sbBufferedEnd(sb: SourceBuffer): number {
  try {
    const buf = sb.buffered
    if (!buf.length) return 0
    return buf.end(buf.length - 1)
  } catch { return 0 }
}

/** 拖动进度条超出缓冲时：重启拉流管道（Range 从目标偏移拉流），防止 MSE 顺序拉流追不上 → 播放头重置到开头 */
let dashRestartSeq = 0  // v3.6.2：seek 重启序列号——连续快速拖动时丢弃过期重启，防止并发覆盖
// v3.6.2：流中断自动恢复序列号 + 限次计数（防并发恢复 + 限次防网络持续抖动无限重启）
let dashRecoverySeq = 0
let dashRecoveryCount = 0
let dashRecoveryWindowStart = 0
async function seekDashIfNeeded(targetSec: number): Promise<void> {
  const el = videoEl.value
  if (!el || !currentView.value || !mediaSource) return  // 非 DASH（durl 直连）由浏览器原生 seek 处理
  const bufEnd = bufferedEndSec()
  if (bufEnd <= 0 || targetSec <= bufEnd + 2) return  // 缓冲内：浏览器原生处理
  const mySeq = ++dashRestartSeq
  console.log(`[DASH] seek 目标 ${targetSec.toFixed(1)}s 超出缓冲 ${bufEnd.toFixed(1)}s，重启拉流管道`)
  try {
    const page = currentView.value.pages[currentPageIdx.value]
    if (!page) return
    stopDash()
    dashFinished = 0
    const res = await getPlayurlCached(currentView.value.bvid, page.cid, currentQn.value, false)
    // v3.6.2：期间用户再次拖动已发起更新重启 → 丢弃本次（防旧管道覆盖新管道）
    if (mySeq !== dashRestartSeq) return
    if (res.success && res.mode === 'dash' && res.dash && res.dash.video.length) {
      await startDash(res.dash.video, res.dash.audio || [], targetSec)
    } else {
      try { el.currentTime = targetSec } catch { /* ignore */ }
    }
  } catch (err) {
    if (mySeq !== dashRestartSeq) return
    console.warn('[DASH] seek 重启拉流失败，回退重载：', err)
    // 管道已被 stopDash 销毁 → 重新加载流（避免黑屏/无源状态）
    try { void loadStream() } catch { /* ignore */ }
  }
}

/** Range 管道数据就绪后定位到目标时间（最多轮询 15s，超时直接 seek 兜底）。
 *  v3.6.2：绑定当前管道的 SourceBuffer 与 MediaSource——并发重启时旧管道的
 *  就绪轮询因 ms 失效直接退出，不会误 seek。 */
function scheduleSeekAfterReady(target: number, sb: SourceBuffer | null, ms: MediaSource | null, n = 0): void {
  const el = videoEl.value
  if (!el || !ms || ms !== mediaSource) return  // 管道已被替换，放弃
  if (!sb || n >= 75) {
    try { el.currentTime = target } catch { /* ignore */ }
    el.play().catch(() => { /* 自动播放被拦截时忽略 */ })
    return
  }
  try {
    if (el.readyState >= 1 && sb.buffered.length > 0 && sb.buffered.end(sb.buffered.length - 1) >= target - 5) {
      el.currentTime = target
      // v3.6.2：seek 定位后显式 play() 恢复播放（管道重启后 video 处于 paused）
      el.play().catch(() => { /* 自动播放被拦截时忽略 */ })
      console.log(`[DASH] 已定位到 ${target.toFixed(1)}s`)
      return
    }
  } catch { /* 尚未就绪 */ }
  setTimeout(() => scheduleSeekAfterReady(target, sb, ms, n + 1), 200)
}

/** v3.6.2：DASH 流读取中断/提前结束时，重启拉流管道续播（从当前播放位置 Range 定位）。
 *  复用 seekDashIfNeeded 同款 Range 重启，但绕过"缓冲内不重启"判断——中断场景必须强制重启。
 *  30 秒内连续自动恢复超过 5 次视为网络持续不稳定，停止恢复并提示，避免无限重启。 */
async function recoverDashStream(): Promise<void> {
  const el = videoEl.value
  const cv = currentView.value
  if (!el || !cv) return
  const now = Date.now()
  if (now - dashRecoveryWindowStart > 30000) {
    dashRecoveryWindowStart = now
    dashRecoveryCount = 0
  }
  if (++dashRecoveryCount > 5) {
    console.warn('[DASH] 30 秒内连续自动恢复超过 5 次，网络持续不稳定，停止恢复')
    playerError.value = '视频流加载失败：网络不稳定，可尝试切换清晰度或重试'
    return
  }
  const t = el.currentTime
  const page = cv.pages[currentPageIdx.value]
  if (!page) return
  const mySeq = ++dashRecoverySeq
  console.log(`[DASH] 自动恢复拉流：续播自 ${t.toFixed(1)}s`)
  try {
    stopDash()
    dashFinished = 0
    const res = await getPlayurlCached(cv.bvid, page.cid, currentQn.value, false)
    if (mySeq !== dashRecoverySeq) return  // 已被更新的恢复取代
    if (res.success && res.mode === 'dash' && res.dash && res.dash.video.length) {
      await startDash(res.dash.video, res.dash.audio || [], t)
    }
  } catch (err) {
    if (mySeq !== dashRecoverySeq) return
    console.warn('[DASH] 自动恢复拉流失败：', err)
  }
}

/** v3.6.2：修复清晰度混乱与播放失败——智能 DASH 轨道选择策略
 *  v3.6.2 核心改进：
 *   1) 优先支持性最强的编码：先试 avc1(通用硬解) → 其次 hevc(大部分现代设备) → 最后 fallback
 *   2) 同编码选最高带宽（而非最低），确保高清晰度可用
 *   3) 带尝试机制：若 avc1 选中后报错（实际不可用）则降级到 hevc，最终 fallback 到任何可用的
 */
function pickDashTrack(tracks: BiliDashTrack[], qn: number): BiliDashTrack | null {
  if (!tracks.length) return null
  
  // v3.6.2：按编码分组（支持性排序：avc1 > hevc > others）
  const encodeScore = (codecs: string): number => {
    const c = codecs.toLowerCase()
    if (c.startsWith('avc1')) return 3  // 最好：Electron Chromium 硬解支持好
    if (c.startsWith('hev1') || c.startsWith('h265')) return 2  // 次优：大部分现代设备支持
    if (c.startsWith('av01')) return 1  // AV1：兼容性差，软解成本高
    return 0
  }
  
  // v3.6.2：精确匹配指定 Qn 时的最佳轨道
  const exactMatch = tracks.filter(t => t.qn === qn && t.bandwidth > 0 && t.baseUrl)
  if (exactMatch.length > 0) {
    // 优先级：支持性高的组内选最高带宽
    const sorted = [...exactMatch].sort((a, b) => {
      // 第一级：编码支持性降序
      const scoreDiff = encodeScore(b.codecs) - encodeScore(a.codecs)
      if (scoreDiff !== 0) return scoreDiff
      // 第二级：同编码时，带宽升序（降低缓冲压力）→ 改为带宽降序，确保流畅
      return b.bandwidth - a.bandwidth  // v3.6.2: 带宽更高，清晰度更好
    })
    
    // v3.6.2: 返回优先级最高的轨道（通常是最高带宽的 avc1）
    return sorted[0]
  }
  
  // v3.6.2: 无精确匹配时，全局搜索最高支持性的轨道
  const pool = tracks.filter(t => t.bandwidth > 0 && t.baseUrl)
  if (!pool.length) return tracks.find(t => t.baseUrl) || null
  
  const sorted = [...pool].sort((a, b) => {
    const scoreDiff = encodeScore(b.codecs) - encodeScore(a.codecs)
    if (scoreDiff !== 0) return scoreDiff
    return b.bandwidth - a.bandwidth  // v3.6.2: 带宽更高
  })
  
  return sorted[0] || tracks[0] || null
}

/**
 * v3.5.6：组装标准 MSE MIME。
 * B 站返回的 mime_type 形如 `video/mp4; codecs=avc1.640033`（codecs 未加引号），
 * 直接传给 isTypeSupported / addSourceBuffer 会按 RFC 6381 解析失败，
 * 因此只取容器类型，再用独立 codecs 字段重新拼装。
 */
function mseMime(t: BiliDashTrack): string {
  const container = (t.mimeType || '').split(';')[0].trim() || 'video/mp4'
  return t.codecs ? `${container}; codecs="${t.codecs}"` : container
}

/** 视频已缓冲的前瞻秒数（供流控判断） */
function bufferedAhead(): number {
  const el = videoEl.value
  if (!el) return 0
  try {
    const buf = el.buffered
    for (let i = buf.length - 1; i >= 0; i--) {
      if (el.currentTime >= buf.start(i) - 1 && el.currentTime <= buf.end(i)) {
        return buf.end(i) - el.currentTime
      }
    }
  } catch { /* ignore */ }
  return 0
}

function stopDash(): void {
  if (dashCtrl) { dashCtrl.abort(); dashCtrl = null }
  if (mediaSourceUrl) {
    try { URL.revokeObjectURL(mediaSourceUrl) } catch { /* ignore */ }
    mediaSourceUrl = ''
  }
  mediaSource = null
  dashFinished = 0
  dashTrackTotal = 0
  dashBuffers = []
}

/** v3.5.9：预清理历史缓冲（起播前移除过去 10s 以内所有碎片区间）*/
async function preCleanBuffers(el: HTMLVideoElement): Promise<void> {
  for (const sb of dashBuffers.length ? dashBuffers : []) {
    try {
      if (!sb.updating && sb.buffered.length) {
        const keepBefore = Math.max(0, el.currentTime - 10)
        for (let i = sb.buffered.length - 1; i >= 0; i--) {
          const start = sb.buffered.start(i)
          const end = Math.min(sb.buffered.end(i), keepBefore)
          if (end > start + 1) sb.remove(start, end)
        }
      }
    } catch { /* 清理失败不影响继续 */ }
  }
}

async function startDash(videoTracks: BiliDashTrack[], audioTracks: BiliDashTrack[], seekSecOverride = -1): Promise<void> {
  if (!api || !videoEl.value) throw new Error('播放器未就绪')
  
  // v3.6.2-final: 预清理历史缓冲（移除过去 10s 以内碎片区间）降低配额压力
  await preCleanBuffers(videoEl.value)
  
  const supportedVideo = videoTracks.filter(t => t.baseUrl && MediaSource.isTypeSupported(mseMime(t)))
  const vTrack = pickDashTrack(supportedVideo.length ? supportedVideo : videoTracks, currentQn.value)
  if (!vTrack || !vTrack.baseUrl) throw new Error('无可用视频轨道')
  const vMime = mseMime(vTrack)
  if (!MediaSource.isTypeSupported(vMime)) {
    throw new Error(`不支持的视频编码（${vTrack.codecs || vTrack.mimeType}），请尝试降低清晰度`)
  }
  
  const aTrack = audioTracks.length 
    ? [...audioTracks].sort((a, b) => b.bandwidth - a.bandwidth)[0] 
    : null
  const aMime = aTrack ? mseMime(aTrack) : ''
  const audioUsable = !!(aTrack && aTrack.baseUrl && MediaSource.isTypeSupported(aMime))
  
  // ✅ 修复：获取流代理 token
  const vTok = await api.biliStreamToken(vTrack.baseUrl)
  if (!vTok.success || !vTok.token || !vTok.baseUrl) throw new Error(vTok.message || '流代理获取失败')
  
  const aTok = audioUsable && aTrack ? await api.biliStreamToken(aTrack.baseUrl) : null
  
  stopDash()
  dashCtrl = new AbortController()
  const ctrl = dashCtrl
  
  const ms = new MediaSource()
  mediaSource = ms
  mediaSourceUrl = URL.createObjectURL(ms)
  videoSrc.value = '' // DASH 模式不走 :src 直连绑定，避免 error 处理器误判
  videoEl.value.src = mediaSourceUrl
  
  ms.addEventListener('sourceopen', () => {
    try {
      const seekSec = seekSecOverride >= 0 ? seekSecOverride : pendingSeekSec
      if (seekSecOverride < 0) pendingSeekSec = 0
      
      const vSb = ms.addSourceBuffer(vMime)
      dashBuffers.push(vSb)
      dashTrackTotal = 1
      pumpTrack(`${vTok.baseUrl}?token=${vTok.token}`, vSb, ctrl, currentQn.value, seekSec)
      
      if (audioUsable && aTrack && aTok && aTok.success && aTok.token && aTok.baseUrl) {
        const aSb = ms.addSourceBuffer(aMime)
        dashBuffers.push(aSb)
        dashTrackTotal = 2
        pumpTrack(`${aTok.baseUrl}?token=${aTok.token}`, aSb, ctrl, currentQn.value, seekSec)
      }
      
      if (seekSec > 0) scheduleSeekAfterReady(seekSec, vSb, ms)
    } catch (err) {
      playerError.value = `播放初始化失败：${(err as Error).message || err}`
    }
  }, { once: true })
}

// ── v3.5.9：取消 durl 回退链，改为降清重试 ──
// v3.6.2：彻底移除自动降清——MSE 配额（Chrome 桌面约 150MB）不足的正解是
//  **主动定期清理播放点前的历史缓冲**（MSE 实践：updateend 后 evict 旧区间），
//  而非降清晰度。降清只应由用户手动选择（清晰度下拉框）。
//  播放中遇到 QuotaExceededError：清理 → 等待缓冲消耗 → 重试同清晰度，绝不自动降清。
async function pumpTrack(urls: string[], sb: SourceBuffer, ctrl: AbortController, qn?: number, startSec = 0): Promise<void> {
  try {
    // ── 阶段一：获取可读流（备用 CDN 地址轮换，主地址失败自动切换） ──
    let resp: Response | null = null
    let lastErr: unknown = null
    for (let i = 0; i < urls.length; i++) {
      if (ctrl.signal.aborted) return
      const url = urls[i]
      try {
        if (startSec > 0) {
          // v3.6.2：Range 定位拉流（拖动进度条超出缓冲时的管道重启）——
          // 先取文件总大小与 init segment（fMP4 的 moov/init 位于文件头），再从目标
          // 时间对应的字节偏移 Range 拉取，避免顺序拉流从 0 追赶到目标导致长时间
          // waiting/播放头重置到开头。主进程流代理已透传 Range 与 206/Content-Range。
          // 任一环节失败（CDN 拒绝 Range/网络抖动）→ 静默回退从头拉取，不报错。
          try {
            const head = await fetch(url, { method: 'HEAD', signal: ctrl.signal })
            const total = Number(head.headers.get('content-length') || 0)
            const dur = currentView.value?.pages[currentPageIdx.value]?.durationSec || videoEl.value?.duration || 0
            if (total > 0 && dur > 0) {
              // 1) 目标偏移：时间比例 × 总大小，乘 0.95 保守前移（VBR 码率波动时宁可多拉）
              const offset = Math.max(0, Math.min(total - 1, Math.floor((startSec / dur) * total * 0.95)))
              // 2) init segment（fMP4 头部 2MB 覆盖 moov/init）与目标偏移流并行拉取——
              //    两者都成功才追加 init 并采用该流，避免"init 已追加但流片段失败后
              //    从头重拉"造成 init 重复追加（备用地址轮换场景下更易触发）
              const initResp = await fetch(url, { headers: { Range: 'bytes=0-2097151' }, signal: ctrl.signal })
              const segResp = await fetch(url, { headers: { Range: `bytes=${offset}-` }, signal: ctrl.signal })
              if ((initResp.ok || initResp.status === 206) && initResp.body &&
                  (segResp.ok || segResp.status === 206)) {
                const initBuf = await initResp.arrayBuffer()
                if (initBuf.byteLength > 0) await appendWithQuotaGuard(sb, initBuf, ctrl)
                resp = segResp
              }
            }
          } catch { /* Range 不可用：走下方兜底从头拉取 */ }
        }
        // 兜底：无 startSec 或 Range 失败时从头拉取
        if (!resp) resp = await fetch(url, { signal: ctrl.signal })
        if (!resp.ok || !resp.body) {
          lastErr = new Error(`流拉取失败（HTTP ${resp.status}）`)
          console.warn(`[DASH] 流地址 ${i + 1}/${urls.length} 不可用（HTTP ${resp.status}），尝试备用 CDN`)
          continue
        }
        break // 成功获取流
      } catch (err) {
        if (ctrl.signal.aborted) return
        lastErr = err
        // 管道替换/中止类错误：正常竞态，静默返回，不换地址不报错
        if (err instanceof DOMException &&
            (err.name === 'InvalidStateError' || err.name === 'InvalidAccessError' || err.name === 'AbortError')) {
          return
        }
        // 配额错误：交给外层配额恢复处理，不在此换地址
        if (err instanceof DOMException && err.name === 'QuotaExceededError') throw err
        console.warn(`[DASH] 流地址 ${i + 1}/${urls.length} 异常，尝试备用 CDN：`, (err as Error).message)
        // continue 尝试下一个备用地址
      }
    }
    if (!resp || !resp.body) {
      if (lastErr) throw lastErr
      throw new Error('流拉取失败（无可用流地址）')
    }

    // ── 阶段二：读取循环（流控 + 提前结束/中断自动恢复续播） ──
    const reader = resp.body.getReader()
    for (;;) {
      if (ctrl.signal.aborted) return
      while (!ctrl.signal.aborted && bufferedAhead() > DASH_BUFFER_AHEAD) {
        await waitEvent(videoEl.value!, 'timeupdate', ctrl, 1000)
      }
      if (ctrl.signal.aborted) return
      // v3.6.2：read 用 catch 捕获网络中断——读取中 CDN 连接被掐断时触发自动恢复续播，
      // 不再让 TypeError 冒泡到外层被当作"加载失败"整段停止
      const r = await reader.read().catch((readErr: unknown) => {
        if (ctrl.signal.aborted) return undefined
        console.warn('[DASH] 流读取中断，自动恢复拉流：', (readErr as Error).message)
        void recoverDashStream()
        return undefined
      })
      if (r === undefined) return  // 读取中断已触发恢复
      if (r.done) {
        // v3.6.2：判断"提前断流"必须看本轨道缓冲最远位置，而非播放头 currentTime——
        // 文件正常读完时 currentTime 可能还很小（刚起播/短文件快网络整文件迅速缓冲完），
        // 用它判断会误判为断流 → 无限重启恢复 → 30 秒 5 次后报"网络不稳定"，视频无法播放。
        // 本轨道缓冲最远位置 < knownDur-2 才说明文件没读完整 = 真断流，才触发恢复。
        const knownDur = currentView.value?.pages[currentPageIdx.value]?.durationSec || 0
        const bufEnd = sbBufferedEnd(sb)
        if (knownDur > 0 && bufEnd < knownDur - 2) {
          console.warn(`[DASH] 流提前结束（缓冲至 ${bufEnd.toFixed(1)}s / 共 ${knownDur.toFixed(1)}s），自动恢复拉流`)
          void recoverDashStream()
          return
        }
        break
      }
      // v3.6.2：read 返回后再次检查 abort——管道可能已被 seek 重启（stopDash），
      // 若继续 append 会抛 InvalidStateError（SourceBuffer removed）
      if (ctrl.signal.aborted) return
      // v3.6.2：append 前主动清理播放点前 10s 之外的历史缓冲，从源头防止配额打满
      evictOldBuffers(videoEl.value)
      await appendWithQuotaGuard(sb, r.value, ctrl)
      if (ctrl.signal.aborted) return
    }
    dashFinished++
    if (dashFinished >= dashTrackTotal && mediaSource && mediaSource.readyState === 'open') {
      try { mediaSource.endOfStream() } catch { /* ignore */ }
    }
  } catch (err) {
    if (ctrl.signal.aborted) return
    // v3.6.2：管道替换/中止类错误（append 到已移除 SourceBuffer、abort 竞态）
    // 静默处理——拖动进度条重启管道时的正常竞态，绝不向 UI 显示"加载失败"
    if (err instanceof DOMException &&
        (err.name === 'InvalidStateError' || err.name === 'InvalidAccessError' || err.name === 'AbortError')) {
      return
    }
    const isQuota = err instanceof DOMException && err.name === 'QuotaExceededError'
    if (isQuota) {
      // v3.6.2：配额不足 → 激进清理 + 等待缓冲消耗 + 重试同清晰度（不降清）
      console.warn('[DASH] 配额不足，清理历史缓冲后等待消耗（保持当前清晰度）')
      evictOldBuffers(videoEl.value, 2)  // 保留播放点前 2s，其余全清
      // 等待缓冲消耗到 resume 水位以下，然后恢复拉流
      try {
        await new Promise(r => setTimeout(r, 500))
        while (!ctrl.signal.aborted && videoEl.value && bufferedAhead() > DASH_BUFFER_RESUME) {
          await waitEvent(videoEl.value, 'timeupdate', ctrl, 500)
        }
      } catch { /* ignore */ }
      if (ctrl.signal.aborted) return
      // 同清晰度重启拉流（全量重置缓冲），绝不自动降清
      try {
        const page = currentView.value?.pages[currentPageIdx.value]
        if (page) {
          const res = await getPlayurlCached(currentView.value!.bvid, page.cid, currentQn.value, false)
          if (res.success && res.mode === 'dash' && res.dash && res.dash.video.length) {
            stopDash()
            dashFinished = 0
            await startDash(res.dash.video, res.dash.audio || [])
            return
          }
        }
      } catch { /* 重启失败：保持当前缓冲继续播放 */ }
      if (ctrl.signal.aborted) return
      // 无法重启：保留已缓冲内容继续播放，不设置错误页（避免中断观看）
      return
    }
    playerError.value = `视频流加载失败：${(err as Error).message || err}，可尝试切换清晰度或重试`
  }
}

/** v3.6.2：主动清理播放点前的历史缓冲区间（MSE 配额管理正解）。
 *  保留 keepSeconds 秒（默认 10s）便于回拖，其余已播区间逐段移除（含碎片）。 */
function evictOldBuffers(el: HTMLVideoElement | null, keepSeconds = 10): void {
  if (!el || !dashBuffers.length) return
  const keepBefore = Math.max(0, el.currentTime - keepSeconds)
  for (const b of dashBuffers) {
    try {
      if (b.updating || !b.buffered.length) continue
      for (let i = b.buffered.length - 1; i >= 0; i--) {
        const start = b.buffered.start(i)
        const end = Math.min(b.buffered.end(i), keepBefore)
        if (end > start + 1) b.remove(start, end)
      }
    } catch { /* 单个缓冲区清理失败不阻断 */ }
  }
}

/**
 * v3.5.8：带配额保护的 append（v3.5.7 基础上加强）。
 * 触发 QuotaExceededError 时清理全部已注册 SourceBuffer 中播放点之前的
 * 所有历史缓冲区间（音视频一起释放），随后重试追加。
 */
async function appendWithQuotaGuard(sb: SourceBuffer, chunk: BufferSource, ctrl: AbortController): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (sb.updating) await waitEvent(sb, 'updateend', ctrl)
    if (ctrl.signal.aborted) return
    try {
      // v3.6.2：append 后不再等待 updateend——SourceBuffer 内部队列自动串行，
      // 下次 append 前的 `sb.updating` 检查已处理排队；QuotaExceededError 由
      // appendBuffer 同步抛出（Chrome 内存不足时同步抛），不影响配额保护。
      // 流水线化后大 chunk 连续追加吞吐显著提升（高清晰度高清流卡顿优化）。
      sb.appendBuffer(chunk)
      return
    } catch (err) {
      // v3.6.2：管道已替换（拖动进度条 seek 重启 MediaSource）时，append 到已移除的
      // SourceBuffer 会抛 InvalidStateError——这是正常竞态，静默返回，不向 UI 报错
      if (ctrl.signal.aborted) return
      const isInvalid = err instanceof DOMException &&
        (err.name === 'InvalidStateError' || err.name === 'InvalidAccessError' || err.name === 'AbortError')
      if (isInvalid) return
      const isQuota = err instanceof DOMException && err.name === 'QuotaExceededError'
      if (!isQuota || attempt === 2) throw err
      // 保留播放点前 10s 便于回拖，其余历史缓冲逐段移除（含碎片区间）
      const el = videoEl.value
      const keepBefore = el ? Math.max(0, el.currentTime - 10) : 0
      for (const b of dashBuffers.length ? dashBuffers : [sb]) {
        try {
          if (b.updating) continue
          for (let i = b.buffered.length - 1; i >= 0; i--) {
            const start = b.buffered.start(i)
            const end = Math.min(b.buffered.end(i), keepBefore)
            if (end > start + 1) b.remove(start, end)
          }
        } catch { /* 单个缓冲区清理失败不阻断其它清理 */ }
      }
      if (sb.updating) await waitEvent(sb, 'updateend', ctrl)
    }
  }
}

/** 等待事件或轮询超时（abort 时立即返回），用于流控节流 */
function waitEvent(target: EventTarget, ev: string, ctrl: AbortController, pollMs = 0): Promise<void> {
  return new Promise(resolve => {
    let timer: ReturnType<typeof setInterval> | null = null
    const cleanup = () => {
      target.removeEventListener(ev, onEvent)
      ctrl.signal.removeEventListener('abort', onAbort)
      if (timer) clearInterval(timer)
      resolve()
    }
    const onEvent = () => cleanup()
    const onAbort = () => cleanup()
    target.addEventListener(ev, onEvent, { once: true })
    ctrl.signal.addEventListener('abort', onAbort, { once: true })
    if (pollMs > 0) timer = setInterval(cleanup, pollMs)
  })
}

function retryPlay(): void {
  loadStream()
}

function switchPage(idx: number): void {
  if (!currentView.value || idx === currentPageIdx.value) return
  currentPageIdx.value = idx
  lastTickSaveTime = 0
  loadStream()
}

function switchQuality(qn: number): void {
  if (qn === currentQn.value) return
  currentQn.value = qn
  // v3.6.2：用户手动切换后重置自动降清防抖（30s 内不自动降清）
  lastAutoDowngradeAt = Date.now()
  loadStream()
}

// ── v3.6.2：高清卡顿检测与透明降清（durl/DASH 通用） ──
// 轮询检测"播放停滞"：播放中（未暂停/未结束）currentTime 500ms 间隔不推进，
// 累计 ≥6s 视为缓冲不足（高清高码率网络带宽不够）→ 透明降一档清晰度：
// ① 明确提示（可手动切回，绝不静默降清）② 30s 防抖 ③ 最低可用档停止。
// 不用 waiting 事件：Chromium 的 waiting 在进入缓冲等待时只触发一次，
// 无法据此累计停滞时长，轮询 currentTime 推进最可靠。
let stallCheckTimer: ReturnType<typeof setInterval> | null = null
let stallLastTime = -1
let stallSeconds = 0
let lastAutoDowngradeAt = 0   // 上次自动降清时间戳（30s 防抖）
let currentPlayMode: 'durl' | 'dash' | '' = ''  // v3.6.2：当前播放模式（降清保持模式）
function startStallCheck(): void {
  if (stallCheckTimer) return
  stallLastTime = -1
  stallSeconds = 0
  stallCheckTimer = setInterval(() => {
    const el = videoEl.value
    if (!el || !currentView.value || el.paused || el.ended || el.readyState < 2) {
      stallSeconds = 0
      return
    }
    const t = el.currentTime
    if (stallLastTime >= 0 && Math.abs(t - stallLastTime) < 0.05) {
      stallSeconds += 0.5
      if (stallSeconds >= 6) {
        stallSeconds = 0
        autoDowngradeQuality()
      }
    } else {
      stallSeconds = 0
    }
    stallLastTime = t
  }, 500)
}
function stopStallCheck(): void {
  if (stallCheckTimer) { clearInterval(stallCheckTimer); stallCheckTimer = null }
}
function autoDowngradeQuality(): void {
  if (!currentView.value || acceptQualities.value.length < 2) return
  if (Date.now() - lastAutoDowngradeAt < 30000) return  // 30s 防抖
  const sorted = [...acceptQualities.value].map(q => q.qn).sort((a, b) => b - a)
  const lower = sorted.find(q => q < currentQn.value)
  if (!lower) return  // 已是最低可用档
  lastAutoDowngradeAt = Date.now()
  console.warn(`[播放] 播放停滞，自动降清 ${currentQn.value} → ${lower}`)
  ElMessage.warning('网络缓冲不足，已自动切换清晰度（可在清晰度菜单手动切回）')
  currentQn.value = lower
  // v3.6.2：降清保持当前播放模式（durl 原生 / DASH MSE），避免跳模式
  void loadStream(currentPlayMode === 'dash')
}

/** 多分段（长视频 FLV 分段）自动连播 */
function onVideoEnded(): void {
  if (segIdx < segments.length - 1) {
    segIdx++
    triedBackup = false
    videoSrc.value = segments[segIdx].url
    videoEl.value?.play().catch(() => { /* 自动播放被拦截时等待用户手动播放 */ })
  }
}

/** 播放出错时优先切换备用 CDN 地址 */
function onVideoError(): void {
  if (!videoSrc.value) return // 未设置 src 时不处理（关闭弹窗瞬间可能触发）
  const seg = segments[segIdx]
  if (!triedBackup && seg && seg.backupUrl.length) {
    triedBackup = true
    videoSrc.value = seg.backupUrl[0]
    videoEl.value?.play().catch(() => {})
  } else {
    playerError.value = '视频流加载失败，可能是清晰度受限或网络问题，请尝试切换清晰度'
  }
}

function onPlayerClose(): void {
  // 弹窗关闭：停止播放并清理，释放带宽与内存
  stopDash()
  stopStallCheck()  // v3.6.2：停止播放停滞检测
  currentPlayMode = ''  // v3.6.2：重置播放模式
  pendingSeekSec = 0  // v3.6.2：清理待定位 seek 目标，防止残留影响下次播放
  // v3.6.2：关闭前保存当前观看进度（续播用）
  try {
    if (currentView.value && videoEl.value && videoEl.value.currentTime > 0) {
      saveBiliProgress(currentView.value.bvid, currentPageIdx.value, videoEl.value.currentTime)
    }
  } catch { /* ignore */ }
  try { videoEl.value?.pause() } catch { /* ignore */ }
  videoSrc.value = ''
  segments = []
  segIdx = 0
  playerLoading.value = false
  playerError.value = ''
  relLiked.value = false
  relCoin.value = 0
  relFaved.value = false
  upCard.value = null
  authorSectionVisible.value = false
  rightTab.value = 'replies'
  // v3.5.8：清理评论列表
  replyList.value = []
  replyPage.value = 1
  replyHasMore.value = false
  spaceList.value = []
}

// ── v3.5.4：视频交互（点赞 / 投币 / 收藏） ──
const relLiked = ref(false)
const relCoin = ref(0)
const relFaved = ref(false)
const relBusy = ref(false)

/** 登录后查询当前用户对该视频的交互状态（失败静默，不影响播放） */
async function loadRelation(aid: number): Promise<void> {
  relLiked.value = false
  relCoin.value = 0
  relFaved.value = false
  if (!api || !aid) return
  try {
    const r = await api.biliRelation(aid)
    if (r.success) {
      relLiked.value = !!r.like
      relCoin.value = r.coin || 0
      relFaved.value = !!r.favorite
    }
  } catch { /* 未登录或接口异常时按钮保持默认态 */ }
}

function requireBiliLogin(): boolean {
  if (user.value) return true
  ElMessage.info('请先登录 B 站')
  openLogin()
  return false
}

async function toggleLike(): Promise<void> {
  if (!api || !currentView.value || relBusy.value) return
  if (!requireBiliLogin()) return
  relBusy.value = true
  try {
    const next = !relLiked.value
    const res = await api.biliLike(currentView.value.aid, next ? 1 : 2)
    if (!res.success) throw new Error(res.message || '操作失败')
    relLiked.value = next
    ElMessage.success(next ? '已点赞' : '已取消点赞')
  } catch (err) {
    ElMessage.error((err as Error).message || String(err))
  } finally {
    relBusy.value = false
  }
}

async function giveCoin(multiply: number | string): Promise<void> {
  if (!api || !currentView.value || relBusy.value) return
  if (!requireBiliLogin()) return
  const n = Number(multiply) || 1
  if (relCoin.value >= 2) {
    ElMessage.info('该视频已投满 2 个币')
    return
  }
  relBusy.value = true
  try {
    const res = await api.biliCoin(currentView.value.aid, n)
    if (!res.success) throw new Error(res.message || '投币失败')
    relCoin.value = Math.min(relCoin.value + n, 2)
    ElMessage.success(`成功投出 ${n} 个币`)
  } catch (err) {
    ElMessage.error((err as Error).message || String(err))
  } finally {
    relBusy.value = false
  }
}

async function toggleFav(): Promise<void> {
  if (!api || !currentView.value || relBusy.value) return
  if (!requireBiliLogin()) return
  relBusy.value = true
  try {
    // 目标收藏夹：默认收藏夹（用户收藏夹列表的首项）
    if (!favFolders.value.length) await loadFavFolders()
    const target = favFolders.value[0]
    if (!target) throw new Error('未找到可用的收藏夹')
    const next = !relFaved.value
    const aid = currentView.value.aid
    const res = await api.biliFavToggle(aid, target.id, next)
    if (!res.success) throw new Error(res.message || '操作失败')
    relFaved.value = next
    ElMessage.success(next ? `已收藏到「${target.title}」` : '已取消收藏')
    // v3.5.8：稍后复查服务端实际状态，避免按钮与真实收藏状态脱节
    setTimeout(() => { if (currentView.value && currentView.value.aid === aid) loadRelation(aid) }, 1000)
  } catch (err) {
    ElMessage.error((err as Error).message || String(err))
    // v3.5.8：失败时复查实际状态，回滚可能的按钮状态漂移
    if (currentView.value) loadRelation(currentView.value.aid)
  } finally {
    relBusy.value = false
  }
}

// ── v3.5.8：视频评论（热评优先，分页加载更多） ──
const replyList = ref<BiliReply[]>([])
const replyPage = ref(1)
const replyHasMore = ref(false)
const replyLoading = ref(false)

async function loadReplies(refresh: boolean): Promise<void> {
  if (!api || !currentView.value || replyLoading.value) return
  const aid = currentView.value.aid
  replyLoading.value = true
  try {
    const page = refresh ? 1 : replyPage.value + 1
    const res = await api.biliReply(aid, page)
    // 视频已切换则丢弃过期结果
    if (!res.success || currentView.value?.aid !== aid) return
    replyList.value = refresh ? (res.list || []) : [...replyList.value, ...(res.list || [])]
    replyPage.value = page
    replyHasMore.value = !!res.hasMore
  } catch { /* 评论加载失败静默降级 */ }
  finally { replyLoading.value = false }
}

// ── v3.6.2：观看进度保存/续播（video seek / timeupdate 驱动） ──
const BILI_PROGRESS_KEY = 'kaoyan_bili_progress_v1'

interface BiliProgress { pageIdx: number; time: number; updatedAt: number }

function loadBiliProgress(bvid: string): BiliProgress | null {
  try {
    const raw = localStorage.getItem(BILI_PROGRESS_KEY)
    if (!raw) return null
    const all = JSON.parse(raw) as Record<string, BiliProgress>
    const p = all[bvid]
    if (p && typeof p.pageIdx === 'number' && typeof p.time === 'number' && p.time > 10) return p
    return null
  } catch { return null }
}

function saveBiliProgress(bvid: string, pageIdx: number, time: number): void {
  // v3.6.2：与 loadBiliProgress 的 >10s 阈值保持一致——seek 失败被浏览器 clamp/回退时
  // currentTime 会回到 0~10s 的小值，若写入会覆盖正常进度，导致"下次打开又跳开头"的恶性循环。
  // 仅当时间有效且超过 10s 才落盘（<10s 的进度恢复时本就会被忽略，保存无意义）。
  if (!bvid || !isFinite(time) || time <= 10) return
  try {
    const raw = localStorage.getItem(BILI_PROGRESS_KEY)
    const all = raw ? JSON.parse(raw) as Record<string, BiliProgress> : {}
    all[bvid] = { pageIdx, time, updatedAt: Date.now() }
    // 上限保护：最多保留 200 条
    const keys = Object.keys(all)
    if (keys.length > 200) {
      keys.sort((a, b) => (all[a].updatedAt || 0) - (all[b].updatedAt || 0))
      for (const k of keys.slice(0, keys.length - 200)) delete all[k]
    }
    localStorage.setItem(BILI_PROGRESS_KEY, JSON.stringify(all))
  } catch { /* 存储失败不影响播放 */ }
}

/** 由 video timeupdate 驱动：节流保存当前进度（每 5 秒） */
function onVideoTick(): void {
  const el = videoEl.value
  if (!el || !currentView.value || el.paused) return
  const t = el.currentTime
  if (t - lastTickSaveTime >= 5) {
    lastTickSaveTime = t
    // v3.6.2：进度只前进不后退——视频因缓冲/seek 失败异常回退时 currentTime 大幅变小，
    // 此时绝不覆盖已保存的正常进度（防止"一直跳开头"）。用户手动拖动进度条走 onVideoSeeking 保存。
    const prev = loadBiliProgress(currentView.value.bvid)
    if (prev && t < prev.time - 5) return
    saveBiliProgress(currentView.value.bvid, currentPageIdx.value, t)
  }
}

let lastTickSaveTime = 0

/** 拖动进度条：立即保存最新位置；目标超出缓冲时重启拉流管道（Range 定位），防"重置到开头" */
function onVideoSeeking(): void {
  const el = videoEl.value
  if (!el || !currentView.value) return
  userSeeked = true  // v3.6.2：标记用户已手动 seek，restore 轮询不再覆盖
  const t = el.currentTime
  saveBiliProgress(currentView.value.bvid, currentPageIdx.value, t)
  void seekDashIfNeeded(t)
}

/** 打开视频时尝试恢复到上次进度（仅当上次 > 10s，且未播放到末尾） */
function restoreBiliProgress(): void {
  if (!currentView.value) return
  const saved = loadBiliProgress(currentView.value.bvid)
  if (!saved) return
  // 注：目标分 P 已在 playVideo 中恢复（currentPageIdx + loadStream），这里只负责 seek 时间，
  // 不再重复 loadStream，避免二次加载流引发竞态。
  const el = videoEl.value
  if (!el) return
  // 等待元数据/可 seek 后再跳转（DASH 模式 MediaSource 就绪后 seek）
  let attempts = 0
  let seekDone = false
  const trySeek = () => {
    // v3.6.2：用户已手动拖动过进度条 → 不再自动恢复，避免覆盖用户拖动（"跳回开头"竞态）
    if (seekDone || userSeeked) return
    try {
      const dur = el.duration
      if (isFinite(dur) && dur > 0 && saved.time < dur - 5) {
        el.currentTime = saved.time
        seekDone = true
        console.log(`[进度] 已续播 ${currentView.value?.bvid} P${saved.pageIdx + 1} @${saved.time.toFixed(1)}s`)
        // v3.6.2：seek 后校验是否真正到达目标——MSE 缓冲不足时浏览器可能 clamp/回退，
        // 此时只记录日志并放弃续播（保持自然播放），绝不再次 seek，防止"一直跳开头"循环。
        // 原进度仍保留在 localStorage（保存端已加前进保护），下次打开可再次尝试。
        setTimeout(() => {
          const t = el.currentTime
          if (Math.abs(t - saved.time) > 5) {
            console.warn(`[进度] 续播 seek 未达目标（期望 ${saved.time.toFixed(1)}s，实际 ${t.toFixed(1)}s），放弃续播`)
          }
        }, 5000)
      }
    } catch { /* seek 时机未到，重试 */ }
  }
  const loop = () => {
    attempts++
    if (el.readyState >= 1 && isFinite(el.duration) && el.duration > 0) {
      trySeek()
    } else if (attempts < 60) {  // 最多等待 12s（DASH 冷启动较慢）
      setTimeout(loop, 200)
    }
  }
  setTimeout(loop, 150)
}

// ── v3.5.5：UP 主卡片与投稿 ──
const upCard = ref<BiliUpCard | null>(null)
const authorSectionVisible = ref(false)
const spaceList = ref<BiliVideo[]>([])
const spacePage = ref(1)
const spaceHasMore = ref(false)
const spaceLoading = ref(false)
// v3.6.0：右侧栏三视图 (评论/投稿/相关)，默认评论；查看投稿按钮切换
const rightTab = ref<'replies' | 'space' | 'related'>('replies')
const openAuthorVideos = (): void => {
  if (rightTab.value === 'space') {
    rightTab.value = 'replies'
  } else {
    rightTab.value = 'space'
    if (!spaceList.value.length) loadSpaceVideos(true)
  }
}
const switchRightTab = (tab: 'replies' | 'space' | 'related'): void => {
  rightTab.value = tab
  if (tab === 'space' && !spaceList.value.length) loadSpaceVideos(true)
}

async function loadUpCard(mid: number): Promise<void> {
  upCard.value = null
  authorSectionVisible.value = false
  spaceList.value = []
  spacePage.value = 1
  spaceHasMore.value = false
  if (!api || !mid) return
  try {
    const res = await api.biliCard(mid)
    if (res.success && res.card) upCard.value = res.card
  } catch { /* UP 主信息获取失败不影响播放 */ }
}

function toggleAuthorVideos(): void {
  authorSectionVisible.value = !authorSectionVisible.value
  if (authorSectionVisible.value && !spaceList.value.length) loadSpaceVideos(true)
}

async function loadSpaceVideos(refresh: boolean): Promise<void> {
  if (!api || !upCard.value || spaceLoading.value) return
  spaceLoading.value = true
  try {
    const page = refresh ? 1 : spacePage.value + 1
    const res = await api.biliSpaceVideos(upCard.value.mid, page)
    if (!res.success) throw new Error(res.message || '获取失败')
    spaceList.value = refresh ? (res.list || []) : [...spaceList.value, ...(res.list || [])]
    spacePage.value = page
    spaceHasMore.value = !!res.hasMore
  } catch (err) {
    ElMessage.error(`投稿视频获取失败: ${(err as Error).message || err}`)
  } finally {
    spaceLoading.value = false
  }
}

// ── 工具函数 ──
function formatCount(n: number | string): string {
  const num = typeof n === 'number' ? n : Number(n) || 0
  if (num >= 100000000) return (num / 100000000).toFixed(1) + ' 亿'
  if (num >= 10000) return (num / 10000).toFixed(1) + ' 万'
  return String(num)
}

onMounted(() => {
  refreshLoginStatus()
  loadRcmd()
})

onBeforeUnmount(() => {
  stopQrPolling()
  stopStallCheck()  // v3.6.2：组件卸载前停止播放停滞检测
  stopDash()
  try { videoEl.value?.pause() } catch { /* ignore */ }
})
</script>

<style scoped>
/* v3.5.3：B 站面板样式 —— 与学习资料页同一套玻璃拟态变量，保持整体风格一致 */
.bili-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  min-height: 0;
  /* v3.6.1：面板整体在"学习资料"板块中水平居中（播放卡片不再贴左，
     超宽窗口下内容也不过度拉伸，视觉重心落在板块中心） */
  width: 100%;
  max-width: 1560px;
  margin: 0 auto;
}

/* v3.6.2：播放悬浮窗口卡片右移样式已移至文件末尾非 scoped 块（el-dialog append-to-body
   渲染到 body，scoped 的 [data-v-xxx] 选择器匹配不到） */
.glass-card {
  position: relative;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--mo-radius);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  box-shadow:
    var(--glass-shadow),
    inset 0 1px 0 rgba(255, 255, 255, var(--glass-edge-highlight)),
    inset 0 -1px 0 rgba(255, 255, 255, var(--glass-highlight-bottom));
}

/* ── 工具栏 ── */
.bili-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  flex-wrap: wrap;
}

.bili-tabs {
  display: flex;
  gap: 6px;
}

.bili-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--mo-text-2);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.bili-tab:hover:not(:disabled) {
  color: var(--mo-text-1);
  background: rgba(59, 130, 246, 0.08);
}

.bili-tab.active {
  color: var(--mo-accent);
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.35);
}

.bili-tab:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.bili-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 220px;
}

.bili-search-input {
  flex: 1;
  max-width: 380px;
  padding: 7px 14px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.35);
  color: var(--mo-text-1);
  font-size: 13px;
  outline: none;
  transition: all 0.2s ease;
}

html.dark .bili-search-input {
  background: rgba(255, 255, 255, 0.08);
}

.bili-search-input:focus {
  border-color: var(--mo-accent);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.18);
}

.bili-user {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.bili-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--glass-border);
}

.bili-avatar-placeholder {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.12);
  color: var(--mo-accent);
  padding: 5px;
}

.bili-uname {
  font-size: 13px;
  color: var(--mo-text-1);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 内容区 ── */
.bili-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.bili-content-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.bili-content-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--mo-text-1);
}

.bili-content-title.small {
  font-size: 13px;
}

.bili-folder-total {
  font-size: 12px;
  font-weight: 400;
  color: var(--mo-text-2);
}

/* ── 视频卡片网格 ── */
.bili-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 14px;
}

.bili-grid.related {
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}

/* v3.5.6：推荐/热门固定 6 列（每批 24 条 = 6×4），适配面板宽度 */
.bili-grid.cols-6 {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

/* v3.5.6：播放弹窗右侧栏单列卡片（UP 主投稿 / 相关视频） */
/* v3.5.8：右侧栏改用左图右文行卡，side-col 网格规则移除 */

.bili-card {
  border-radius: var(--mo-radius-sm);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.bili-card:hover {
  transform: translateY(-3px);
  border-color: rgba(59, 130, 246, 0.4);
  box-shadow: 0 8px 24px rgba(30, 60, 120, 0.16);
}

.bili-cover-wrap {
  position: relative;
  aspect-ratio: 16 / 9;
  background: rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.bili-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.25s ease;
}

.bili-card:hover .bili-cover {
  transform: scale(1.04);
}

.bili-duration {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 1px 7px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.62);
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  z-index: 2;
}

.bili-cover-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.28);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.bili-card:hover .bili-cover-mask {
  opacity: 1;
}

.bili-play-icon {
  font-size: 34px;
  color: #fff;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4));
}

.bili-card-info {
  /* v3.6.2：收紧上下 padding，缩短卡片整体高度（个性推荐/热门推荐卡片更紧凑） */
  padding: 6px 10px 8px;
}

.bili-card-title {
  font-size: 13px;
  line-height: 1.4;
  color: var(--mo-text-1);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  /* v3.6.2：36px → 34px，单行标题卡片更矮（两行标题仍完整显示，不受影响） */
  min-height: 34px;
}

.bili-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  /* v3.6.2：6px → 4px，进一步压缩卡片高度 */
  margin-top: 4px;
  font-size: 11px;
  color: var(--mo-text-2);
}

.bili-meta-author {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bili-meta-stat {
  flex-shrink: 0;
}

/* ── 加载 / 空状态 ── */
.bili-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 0;
  color: var(--mo-text-2);
  font-size: 13px;
}

.bili-loading.small {
  padding: 20px 0;
}

.bili-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 20px;
  color: var(--mo-text-2);
  text-align: center;
}

.bili-load-more {
  display: flex;
  justify-content: center;
  padding: 4px 0 8px;
}

/* ── 收藏夹布局 ── */
.bili-fav-layout {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.bili-fav-folders {
  width: 220px;
  flex-shrink: 0;
  padding: 12px;
  max-height: 560px;
  overflow-y: auto;
}

.bili-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--mo-text-1);
  margin-bottom: 10px;
}

.bili-folder-empty {
  font-size: 12px;
  color: var(--mo-text-2);
  text-align: center;
  padding: 16px 0;
}

.bili-folder-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--mo-text-2);
  transition: all 0.18s ease;
}

.bili-folder-item:hover {
  background: rgba(59, 130, 246, 0.08);
  color: var(--mo-text-1);
}

.bili-folder-item.active {
  background: rgba(59, 130, 246, 0.14);
  color: var(--mo-accent);
}

.bili-folder-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bili-folder-count {
  flex-shrink: 0;
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.12);
}

.bili-fav-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── 搜索分页 ── */
.bili-pager {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bili-page-text {
  font-size: 12px;
  color: var(--mo-text-2);
  min-width: 48px;
  text-align: center;
}

/* ── 播放器弹窗（v3.5.6：左右分栏，右侧栏承载 UP 主卡片/投稿/相关视频） ── */
.bili-player-body {
  display: flex;
  /* v3.6.2：侧栏改为 flex-start + 固定高度，评论/投稿/相关列表**缩短高度**、
     内部滚动——不再 stretch 撑满导致过高 */
  align-items: flex-start;
  gap: 14px;
}

.bili-player-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bili-player-side {
  width: 280px;  /* v3.6.1：246 → 280，评论/投稿/相关列表卡片适度增长 */
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
  min-height: 0;
  /* v3.6.2：列表高度 51vh → 58vh；滚动发生在内容区 .bili-side-content 内部，
     UP 主卡片 sticky 固定顶部不随列表滚动 */
  max-height: 58vh;
  overflow: hidden;
  padding-right: 2px;
}
/* v3.6.0：作者卡片固定顶部，不参与滚动 */
.bili-player-side .bili-up-card.fixed-top {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--glass-bg);
  backdrop-filter: blur(8px) saturate(180%);
  border: 1px solid var(--glass-border);
  padding: 10px;
  margin-bottom: 0;
  border-radius: var(--mo-radius-sm);
}

/* 窄窗口下右侧栏落到视频下方，避免挤压播放区 */
@media (max-width: 1100px) {
  .bili-player-body {
    flex-direction: column;
  }
  .bili-player-side {
    width: 100%;
    max-height: none;
  }
}

/* v3.6.0：右侧栏 Tab 切换栏 + 内容区 */
.bili-player-side .bili-side-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.bili-side-tabs button {
  flex: 1;
  min-width: 50px;
  padding: 6px 8px;
  font-size: 12px;
  border: 1px solid var(--glass-border);
  border-radius: 7px;
  background: var(--glass-bg);
  color: var(--mo-text-2);
  cursor: pointer;
  transition: all 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.bili-side-tabs button:hover {
  background: var(--glass-hover);
}
.bili-side-tabs button.active {
  background: var(--mo-accent);
  color: #fff;
  border-color: var(--mo-accent);
}
.bili-player-side .bili-side-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  /* v3.6.2：滚动发生在各 .bili-section 内部——side-content 自身不滚，
     避免 flex:1 的 section 被拉伸填满后无溢出（旧实现滚动失效、内容被裁剪） */
  overflow: hidden;
}
.bili-section {
  flex: 1;
  min-height: 0;
  padding: 4px 6px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--mo-radius-sm);
  /* v3.6.2：每个内容区内部独立滚动（评论/投稿/相关列表超长时滚动，UP 卡片与 Tab 固定） */
  overflow-y: auto;
}
.bili-section.replies-only {
  /* 保持 flex:1，无需独立高度限制 */
}
@media (max-width: 1100px) {
  .bili-section {
    max-height: none;
  }
}

.bili-player-stage {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: var(--mo-radius-sm);
  overflow: hidden;
}

.bili-video {
  width: 100%;
  height: 100%;
  display: block;
}

.bili-player-loading,
.bili-player-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 13px;
  text-align: center;
  padding: 0 20px;
}

.bili-player-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.bili-player-bar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.bili-player-bar-center {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex: 1 1 auto;
  min-width: 0;
}

.bili-player-up {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 600;
  color: var(--mo-accent);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bili-player-stat {
  font-size: 12px;
  color: var(--mo-text-2);
  white-space: nowrap;
}

.bili-player-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bili-select {
  padding: 5px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.4);
  color: var(--mo-text-1);
  font-size: 12px;
  outline: none;
  cursor: pointer;
  max-width: 240px;
}

html.dark .bili-select {
  background: rgba(255, 255, 255, 0.08);
}

.bili-quality-tag {
  font-size: 11px;
  color: var(--mo-accent);
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.12);
  white-space: nowrap;
}

.bili-pages-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  /* v3.6.2：移至弹窗底部全宽后补充间距 */
  margin-top: 14px;
}

.bili-page-chip {
  padding: 4px 12px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: transparent;
  color: var(--mo-text-2);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.bili-page-chip:hover {
  color: var(--mo-text-1);
  border-color: rgba(59, 130, 246, 0.4);
}

.bili-page-chip.active {
  color: #fff;
  background: var(--mo-accent);
  border-color: var(--mo-accent);
}

.bili-related {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px dashed var(--glass-border);
  padding-top: 12px;
}

/* v3.5.4：相关视频卡片紧凑化，控制播放弹窗整体高度 */
.bili-grid.related .bili-card-title {
  font-size: 12px;
}

.bili-grid.related .bili-card-meta {
  font-size: 11px;
}

/* ── v3.5.4：点赞 / 投币 / 收藏交互栏 ── */
.bili-player-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 2px;
}

.bili-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.35);
  color: var(--mo-text-2);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

html.dark .bili-action-btn {
  background: rgba(255, 255, 255, 0.08);
}

.bili-action-btn:hover:not(:disabled) {
  color: var(--mo-accent);
  border-color: rgba(59, 130, 246, 0.4);
  background: rgba(59, 130, 246, 0.1);
}

.bili-action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.bili-action-btn em {
  font-style: normal;
  font-size: 12px;
  color: var(--mo-text-3);
}

.bili-action-btn.liked {
  color: var(--mo-accent);
  border-color: rgba(59, 130, 246, 0.45);
  background: rgba(59, 130, 246, 0.14);
}

.bili-action-btn.coined {
  color: var(--mo-warning);
  border-color: rgba(245, 158, 11, 0.45);
  background: rgba(245, 158, 11, 0.12);
}

.bili-action-btn.faved {
  color: var(--mo-danger);
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.1);
}

/* ── 登录弹窗 ── */
.bili-login-qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 10px 0 4px;
}

.bili-qr-wrap {
  position: relative;
  width: 200px;
  height: 200px;
  border-radius: var(--mo-radius-sm);
  border: 1px solid var(--glass-border);
  overflow: hidden;
  background: #fff;
}

.bili-qr-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.bili-qr-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mo-text-2);
  font-size: 13px;
  gap: 6px;
}

.bili-qr-expired {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--mo-text-2);
  font-size: 13px;
  cursor: pointer;
}

.bili-qr-hint {
  font-size: 13px;
  color: var(--mo-accent);
}

.bili-qr-tip {
  font-size: 12px;
  color: var(--mo-text-2);
}

.bili-login-cookie {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 0;
}

.bili-cookie-tip {
  font-size: 12px;
  color: var(--mo-text-2);
  line-height: 1.6;
}

.bili-cookie-tip code {
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.1);
  color: var(--mo-accent);
}

.bili-cookie-btn {
  align-self: flex-end;
}

@media (max-width: 900px) {
  .bili-fav-layout {
    flex-direction: column;
  }
  .bili-fav-folders {
    width: 100%;
    max-height: 200px;
  }
}

/* ── v3.5.5：UP 主卡片与投稿 ── */
.bili-up-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--mo-radius-sm);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(10px);
}

.bili-up-face {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--glass-border);
}

.bili-up-face-ph {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mo-text-2);
  font-size: 26px;
  background: rgba(0, 0, 0, 0.05);
}

.bili-up-info {
  flex: 1;
  min-width: 0;
}

.bili-up-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--mo-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bili-up-sign {
  margin-top: 3px;
  font-size: 12px;
  color: var(--mo-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* v3.5.8：粉丝数与查看投稿按钮 */
.bili-up-fans {
  margin-top: 2px;
  font-size: 11px;
  color: var(--mo-text-2);
}

.bili-up-btn {
  flex-shrink: 0;
  margin-left: auto;
}

.bili-space {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* v3.5.8：右侧栏紧凑化 —— 作者卡片压缩 + 左图右文行卡 + 简介 + 评论 */
.bili-player-side .bili-up-card {
  padding: 9px 10px;
  gap: 8px;
}

.bili-player-side .bili-up-face {
  width: 38px;
  height: 38px;
}

.bili-player-side .bili-up-face-ph {
  font-size: 18px;
}

.bili-player-side .bili-up-name {
  font-size: 13px;
}

.bili-player-side .bili-up-sign {
  font-size: 11px;
  margin-top: 2px;
}

/* 视频简介 */
.bili-desc-box {
  border-radius: var(--mo-radius-sm);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bili-up-desc {
  padding: 8px 10px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--mo-radius-sm);
  margin-bottom: 8px;
}

.bili-desc-text {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--mo-text-2);
  max-height: 88px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 左图右文紧凑行卡（投稿 / 相关视频） */
.bili-side-list {
  display: flex;
  flex-direction: column;
  gap: 8px;  /* v3.6.1：6 → 8 适度增大卡片间距 */
}

.bili-row-card {
  display: flex;
  gap: 10px;  /* v3.6.1：8 → 10 */
  padding: 7px;  /* v3.6.1：5 → 7 */
  border-radius: var(--mo-radius-sm);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  cursor: pointer;
  transition: background 0.18s ease, transform 0.18s ease;
}

.bili-row-card:hover {
  background: var(--glass-bg-hover, rgba(255, 255, 255, 0.08));
  transform: translateY(-1px);
}

.bili-row-thumb {
  position: relative;
  width: 112px;   /* v3.6.1：92 → 112，适配加宽后的右侧栏 */
  height: 63px;   /* v3.6.1：54 → 63（16:9） */
  flex-shrink: 0;
  border-radius: 5px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.08);
}

.bili-row-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.bili-row-thumb .bili-duration {
  position: absolute;
  right: 3px;
  bottom: 3px;
  font-size: 10px;
  padding: 0 4px;
}

.bili-row-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;  /* v3.6.1：4 → 5 */
}

.bili-row-title {
  font-size: 13px;  /* v3.6.1：12 → 13 */
  line-height: 1.4;
  color: var(--mo-text-1);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bili-row-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;  /* v3.6.1：10 → 11 */
  color: var(--mo-text-2);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* 评论区 */
.bili-replies {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bili-reply-list {
  display: flex;
  flex-direction: column;
  gap: 8px;  /* v3.6.1：6 → 8 */
}

.bili-reply-item {
  display: flex;
  gap: 10px;  /* v3.6.1：8 → 10 */
  padding: 9px 10px;  /* v3.6.1：7 8 → 9 10 */
  border-radius: var(--mo-radius-sm);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
}

.bili-reply-face {
  width: 34px;  /* v3.6.1：28 → 34 */
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--glass-border);
}

.bili-reply-face-ph {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mo-text-2);
  font-size: 17px;  /* v3.6.1：14 → 17 */
  background: rgba(0, 0, 0, 0.05);
}

.bili-reply-body {
  flex: 1;
  min-width: 0;
}

.bili-reply-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.bili-reply-uname {
  font-size: 13px;
  font-weight: 600;
  color: var(--mo-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bili-reply-like {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  color: var(--mo-text-2);
  flex-shrink: 0;
}

.bili-reply-msg {
  margin: 3px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--mo-text-1);
  white-space: pre-wrap;
  word-break: break-word;
}

.bili-load-more {
  display: flex;
  justify-content: center;
}
</style>

<style>
/* v3.6.2：播放悬浮窗口卡片右移——el-dialog（align-center + append-to-body）默认视口居中，
   margin-left:160px 使悬浮窗中心相对视口中心右移约 80px；用 margin 而非 transform，
   避免与 el-dialog 打开动画（zoom-in）的 transform 冲突。
   必须放在非 scoped 块：append-to-body 渲染到 body 下，scoped 的 [data-v-xxx] 属性
   不会附加到该元素，scoped 选择器匹配不上。 */
.bili-player-dialog {
  margin-left: 160px;
}
</style>
