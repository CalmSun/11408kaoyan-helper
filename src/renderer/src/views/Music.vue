<template>
  <div class="music-page">
    <div class="music-header">
      <h2 class="page-title">
        <el-icon><Headset /></el-icon>
        音乐播放
      </h2>
      <div class="music-actions">
        <!-- v2.9.2：网易云登录状态 -->
        <div v-if="music.neteaseLoggedIn && music.neteaseUser" class="netease-user">
          <img :src="music.neteaseUser.avatar" class="netease-avatar" />
          <span class="netease-nickname">{{ music.neteaseUser.nickname }}</span>
          <el-button size="small" text @click="handleLogout">退出</el-button>
        </div>
        <el-button v-else size="small" type="success" @click="showLoginDialog = true">
          <el-icon><User /></el-icon> 网易云登录
        </el-button>
        <el-button size="small" @click="music.pickFolder()">
          <el-icon><FolderOpened /></el-icon> 选择文件夹
        </el-button>
        <el-button size="small" @click="music.pickFiles()">
          <el-icon><Document /></el-icon> 选择文件
        </el-button>
        <el-button size="small" type="danger" plain :disabled="!music.hasMusic" @click="music.clearPlaylist()">
          <el-icon><Delete /></el-icon> 清空列表
        </el-button>
      </div>
    </div>

    <div class="music-body">
      <!-- 左侧：播放器 + 歌词 -->
      <div class="music-player-col">
        <div class="glass-card player-card">
          <!-- 封面/信息 -->
          <div class="player-cover">
            <img v-if="currentCover" :src="currentCover" alt="cover" class="cover-img" :class="{ spinning: music.isPlaying }" />
            <div v-else class="cover-placeholder">
              <el-icon :size="64"><Headset /></el-icon>
            </div>
          </div>
          <div class="player-info">
            <div class="track-name">{{ music.currentTrack?.name || '未选择歌曲' }}</div>
            <div class="track-meta" v-if="music.currentTrack?.artist || music.currentTrack?.album">
              {{ music.currentTrack?.artist || '' }}
              <span v-if="music.currentTrack?.artist && music.currentTrack?.album"> · </span>
              {{ music.currentTrack?.album || '' }}
            </div>
            <div class="track-source" v-if="music.currentTrack">
              <el-tag size="small" :type="music.currentTrack.source === 'online' ? 'success' : 'info'">
                {{ music.currentTrack.source === 'online' ? '网易云在线' : '本地文件' }}
              </el-tag>
            </div>
          </div>

          <!-- 进度条 -->
          <div class="progress-section">
            <span class="time-label">{{ formatTime(music.currentTime) }}</span>
            <el-slider
              :model-value="progressValue"
              :min="0"
              :max="music.duration || 100"
              :step="0.1"
              :show-tooltip="false"
              class="progress-slider"
              @input="handleProgressInput"
              @change="handleProgressChange"
            />
            <span class="time-label">{{ formatTime(music.duration) }}</span>
          </div>

          <!-- 控制按钮 -->
          <div class="player-controls">
            <button class="ctrl-btn" :class="{ active: music.shuffle }" title="随机播放" @click="music.toggleShuffle()">
              <el-icon><Sort /></el-icon>
            </button>
            <button class="ctrl-btn" title="上一首" @click="music.prev()">
              <el-icon><DArrowLeft /></el-icon>
            </button>
            <button class="ctrl-btn play-btn" :title="music.isPlaying ? '暂停' : '播放'" @click="music.toggle()">
              <el-icon v-if="!music.isPlaying"><VideoPlay /></el-icon>
              <el-icon v-else><VideoPause /></el-icon>
            </button>
            <button class="ctrl-btn" title="下一首" @click="music.next()">
              <el-icon><DArrowRight /></el-icon>
            </button>
            <!-- v3.1.6：喜欢按钮 -->
            <button
              class="ctrl-btn like-btn"
              :class="{ active: music.currentLiked }"
              :title="music.currentLiked ? '取消喜欢' : '喜欢该音乐'"
              :disabled="!music.currentTrack?.id"
              @click="handleToggleLike"
            >
              <el-icon><StarFilled /></el-icon>
            </button>
          </div>
        </div>

        <!-- 歌词区 -->
        <div class="glass-card lyrics-card">
          <h3 class="section-title">歌词</h3>
          <div class="lyrics-container" ref="lyricsContainer">
            <div v-if="music.lyricLines.length === 0" class="lyrics-empty">
              暂无歌词<br />
              <span class="lyrics-hint">本地歌曲需同目录 .lrc 文件</span>
            </div>
            <div
              v-for="(line, i) in music.lyricLines"
              :key="i"
              class="lyric-line"
              :class="{ active: i === music.currentLyricIndex }"
              :ref="el => { if (i === music.currentLyricIndex && el) scrollToLyric(el as HTMLElement) }"
            >
              {{ line.text }}
            </div>
          </div>
        </div>

        <!-- v3.1.8：热门评论卡片 -->
        <div class="glass-card hot-comment-card" v-if="music.currentTrack?.source === 'online'">
          <h3 class="section-title">
            <el-icon><ChatDotRound /></el-icon>
            热门评论
            <el-button size="small" text style="margin-left: auto" @click="openCommentsDialog" v-if="music.currentHotComment">
              查看全部评论
            </el-button>
          </h3>
          <div v-if="music.commentsLoading" class="search-loading">
            <el-icon class="is-loading"><Loading /></el-icon> 加载中...
          </div>
          <div v-else-if="music.currentHotComment" class="hot-comment-item">
            <img v-if="music.currentHotComment.avatar" :src="music.currentHotComment.avatar" class="comment-avatar" />
            <div v-else class="comment-avatar placeholder"><el-icon><User /></el-icon></div>
            <div class="comment-body">
              <div class="comment-header">
                <span class="comment-nickname">{{ music.currentHotComment.nickname }}</span>
                <!-- v3.2.0：热门评论点赞按钮 -->
                <button
                  class="comment-like-btn"
                  :class="{ liked: music.isCommentLiked(music.currentHotComment.commentId) }"
                  :disabled="music.likingCommentId === music.currentHotComment.commentId"
                  @click="handleCommentLike(music.currentHotComment)"
                  title="点赞"
                >
                  <el-icon v-if="music.isCommentLiked(music.currentHotComment.commentId)"><StarFilled /></el-icon>
                  <el-icon v-else><Star /></el-icon>
                  <span v-if="music.currentHotComment.likedCount > 0" class="comment-like-count">{{ music.currentHotComment.likedCount }}</span>
                </button>
              </div>
              <div class="comment-content">{{ music.currentHotComment.content }}</div>
              <div class="comment-reply" v-if="music.currentHotComment.repliedContent">
                <span class="reply-arrow">↳</span>
                <span class="reply-user">{{ music.currentHotComment.repliedNickname }}：</span>
                <span>{{ music.currentHotComment.repliedContent }}</span>
              </div>
              <div class="comment-time">{{ formatCommentTime(music.currentHotComment.time) }}</div>
            </div>
          </div>
          <div v-else class="search-empty">
            暂无热门评论
          </div>
        </div>
      </div>

      <!-- 右侧：搜索 + 我的歌单 + 播放列表 -->
      <div class="music-list-col">
        <!-- v3.1.5：Tab 切换（v3.2.2：原热搜移到搜索卡片内，新增云盘 Tab） -->
        <div class="music-tabs">
          <button class="music-tab" :class="{ active: neteaseTab === 'search' }" @click="neteaseTab = 'search'">
            <el-icon><Search /></el-icon> 搜索
          </button>
          <button class="music-tab" :class="{ active: neteaseTab === 'playlists' }" @click="neteaseTab = 'playlists'; onPlaylistTab()">
            <el-icon><List /></el-icon> 歌单
          </button>
          <button class="music-tab" :class="{ active: neteaseTab === 'clouddrive' }" @click="neteaseTab = 'clouddrive'; onCloudDriveTab()">
            <el-icon><Folder /></el-icon> 云盘
          </button>
          <button class="music-tab" :class="{ active: neteaseTab === 'toplist' }" @click="neteaseTab = 'toplist'; onToplistTab()">
            <el-icon><Trophy /></el-icon> 排行榜
          </button>
        </div>

        <!-- 网易云搜索（v3.2.2：热搜榜列表置于搜索功能下方，同一张卡片） -->
        <div class="glass-card search-card" v-show="neteaseTab === 'search'">
          <h3 class="section-title">
            <el-icon><Search /></el-icon>
            网易云搜索
          </h3>
          <div class="search-input-row">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索歌曲、歌手..."
              clearable
              @keyup.enter="doSearch"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-button type="primary" :loading="music.searchLoading" @click="doSearch">搜索</el-button>
          </div>
          <div v-if="music.searchLoading" class="search-loading">
            <el-icon class="is-loading"><Loading /></el-icon> 搜索中...
          </div>
          <div v-else-if="music.searchResults.length > 0" class="search-results">
            <div
              v-for="song in music.searchResults"
              :key="song.id"
              class="search-item"
            >
              <img v-if="song.cover" :src="song.cover" class="song-cover" />
              <div v-else class="song-cover placeholder"><el-icon><Headset /></el-icon></div>
              <div class="song-info">
                <div class="song-name">{{ song.name }}</div>
                <div class="song-artist">{{ song.artist }} · {{ song.album }}</div>
              </div>
              <div class="song-actions">
                <el-button size="small" type="primary" circle @click="music.playOnlineSong(song)">
                  <el-icon><VideoPlay /></el-icon>
                </el-button>
                <el-button size="small" circle @click="music.addOnlineSong(song)">
                  <el-icon><Plus /></el-icon>
                </el-button>
                <el-button size="small" circle :type="music.isSongLiked(song.id) ? 'danger' : 'default'" @click="handleSongLike(song)">
                  <el-icon><StarFilled v-if="music.isSongLiked(song.id)" /><Star v-else /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
          <div v-else-if="music.searchKeyword" class="search-empty">
            未找到相关歌曲
          </div>

          <!-- v3.2.2：热搜榜列表（在搜索卡片内，搜索功能下方） -->
          <div class="hotsearch-inline">
            <h4 class="subsection-title">
              <el-icon><TrendCharts /></el-icon>
              热搜榜
              <el-button size="small" text @click="music.fetchHotSearch()" :loading="music.hotSearchLoading" style="margin-left: auto">
                刷新
              </el-button>
            </h4>
            <div v-if="music.hotSearchLoading && music.hotSearchList.length === 0" class="search-loading">
              <el-icon class="is-loading"><Loading /></el-icon> 加载中...
            </div>
            <div v-else-if="music.hotSearchList.length > 0" class="hotsearch-list">
              <div
                v-for="item in music.hotSearchList"
                :key="item.rank"
                class="hotsearch-item"
                @click="searchFromHot(item.keyword)"
              >
                <span class="hotsearch-rank" :class="{ 'top3': item.rank <= 3 }">{{ item.rank }}</span>
                <div class="hotsearch-info">
                  <div class="hotsearch-keyword">{{ item.keyword }}</div>
                </div>
                <el-icon class="hotsearch-icon" v-if="item.iconUrl"><img :src="item.iconUrl" class="hotsearch-badge" /></el-icon>
              </div>
            </div>
            <div v-else class="search-empty">
              暂无热搜数据，请点击刷新重试
            </div>
          </div>
        </div>

        <!-- v3.2.2：云盘歌曲列表（替代原热搜显示区域） -->
        <div class="glass-card clouddrive-card" v-show="neteaseTab === 'clouddrive'">
          <h3 class="section-title">
            <el-icon><Folder /></el-icon>
            云盘歌曲
            <span v-if="music.cloudDriveCount" class="playlist-count">{{ music.cloudDriveCount }} 首</span>
            <el-button size="small" text @click="music.fetchCloudDrive()" :loading="music.cloudDriveLoading" style="margin-left: auto">
              刷新
            </el-button>
          </h3>

          <!-- 未登录提示 -->
          <div v-if="!music.neteaseLoggedIn" class="playlist-empty">
            请先登录网易云账号以查看云盘歌曲<br />
            <el-button size="small" type="primary" @click="showLoginDialog = true" style="margin-top: 10px">
              去登录
            </el-button>
          </div>

          <!-- 云盘歌曲列表 -->
          <div v-else>
            <div class="playlist-detail-actions" v-if="music.cloudDriveList.length">
              <el-button size="small" type="primary" :loading="music.cloudDriveLoading" @click="music.playPlaylist(music.cloudDriveList)">
                <el-icon><VideoPlay /></el-icon> 播放全部
              </el-button>
              <el-button size="small" :loading="music.cloudDriveLoading" @click="music.addPlaylistToQueue(music.cloudDriveList)">
                <el-icon><Plus /></el-icon> 添加到队列
              </el-button>
            </div>
            <div v-if="music.cloudDriveLoading && music.cloudDriveList.length === 0" class="search-loading">
              <el-icon class="is-loading"><Loading /></el-icon> 加载中...
            </div>
            <div v-else-if="music.cloudDriveList.length > 0" class="playlist-tracks">
              <div
                v-for="(track, i) in music.cloudDriveList"
                :key="track.id"
                class="search-item"
              >
                <span class="item-index">{{ i + 1 }}</span>
                <img v-if="track.cover" :src="track.cover" class="song-cover" />
                <div v-else class="song-cover placeholder"><el-icon><Headset /></el-icon></div>
                <div class="song-info">
                  <div class="song-name">{{ track.name }}</div>
                  <div class="song-artist">{{ track.artist }} · {{ track.album }}</div>
                </div>
                <div class="song-actions">
                  <el-button size="small" type="primary" circle @click="music.playOnlineSong(track)">
                    <el-icon><VideoPlay /></el-icon>
                  </el-button>
                  <el-button size="small" circle @click="music.addOnlineSong(track)">
                    <el-icon><Plus /></el-icon>
                  </el-button>
                  <el-button size="small" circle :type="music.isSongLiked(track.id) ? 'danger' : 'default'" @click="handleSongLike(track)">
                    <el-icon><StarFilled v-if="music.isSongLiked(track.id)" /><Star v-else /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>
            <div v-else class="search-empty">
              暂无云盘歌曲
            </div>
          </div>
        </div>

        <!-- v3.1.5：排行榜 -->
        <div class="glass-card toplist-card" v-show="neteaseTab === 'toplist'">
          <h3 class="section-title">
            <el-icon><Trophy /></el-icon>
            排行榜
            <el-button size="small" text @click="music.fetchToplist()" :loading="music.toplistLoading" style="margin-left: auto">
              刷新
            </el-button>
          </h3>

          <!-- 排行榜列表 -->
          <div v-if="!viewingToplistId">
            <div v-if="music.toplistLoading && music.toplistList.length === 0" class="search-loading">
              <el-icon class="is-loading"><Loading /></el-icon> 加载中...
            </div>
            <div v-else-if="music.toplistList.length > 0" class="toplist-list">
              <div
                v-for="list in music.toplistList"
                :key="list.id"
                class="toplist-item"
                @click="openToplistDetail(list.id)"
              >
                <img v-if="list.cover" :src="list.cover" class="toplist-cover" />
                <div v-else class="toplist-cover placeholder"><el-icon :size="24"><Trophy /></el-icon></div>
                <div class="toplist-info">
                  <div class="toplist-name">{{ list.name }}</div>
                  <div class="toplist-update">{{ list.updateFrequency }}</div>
                  <div class="toplist-preview">
                    <span v-for="(t, i) in list.topTracks" :key="i" class="toplist-track-preview">
                      {{ i + 1 }}.{{ t.name }} - {{ t.artist }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="search-empty">
              暂无排行榜数据，请点击刷新重试
            </div>
          </div>

          <!-- 排行榜详情（歌曲列表） -->
          <div v-else class="playlist-detail">
            <div class="playlist-detail-header">
              <el-button size="small" text @click="viewingToplistId = 0">
                <el-icon><DArrowLeft /></el-icon> 返回排行榜
              </el-button>
              <span class="playlist-detail-name">{{ music.currentToplistInfo?.name }}</span>
            </div>
            <div class="playlist-detail-actions">
              <el-button size="small" type="primary" :loading="music.toplistDetailLoading" @click="music.playPlaylist(music.currentToplistDetail)">
                <el-icon><VideoPlay /></el-icon> 播放全部
              </el-button>
              <el-button size="small" :loading="music.toplistDetailLoading" @click="music.addPlaylistToQueue(music.currentToplistDetail)">
                <el-icon><Plus /></el-icon> 添加到队列
              </el-button>
            </div>
            <div class="playlist-tracks">
              <div v-if="music.toplistDetailLoading" class="search-loading">
                <el-icon class="is-loading"><Loading /></el-icon> 加载中...
              </div>
              <div
                v-for="(track, i) in music.currentToplistDetail"
                :key="track.id"
                class="search-item"
              >
                <span class="item-index">{{ i + 1 }}</span>
                <div class="song-info">
                  <div class="song-name">{{ track.name }}</div>
                  <div class="song-artist">{{ track.artist }} · {{ track.album }}</div>
                </div>
                <div class="song-actions">
                  <el-button size="small" type="primary" circle @click="music.playOnlineSong(track)">
                    <el-icon><VideoPlay /></el-icon>
                  </el-button>
                  <el-button size="small" circle @click="music.addOnlineSong(track)">
                    <el-icon><Plus /></el-icon>
                  </el-button>
                  <el-button size="small" circle :type="music.isSongLiked(track.id) ? 'danger' : 'default'" @click="handleSongLike(track)">
                    <el-icon><StarFilled v-if="music.isSongLiked(track.id)" /><Star v-else /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- v2.9.2：我的歌单 -->
        <div class="glass-card playlist-card" v-show="neteaseTab === 'playlists'">
          <h3 class="section-title">
            <el-icon><List /></el-icon>
            我的歌单
            <span v-if="music.userPlaylists.length" class="playlist-count">{{ music.userPlaylists.length }} 个</span>
          </h3>

          <!-- 未登录提示 -->
          <div v-if="!music.neteaseLoggedIn" class="playlist-empty">
            请先登录网易云账号以同步歌单<br />
            <el-button size="small" type="primary" @click="showLoginDialog = true" style="margin-top: 10px">
              去登录
            </el-button>
          </div>

          <!-- 歌单列表（网格） -->
          <div v-else-if="!viewingPlaylistId" class="user-playlists-grid">
            <div
              v-for="pl in music.userPlaylists"
              :key="pl.id"
              class="playlist-grid-item"
              @click="openPlaylist(pl.id)"
            >
              <img v-if="pl.cover" :src="pl.cover" class="playlist-cover" />
              <div v-else class="playlist-cover placeholder"><el-icon :size="32"><FolderOpened /></el-icon></div>
              <div class="playlist-grid-name" :title="pl.name">{{ pl.name }}</div>
              <div class="playlist-grid-meta">{{ pl.trackCount }} 首</div>
            </div>
          </div>

          <!-- 歌单详情（歌曲列表） -->
          <div v-else class="playlist-detail">
            <div class="playlist-detail-header">
              <el-button size="small" text @click="viewingPlaylistId = 0">
                <el-icon><DArrowLeft /></el-icon> 返回歌单列表
              </el-button>
              <span class="playlist-detail-name">{{ music.currentPlaylistInfo?.name }}</span>
            </div>
            <div class="playlist-detail-actions">
              <el-button size="small" type="primary" :loading="music.playlistLoading" @click="music.playPlaylist(music.currentPlaylistTracks)">
                <el-icon><VideoPlay /></el-icon> 播放全部
              </el-button>
              <el-button size="small" :loading="music.playlistLoading" @click="music.addPlaylistToQueue(music.currentPlaylistTracks)">
                <el-icon><Plus /></el-icon> 添加到队列
              </el-button>
            </div>
            <div class="playlist-tracks">
              <div v-if="music.playlistLoading" class="search-loading">
                <el-icon class="is-loading"><Loading /></el-icon> 加载中...
              </div>
              <div
                v-for="(track, i) in music.currentPlaylistTracks"
                :key="track.id"
                class="search-item"
              >
                <span class="item-index">{{ i + 1 }}</span>
                <div class="song-info">
                  <div class="song-name">{{ track.name }}</div>
                  <div class="song-artist">{{ track.artist }} · {{ track.album }}</div>
                </div>
                <div class="song-actions">
                  <el-button size="small" type="primary" circle @click="music.playOnlineSong(track)">
                    <el-icon><VideoPlay /></el-icon>
                  </el-button>
                  <el-button size="small" circle @click="music.addOnlineSong(track)">
                    <el-icon><Plus /></el-icon>
                  </el-button>
                  <el-button size="small" circle :type="music.isSongLiked(track.id) ? 'danger' : 'default'" @click="handleSongLike(track)">
                    <el-icon><StarFilled v-if="music.isSongLiked(track.id)" /><Star v-else /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 播放列表 -->
        <div class="glass-card playlist-card">
          <h3 class="section-title">
            <el-icon><List /></el-icon>
            播放列表
            <span class="playlist-count">{{ music.playlist.length }} 首</span>
          </h3>
          <div class="playlist-container">
            <div v-if="music.playlist.length === 0" class="playlist-empty">
              播放列表为空，请选择本地文件或搜索在线歌曲
            </div>
            <div
              v-for="(track, i) in music.playlist"
              :key="i"
              class="playlist-item"
              :class="{ active: i === music.currentIndex }"
              @click="music.playIndex(i)"
            >
              <span class="item-index">{{ i + 1 }}</span>
              <div class="item-info">
                <div class="item-name">{{ track.name }}</div>
                <div class="item-meta" v-if="track.artist || track.source === 'online'">
                  {{ track.artist || '' }}
                  <el-tag v-if="track.source === 'online'" size="small" type="success" class="source-tag">在线</el-tag>
                </div>
              </div>
              <button class="item-remove" title="移除" @click.stop="music.removeTrack(i)">
                <el-icon><Close /></el-icon>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- v3.1.0：网易云登录对话框（v3.1.9 增加扫码/手机号登录） -->
    <el-dialog v-model="showLoginDialog" title="网易云音乐登录" width="480px" :close-on-click-modal="false">
      <el-tabs v-model="loginTab" class="login-tabs">
        <!-- 扫码登录 -->
        <el-tab-pane label="扫码登录" name="qr">
          <div class="qr-login-box">
            <div v-if="music.qrImage" class="qr-image-box">
              <img :src="music.qrImage" alt="二维码" class="qr-image" />
              <div class="qr-status" :class="{ 'success': music.qrStatus === 803, 'expired': music.qrStatus === 800 }">
                {{ qrStatusText }}
              </div>
            </div>
            <div v-else class="qr-placeholder">
              <el-button type="primary" @click="startQrLogin">获取二维码</el-button>
            </div>
            <div class="qr-tip">
              <el-icon><InfoFilled /></el-icon>
              <span>使用网易云音乐 App 扫描上方二维码登录</span>
            </div>
          </div>
        </el-tab-pane>

        <!-- 手机号登录 -->
        <el-tab-pane label="手机号登录" name="phone">
          <div class="phone-login-box">
            <el-input v-model="phoneInput" placeholder="手机号" maxlength="11" clearable>
              <template #prepend>
                <el-select v-model="countrycode" style="width: 70px">
                  <el-option label="+86" value="86" />
                </el-select>
              </template>
            </el-input>
            <el-input v-model="phonePassword" type="password" placeholder="密码" show-password @keyup.enter="handlePhoneLogin" />
            <el-button type="primary" :loading="phoneLogging" @click="handlePhoneLogin" style="width: 100%">
              登录
            </el-button>
          </div>
        </el-tab-pane>

        <!-- Cookie 登录 -->
        <el-tab-pane label="Cookie 登录" name="cookie">
          <div class="cookie-login-box">
            <div class="cookie-tip">
              <el-icon><InfoFilled /></el-icon>
              <span>请从浏览器登录 <b>music.163.com</b> 后，按 F12 打开开发者工具，在 Application → Cookies 中复制全部 Cookie 粘贴到下方。</span>
            </div>
            <el-input
              v-model="cookieInput"
              type="textarea"
              :rows="5"
              placeholder="粘贴网易云 Cookie，例如：MUSIC_U=xxx; __csrf=xxx; NMTID=xxx; ..."
              resize="vertical"
            />
            <div class="cookie-actions">
              <el-button type="primary" :loading="cookieLogging" @click="handleCookieLogin">
                登录
              </el-button>
              <el-button @click="showLoginDialog = false">取消</el-button>
            </div>
            <div class="cookie-help">
              <details>
                <summary>如何获取 Cookie？</summary>
                <ol>
                  <li>在浏览器中打开 <b>https://music.163.com</b> 并登录账号</li>
                  <li>按 F12 打开开发者工具，切换到 Application（应用）标签</li>
                  <li>左侧找到 Cookies → https://music.163.com</li>
                  <li>全选所有 Cookie 行，复制 Name 和 Value，格式为 <code>key=value; key2=value2</code></li>
                  <li>粘贴到上方输入框，点击登录</li>
                </ol>
              </details>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <!-- v3.1.8：歌曲评论对话框 -->
    <el-dialog v-model="showCommentsDialog" :title="`歌曲评论（${music.commentsTotal} 条）`" width="640px" :close-on-click-modal="true" class="comments-dialog">
      <div class="comments-toolbar">
        <el-radio-group v-model="commentsSortType" @change="(v: number) => switchCommentSort(v)">
          <el-radio-button :value="2">最热</el-radio-button>
          <el-radio-button :value="1">最新</el-radio-button>
        </el-radio-group>
      </div>
      <div v-if="music.commentsLoading && music.songComments.length === 0" class="search-loading">
        <el-icon class="is-loading"><Loading /></el-icon> 加载中...
      </div>
      <div v-else-if="music.songComments.length > 0" class="comments-list">
        <div v-for="c in music.songComments" :key="c.commentId" class="comment-item">
          <img v-if="c.avatar" :src="c.avatar" class="comment-avatar" />
          <div v-else class="comment-avatar placeholder"><el-icon><User /></el-icon></div>
          <div class="comment-body">
            <div class="comment-header">
              <span class="comment-nickname">{{ c.nickname }}</span>
              <!-- v3.2.0：评论点赞按钮 -->
              <button
                class="comment-like-btn"
                :class="{ liked: music.isCommentLiked(c.commentId) }"
                :disabled="music.likingCommentId === c.commentId"
                @click="handleCommentLike(c)"
                title="点赞"
              >
                <el-icon v-if="music.isCommentLiked(c.commentId)"><StarFilled /></el-icon>
                <el-icon v-else><Star /></el-icon>
                <span v-if="c.likedCount > 0" class="comment-like-count">{{ c.likedCount }}</span>
              </button>
            </div>
            <div class="comment-content">{{ c.content }}</div>
            <div class="comment-reply" v-if="c.repliedContent">
              <span class="reply-arrow">↳</span>
              <span class="reply-user">{{ c.repliedNickname }}：</span>
              <span>{{ c.repliedContent }}</span>
            </div>
            <div class="comment-time">{{ formatCommentTime(c.time) }}</div>
          </div>
        </div>
      </div>
      <div v-else class="search-empty">
        暂无评论
      </div>
      <div class="comments-footer" v-if="music.songComments.length < music.commentsTotal">
        <el-button :loading="music.commentsLoading" @click="loadMoreComments">加载更多</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useMusicStore } from '@/stores/music'
import {
  Headset, FolderOpened, Document, Delete, Search,
  VideoPlay, VideoPause, DArrowLeft, DArrowRight, Sort, StarFilled, Star,
  List, Plus, Close, User, InfoFilled, Loading,
  TrendCharts, Trophy, ChatDotRound, Folder
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const music = useMusicStore()

const searchKeyword = ref('')
const progressValue = ref(0)
const lyricsContainer = ref<HTMLElement | null>(null)
const isDraggingProgress = ref(false) // v3.0.0：防止拖动时被 currentTime 覆盖

// v3.1.5：Tab 类型扩展（v3.2.2：原热搜 Tab 改为云盘）
const neteaseTab = ref<'search' | 'playlists' | 'clouddrive' | 'toplist'>('search')
const showLoginDialog = ref(false)
const cookieInput = ref('')
const cookieLogging = ref(false)
const viewingPlaylistId = ref(0)
const viewingToplistId = ref(0)

const currentCover = computed(() => music.currentTrack?.cover || '')

watch(() => music.currentTime, (t) => {
  if (!isDraggingProgress.value) {
    progressValue.value = t
  }
})

// v3.1.2：进度条拖动处理（修复无法调节问题）
function handleProgressInput(val: number | number[]) {
  const time = Array.isArray(val) ? val[0] : val
  isDraggingProgress.value = true
  progressValue.value = time
  music.seek(time)
}
function handleProgressChange() {
  isDraggingProgress.value = false
}

// v3.1.0：登录成功后关闭对话框
watch(() => music.neteaseLoggedIn, (logged) => {
  if (logged) {
    showLoginDialog.value = false
    stopQrPolling()
  }
})

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function doSearch() {
  const kw = searchKeyword.value.trim()
  if (!kw) return
  await music.searchOnline(kw, 30)
  // v3.1.8：搜索完成后批量检查喜欢状态
  if (music.searchResults.length) {
    music.checkSongsLiked(music.searchResults.map(s => s.id))
  }
}

function scrollToLyric(el: HTMLElement) {
  if (!lyricsContainer.value) return
  const container = lyricsContainer.value
  const elTop = el.offsetTop
  const containerHeight = container.clientHeight
  const targetScroll = elTop - containerHeight / 2 + el.clientHeight / 2
  container.scrollTo({ top: targetScroll, behavior: 'smooth' })
}

// ── v3.1.0：网易云 Cookie 登录 ──

async function handleCookieLogin() {
  const cookie = cookieInput.value.trim()
  if (!cookie) {
    ElMessage.warning('请输入 Cookie')
    return
  }
  cookieLogging.value = true
  try {
    const res = await music.setNeteaseCookie(cookie)
    if (res.success) {
      ElMessage.success(res.message)
      showLoginDialog.value = false
      cookieInput.value = ''
    } else {
      ElMessage.error(res.message)
    }
  } finally {
    cookieLogging.value = false
  }
}

// v3.1.9：扫码登录
const loginTab = ref<'qr' | 'phone' | 'cookie'>('qr')
let qrPollTimer: ReturnType<typeof setInterval> | null = null

const qrStatusText = computed(() => {
  switch (music.qrStatus) {
    case 801: return '等待扫码...'
    case 802: return '已扫码，请在手机上确认'
    case 803: return '登录成功！'
    case 800: return '二维码已过期，请重新获取'
    default: return ''
  }
})

async function startQrLogin() {
  await music.getQrKey()
  if (music.qrKey) {
    startQrPolling()
  }
}

function startQrPolling() {
  stopQrPolling()
  qrPollTimer = setInterval(async () => {
    const code = await music.checkQrLogin()
    if (code === 803 || code === 800) {
      stopQrPolling()
    }
  }, 2000)
}

function stopQrPolling() {
  if (qrPollTimer) {
    clearInterval(qrPollTimer)
    qrPollTimer = null
  }
}

// v3.1.9：手机号登录
const phoneInput = ref('')
const phonePassword = ref('')
const countrycode = ref('86')
const phoneLogging = ref(false)

async function handlePhoneLogin() {
  if (!phoneInput.value.trim()) {
    ElMessage.warning('请输入手机号')
    return
  }
  if (!phonePassword.value) {
    ElMessage.warning('请输入密码')
    return
  }
  phoneLogging.value = true
  try {
    const res = await music.loginPhone(phoneInput.value.trim(), phonePassword.value, countrycode.value)
    if (res.success) {
      ElMessage.success(res.message)
      showLoginDialog.value = false
      phoneInput.value = ''
      phonePassword.value = ''
    } else {
      ElMessage.error(res.message)
    }
  } finally {
    phoneLogging.value = false
  }
}

async function handleLogout() {
  await music.logoutNetease()
  ElMessage.success('已退出网易云登录')
}

// v2.9.2：切换到歌单 Tab 时加载
function onPlaylistTab() {
  if (music.neteaseLoggedIn && music.userPlaylists.length === 0) {
    music.fetchUserPlaylists()
  }
}

// v3.1.5：切换到热搜 Tab 时加载
function onHotSearchTab() {
  if (music.hotSearchList.length === 0) {
    music.fetchHotSearch()
  }
}

// v3.1.5：切换到排行榜 Tab 时加载
function onToplistTab() {
  if (music.toplistList.length === 0) {
    music.fetchToplist()
  }
}

// v3.2.2：切换到云盘 Tab 时加载
function onCloudDriveTab() {
  if (!music.neteaseLoggedIn) {
    ElMessage.warning('请先登录网易云账号以查看云盘')
    return
  }
  if (music.cloudDriveList.length === 0) {
    music.fetchCloudDrive()
  }
}

// v3.1.5：从热搜列表点击搜索
function searchFromHot(keyword: string) {
  searchKeyword.value = keyword
  neteaseTab.value = 'search'
  doSearch()
}

// v3.1.5：打开排行榜详情
async function openToplistDetail(id: number) {
  viewingToplistId.value = id
  await music.fetchToplistDetail(id)
  // v3.1.8：批量检查喜欢状态
  if (music.currentToplistDetail.length) {
    music.checkSongsLiked(music.currentToplistDetail.map(t => t.id))
  }
}

// v2.9.2：打开歌单详情
async function openPlaylist(id: number) {
  viewingPlaylistId.value = id
  await music.fetchPlaylistDetail(id)
  // v3.1.8：批量检查喜欢状态
  if (music.currentPlaylistTracks.length) {
    music.checkSongsLiked(music.currentPlaylistTracks.map(t => t.id))
  }
}

// v3.1.0：监听登录对话框显示
watch(showLoginDialog, (val) => {
  if (!val) {
    cookieInput.value = ''
  }
})

// ── v3.1.6：喜欢音乐 ──

async function handleToggleLike() {
  const track = music.currentTrack
  if (!track || !track.id) return
  const success = await music.toggleLikeSong(track.id)
  if (success) {
    ElMessage.success(music.currentLiked ? '已喜欢' : '已取消喜欢')
  } else {
    ElMessage.warning('操作失败，请检查是否已登录')
  }
}

// v3.1.8：列表项喜欢按钮
async function handleSongLike(song: { id: number; name: string }) {
  if (!song?.id) return
  if (!music.neteaseLoggedIn) {
    ElMessage.warning('请先登录网易云账号')
    showLoginDialog.value = true
    return
  }
  const wasLiked = music.isSongLiked(song.id)
  const success = await music.toggleSongLike(song.id)
  if (success) {
    ElMessage.success(wasLiked ? `已取消喜欢：${song.name}` : `已喜欢：${song.name}`)
  } else {
    ElMessage.warning('操作失败，请检查是否已登录')
  }
}

// v3.2.0：评论点赞
async function handleCommentLike(comment: { commentId: number; likedCount: number }) {
  if (!comment?.commentId) return
  if (!music.neteaseLoggedIn) {
    ElMessage.warning('请先登录网易云账号')
    showLoginDialog.value = true
    return
  }
  const wasLiked = music.isCommentLiked(comment.commentId)
  const success = await music.toggleCommentLike(comment.commentId, wasLiked)
  if (success) {
    ElMessage.success(wasLiked ? '已取消点赞' : '已点赞')
  } else {
    ElMessage.warning('点赞失败，请检查是否已登录')
  }
}

// 切换歌曲时检查喜欢状态 + 获取热门评论
watch(() => music.currentTrack?.id, (newId) => {
  if (newId && music.currentTrack?.source === 'online') {
    // v3.1.9：先重置喜欢状态，避免显示上一首的状态
    music.currentLiked = false
    music.checkSongLikeStatus(newId)
    music.fetchSongComments(newId, 1, 20, 1)
  } else {
    music.currentLiked = false
    music.clearComments()
  }
})

// ── v3.1.8：歌曲评论 ──

const showCommentsDialog = ref(false)
const commentsPage = ref(1)
const commentsSortType = ref(1) // 1=最新 2=最热

async function openCommentsDialog() {
  const track = music.currentTrack
  if (!track?.id) return
  showCommentsDialog.value = true
  commentsPage.value = 1
  commentsSortType.value = 2 // 默认看最热
  await music.fetchSongComments(track.id, 1, 20, 2)
}

async function loadMoreComments() {
  const track = music.currentTrack
  if (!track?.id) return
  commentsPage.value++
  await music.fetchSongComments(track.id, commentsPage.value, 20, commentsSortType.value)
}

async function switchCommentSort(type: number) {
  const track = music.currentTrack
  if (!track?.id) return
  commentsSortType.value = type
  commentsPage.value = 1
  await music.fetchSongComments(track.id, 1, 20, type)
}

function formatCommentTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

onMounted(() => {
  music.checkLoginStatus()
  // v3.2.2：热搜榜已内嵌到搜索卡片中，进入页面即预加载
  if (music.hotSearchList.length === 0) {
    music.fetchHotSearch()
  }
})

onUnmounted(() => {
  stopQrPolling()
})
</script>

<style scoped>
.music-page {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.music-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--mo-text-1);
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.music-actions {
  display: flex;
  gap: 8px;
}

.music-body {
  display: grid;
  grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
  gap: 16px;
  /* v3.2.2：固定左右卡片高度一致，对齐拉伸而非顶部对齐 */
  align-items: stretch;
}

/* v3.2.2：左右列都采用纵向 flex，保证子卡片高度可拉伸并均分 */
.music-player-col,
.music-list-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

/* v3.1.0：统一卡片样式，与其他页面保持一致 */
.glass-card {
  background: var(--mo-surface);
  border: 1px solid var(--mo-border);
  border-radius: var(--mo-radius);
  padding: 20px;
  backdrop-filter: var(--glass-filter, blur(12px));
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* v3.1.2：播放器卡片限制最大宽度，避免过宽 */
.player-card {
  max-width: 420px;
}

/* v3.1.2：右侧内容区卡片自适应，最大宽度限制 */
.playlist-card,
.search-card {
  width: 100%;
  max-width: 100%;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--mo-text-1);
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 14px 0;
}

/* 播放器卡片 */
.player-card {
  text-align: center;
  margin-bottom: 0;
  flex-shrink: 0;
}

/* v3.2.2：热门评论卡片：紧凑高度，不参与空间争夺 */
.hot-comment-card {
  flex-shrink: 0;
  max-height: 260px;
  margin-bottom: 0 !important;
}

/* v3.2.2：搜索/云盘/排行榜卡片 + 播放列表卡片：占据右侧 Tab 区 + 下方播放列表区高度 */
.search-card,
.clouddrive-card,
.toplist-card,
.playlist-card,
.hotsearch-card {
  flex: 1 1 auto;
  min-height: 0;
  margin-bottom: 0 !important;
}

/* 音乐页 Tab 栏保持紧凑 */
.music-tabs {
  flex-shrink: 0;
}

.player-cover {
  width: 180px;
  height: 180px;
  margin: 0 auto 16px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--mo-bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-img.spinning {
  animation: spin 20s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.cover-placeholder {
  color: var(--mo-text-3);
}

.player-info {
  margin-bottom: 16px;
}

.track-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--mo-text-1);
  margin-bottom: 4px;
}

.track-meta {
  font-size: 13px;
  color: var(--mo-text-2);
  margin-bottom: 6px;
}

.track-source {
  display: flex;
  justify-content: center;
}

.progress-section {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.time-label {
  font-size: 12px;
  color: var(--mo-text-3);
  min-width: 40px;
}

.progress-slider {
  flex: 1;
}

.player-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.ctrl-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--mo-border);
  background: var(--mo-bg-2);
  color: var(--mo-text-2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.ctrl-btn:hover {
  background: var(--mo-primary);
  color: #fff;
  border-color: var(--mo-primary);
}

.ctrl-btn.active {
  background: var(--mo-primary);
  color: #fff;
  border-color: var(--mo-primary);
}

.play-btn {
  width: 56px;
  height: 56px;
  font-size: 20px;
  background: var(--mo-primary);
  color: #fff;
  border-color: var(--mo-primary);
}

.play-btn:hover {
  opacity: 0.9;
}

/* v3.1.6：喜欢按钮 */
.like-btn.active {
  color: #ff6b6b;
}
.like-btn.active:hover {
  background: #ff6b6b;
  border-color: #ff6b6b;
}
.like-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 歌词卡片 */
.lyrics-card {
  flex: 1;
  min-height: 0;
}

.lyrics-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  text-align: center;
  padding: 10px;
}

.lyric-line {
  font-size: 14px;
  color: var(--mo-text-3);
  line-height: 2;
  transition: all 0.3s;
}

.lyric-line.active {
  color: var(--mo-primary);
  font-weight: 600;
  font-size: 16px;
}

.lyrics-empty {
  color: var(--mo-text-3);
  font-size: 14px;
  padding: 30px 0;
}

.lyrics-hint {
  font-size: 12px;
  opacity: 0.7;
}

/* 搜索卡片 */
.search-card {
  margin-bottom: 16px;
}

.search-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.search-loading {
  text-align: center;
  padding: 20px;
  color: var(--mo-text-3);
}

.search-results {
  flex: 1 1 auto;
  min-height: 0;
  max-height: 40vh;
  overflow-y: auto;
  padding-right: 4px;
  margin-bottom: 12px;
}

/* v3.2.2：搜索卡片内嵌热搜榜 */
.hotsearch-inline {
  border-top: 1px dashed var(--mo-border);
  padding-top: 14px;
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.subsection-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--mo-text-2);
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px 0;
  flex-shrink: 0;
}

.hotsearch-inline .hotsearch-list {
  max-height: 28vh;
  overflow-y: auto;
  padding-right: 4px;
  flex: 1 1 auto;
  min-height: 0;
}

/* v3.1.2：搜索结果滚动条美化 */
.search-results::-webkit-scrollbar {
  width: 6px;
}
.search-results::-webkit-scrollbar-thumb {
  background: var(--mo-border);
  border-radius: 3px;
}

.search-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.2s;
}

.search-item:hover {
  background: var(--mo-bg-2);
}

.song-cover {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.song-cover.placeholder {
  background: var(--mo-bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mo-text-3);
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-name {
  font-size: 13px;
  color: var(--mo-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  font-size: 11px;
  color: var(--mo-text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.search-empty {
  text-align: center;
  padding: 20px;
  color: var(--mo-text-3);
  font-size: 13px;
}

/* 播放列表卡片 */
.playlist-card {
  flex: 1;
}

.playlist-count {
  font-size: 12px;
  color: var(--mo-text-3);
  font-weight: 400;
  margin-left: 8px;
}

.playlist-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.playlist-tracks {
  flex: 1;
  min-height: 0;
  max-height: 42vh;
  overflow-y: auto;
}

.playlist-empty {
  text-align: center;
  padding: 30px 0;
  color: var(--mo-text-3);
  font-size: 13px;
}

.playlist-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.playlist-item:hover {
  background: var(--mo-bg-2);
}

.playlist-item.active {
  background: rgba(64, 158, 255, 0.1);
}

.playlist-item.active .item-name {
  color: var(--mo-primary);
  font-weight: 600;
}

.item-index {
  width: 24px;
  text-align: center;
  font-size: 12px;
  color: var(--mo-text-3);
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 13px;
  color: var(--mo-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  font-size: 11px;
  color: var(--mo-text-3);
  display: flex;
  align-items: center;
  gap: 6px;
}

.source-tag {
  transform: scale(0.85);
}

.item-remove {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--mo-text-3);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-remove:hover {
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}

@media (max-width: 1100px) {
  .music-body {
    grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  }
}

@media (max-width: 800px) {
  .music-body {
    grid-template-columns: 1fr;
  }
  .player-card {
    max-width: 100%;
  }
}

/* v2.9.2：网易云用户信息 */
.netease-user {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--mo-surface);
  border: 1px solid var(--mo-border);
  border-radius: 20px;
}

.netease-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.netease-nickname {
  font-size: 13px;
  color: var(--mo-text-1);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* v2.9.2：Tab 切换 */
.music-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  background: var(--mo-surface);
  border: 1px solid var(--mo-border);
  border-radius: 10px;
  padding: 4px;
}

.music-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--mo-text-3);
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.music-tab:hover {
  color: var(--mo-text-1);
}

.music-tab.active {
  color: #fff;
  background: var(--mo-primary, #409eff);
}

/* v3.1.2：歌单网格自适应列数 */
.user-playlists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  max-height: 420px;
  overflow-y: auto;
  padding-right: 4px;
}

.user-playlists-grid::-webkit-scrollbar {
  width: 6px;
}
.user-playlists-grid::-webkit-scrollbar-thumb {
  background: var(--mo-border);
  border-radius: 3px;
}

.playlist-grid-item {
  cursor: pointer;
  transition: transform 0.2s;
}

.playlist-grid-item:hover {
  transform: translateY(-2px);
}

.playlist-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 10px;
  object-fit: cover;
  background: var(--mo-bg-2);
}

.playlist-cover.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mo-text-3);
}

.playlist-grid-name {
  font-size: 12px;
  color: var(--mo-text-1);
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
}

.playlist-grid-meta {
  font-size: 11px;
  color: var(--mo-text-3);
  margin-top: 2px;
}

/* v2.9.2：歌单详情 */
.playlist-detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.playlist-detail-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--mo-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playlist-detail-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.playlist-tracks {
  max-height: 350px;
  overflow-y: auto;
}

/* v3.1.0：Cookie 登录 */
.cookie-login-box {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* v3.1.9：登录对话框 */
.login-tabs {
  min-height: 280px;
}

/* 扫码登录 */
.qr-login-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px 0;
}

.qr-image-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.qr-image {
  width: 200px;
  height: 200px;
  border-radius: 8px;
  border: 1px solid var(--mo-border);
}

.qr-status {
  font-size: 13px;
  color: var(--mo-text-2);
}
.qr-status.success { color: var(--el-color-success, #67c23a); }
.qr-status.expired { color: var(--el-color-danger, #f56c6c); }

.qr-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.qr-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--mo-text-3);
}

/* 手机号登录 */
.phone-login-box {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 0;
}

.cookie-tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: var(--mo-surface);
  border-radius: 8px;
  font-size: 13px;
  color: var(--mo-text-2);
  line-height: 1.5;
}

.cookie-tip .el-icon {
  color: var(--mo-primary);
  flex-shrink: 0;
  margin-top: 2px;
}

.cookie-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.cookie-help {
  font-size: 12px;
  color: var(--mo-text-3);
}

.cookie-help details {
  cursor: pointer;
}

.cookie-help ol {
  margin: 8px 0 0 18px;
  padding: 0;
  line-height: 1.8;
}

.cookie-help code {
  background: var(--mo-surface);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 11px;
}

/* v3.1.5：热搜列表 */
.hotsearch-card {
  margin-bottom: 16px;
}

.hotsearch-list {
  max-height: 420px;
  overflow-y: auto;
  padding-right: 4px;
}

.hotsearch-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.hotsearch-item:hover {
  background: var(--mo-bg-2);
}

.hotsearch-rank {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--mo-text-3);
  flex-shrink: 0;
  border-radius: 6px;
  background: var(--mo-surface);
}

.hotsearch-rank.top3 {
  background: var(--mo-primary);
  color: #fff;
}

.hotsearch-info {
  flex: 1;
  min-width: 0;
}

.hotsearch-keyword {
  font-size: 13px;
  color: var(--mo-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hotsearch-score {
  font-size: 11px;
  color: var(--mo-text-3);
  margin-top: 2px;
}

.hotsearch-badge {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

/* v3.1.5：排行榜 */
.toplist-card {
  margin-bottom: 16px;
}

.toplist-list {
  max-height: 420px;
  overflow-y: auto;
  padding-right: 4px;
}

.toplist-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.toplist-item:hover {
  background: var(--mo-bg-2);
}

.toplist-cover {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.toplist-cover.placeholder {
  background: var(--mo-bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mo-text-3);
}

.toplist-info {
  flex: 1;
  min-width: 0;
}

.toplist-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--mo-text-1);
  margin-bottom: 3px;
}

.toplist-update {
  font-size: 11px;
  color: var(--mo-text-3);
  margin-bottom: 6px;
}

.toplist-preview {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toplist-track-preview {
  font-size: 11px;
  color: var(--mo-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* v3.1.8：热门评论卡片 */
.hot-comment-card {
  margin-top: 16px;
}

.hot-comment-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.comment-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.comment-avatar.placeholder {
  background: var(--mo-bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mo-text-3);
}

.comment-body {
  flex: 1;
  min-width: 0;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.comment-nickname {
  font-size: 12px;
  font-weight: 600;
  color: var(--mo-text-2);
}

/* v3.2.0：评论点赞按钮 */
.comment-like-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding: 4px 8px;
  border: 1px solid var(--mo-border);
  border-radius: 12px;
  background: transparent;
  color: var(--mo-text-3);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.comment-like-btn:hover:not(:disabled) {
  color: #ff6b6b;
  border-color: #ff6b6b;
  background: rgba(255, 107, 107, 0.08);
}

.comment-like-btn.liked {
  color: #ff6b6b;
  border-color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
}

.comment-like-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.comment-like-count {
  font-variant-numeric: tabular-nums;
}

.comment-content {
  font-size: 13px;
  color: var(--mo-text-1);
  line-height: 1.6;
  word-break: break-word;
}

.comment-reply {
  margin-top: 6px;
  padding: 6px 10px;
  background: var(--mo-bg-2);
  border-radius: 6px;
  font-size: 12px;
  color: var(--mo-text-2);
  line-height: 1.5;
}

.reply-arrow {
  margin-right: 4px;
  color: var(--mo-text-3);
}

.reply-user {
  font-weight: 600;
  color: var(--mo-text-2);
}

.comment-time {
  margin-top: 4px;
  font-size: 11px;
  color: var(--mo-text-3);
}

/* v3.1.8：评论对话框 */
.comments-toolbar {
  margin-bottom: 16px;
}

.comments-list {
  max-height: 480px;
  overflow-y: auto;
  padding-right: 4px;
}

.comments-list::-webkit-scrollbar {
  width: 6px;
}
.comments-list::-webkit-scrollbar-thumb {
  background: var(--mo-border);
  border-radius: 3px;
}

.comment-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 0;
  border-bottom: 1px solid var(--mo-border);
}

.comment-item:last-child {
  border-bottom: none;
}

.comments-footer {
  text-align: center;
  padding-top: 16px;
}
</style>
