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
          <!-- v3.5.2：评论内容独立滚动容器，标题固定在卡片顶部（不参与滚动），
               视觉与歌词卡片标题完全一致，无需 sticky 背景条/边框 -->
          <div class="hot-comment-scroll">
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
              @clear="onSearchClear"
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
              <img v-if="song.cover" :src="song.cover" class="song-cover" loading="lazy" />
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
                <!-- v3.5.3：下载按钮 -->
                <el-button size="small" circle @click="handleDownloadSong(song)" :loading="downloadingSongId === song.id" title="下载歌曲">
                  <el-icon><Download /></el-icon>
                </el-button>
                <!-- v3.5.3：云盘快传按钮 -->
                <el-button size="small" circle @click="handleQuickUpload(song)" :loading="uploadingSongId === song.id" title="快传到云盘">
                  <el-icon><Upload /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
          <div v-else-if="music.searchKeyword" class="search-empty">
            未找到相关歌曲
          </div>

          <!-- v3.2.2：热搜榜列表（v3.2.3：搜索时隐藏，清除搜索后恢复显示） -->
          <div class="hotsearch-inline" v-show="!music.searchResults.length && !music.searchLoading && !music.searchKeyword">
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
            <el-button size="small" text @click="refreshCloudDrive" :loading="music.cloudDriveLoading" style="margin-left: auto">
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
              <!-- v3.6.3：云盘本地上传 + 批量下载 -->
              <el-button size="small" :loading="cloudUploading" @click="handleCloudLocalUpload">
                <el-icon><Upload /></el-icon> 本地上传
              </el-button>
              <el-button size="small" :loading="batchRunning" @click="openBatchSelect(music.cloudDriveList)">
                <el-icon><Download /></el-icon> 批量下载
              </el-button>
            </div>
            <div v-if="cloudOpStatus" class="cloud-op-status">{{ cloudOpStatus }}</div>
            <div v-if="music.cloudDriveLoading && music.cloudDriveList.length === 0" class="search-loading">
              <el-icon class="is-loading"><Loading /></el-icon> 加载中...
            </div>
            <div v-else-if="music.cloudDriveList.length > 0" class="playlist-tracks">
              <div
                v-for="(track, i) in music.cloudDriveList.slice(0, cloudVisible)"
                :key="track.id"
                class="search-item"
              >
                <span class="item-index">{{ i + 1 }}</span>
                <img v-if="track.cover" :src="track.cover" class="song-cover" loading="lazy" />
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
                  <!-- v3.5.3：云盘歌曲下载按钮 -->
                  <el-button size="small" circle @click="handleDownloadSong(track)" :loading="downloadingSongId === track.id" title="下载歌曲">
                    <el-icon><Download /></el-icon>
                  </el-button>
                </div>
              </div>
              <!-- v3.2.4：加载更多（云盘歌曲可能上百首，分批渲染减少卡顿） -->
              <div v-if="music.cloudDriveList.length > cloudVisible" class="load-more-row" @click="loadMoreCloud">
                加载更多（已显示 {{ cloudVisible }} / {{ music.cloudDriveList.length }}）
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
                  <!-- v3.5.3：排行榜歌曲下载按钮 -->
                  <el-button size="small" circle @click="handleDownloadSong(track)" :loading="downloadingSongId === track.id" title="下载歌曲">
                    <el-icon><Download /></el-icon>
                  </el-button>
                  <!-- v3.5.3：排行榜歌曲云盘快传按钮 -->
                  <el-button size="small" circle @click="handleQuickUpload(track)" :loading="uploadingSongId === track.id" title="快传到云盘">
                    <el-icon><Upload /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- v2.9.2：我的歌单（v3.2.3：class 调整为 myplaylists-card，避免与底部播放列表卡片样式冲突） -->
        <div class="glass-card myplaylists-card" v-show="neteaseTab === 'playlists'">
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
              <!-- v3.6.4：歌单批量下载 -->
              <el-button size="small" :loading="batchRunning" @click="openBatchSelect(music.currentPlaylistTracks)">
                <el-icon><Download /></el-icon> 批量下载
              </el-button>
            </div>
            <div v-if="cloudOpStatus" class="cloud-op-status">{{ cloudOpStatus }}</div>
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
                  <!-- v3.5.3：歌单歌曲下载按钮 -->
                  <el-button size="small" circle @click="handleDownloadSong(track)" :loading="downloadingSongId === track.id" title="下载歌曲">
                    <el-icon><Download /></el-icon>
                  </el-button>
                  <!-- v3.5.3：歌单歌曲云盘快传按钮 -->
                  <el-button size="small" circle @click="handleQuickUpload(track)" :loading="uploadingSongId === track.id" title="快传到云盘">
                    <el-icon><Upload /></el-icon>
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
              v-for="(track, i) in music.playlist.slice(0, queueVisible)"
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
            <!-- v3.2.4：播放队列过长时分批渲染，避免卡顿 -->
            <div v-if="music.playlist.length > queueVisible" class="load-more-row" @click="loadMoreQueue">
              加载更多（已显示 {{ queueVisible }} / {{ music.playlist.length }}）
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

    <!-- v3.6.4：批量操作歌曲选择对话框 -->
    <el-dialog v-model="batchDialogVisible" title="选择要下载的歌曲" width="560px" :close-on-click-modal="false">
      <div class="batch-select-toolbar">
        <el-checkbox v-model="batchAll" :indeterminate="batchIndeterminate" @change="toggleBatchAll">全选</el-checkbox>
        <el-button size="small" text @click="invertBatchSelect">反选</el-button>
        <span class="batch-select-count">已选 {{ batchSelected.length }} / {{ batchSongList.length }}</span>
      </div>
      <div class="batch-select-list">
        <el-checkbox-group v-model="batchSelected" class="batch-select-group">
          <label v-for="s in batchPageList" :key="s.id" class="batch-select-item">
            <el-checkbox :value="s.id">
              <span class="batch-item-name">{{ s.name }}</span>
              <span class="batch-item-artist" v-if="s.artist"> - {{ s.artist }}</span>
            </el-checkbox>
          </label>
        </el-checkbox-group>
        <div v-if="!batchSongList.length" class="batch-select-empty">暂无可操作的歌曲</div>
        <div v-else-if="batchVisible < batchSongList.length" class="batch-select-more" @click="loadMoreBatchSelect">
          加载更多（已显示 {{ Math.min(batchVisible, batchSongList.length) }} / {{ batchSongList.length }}）
        </div>
      </div>
      <template #footer>
        <el-button @click="batchDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchRunning" :disabled="!batchSelected.length" @click="batchConfirm">
          确认下载（{{ batchSelected.length }}）
        </el-button>
      </template>
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
  TrendCharts, Trophy, ChatDotRound, Folder, Download, Upload
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const music = useMusicStore()

const searchKeyword = ref('')
const progressValue = ref(0)
const lyricsContainer = ref<HTMLElement | null>(null)
const isDraggingProgress = ref(false) // v3.0.0：防止拖动时被 currentTime 覆盖

// v3.1.5：Tab 类型扩展（v3.2.2：原热搜 Tab 改为云盘）
const neteaseTab = ref<'search' | 'playlists' | 'clouddrive' | 'toplist'>('search')

// v3.2.4：长列表可视数量分页——避免云盘/播放队列歌曲量大时一次性渲染过多 DOM 导致卡顿
const VISIBLE_STEP = 60
const cloudVisible = ref(VISIBLE_STEP)
const queueVisible = ref(VISIBLE_STEP)
function loadMoreCloud() { cloudVisible.value += VISIBLE_STEP }
function loadMoreQueue() { queueVisible.value += VISIBLE_STEP }

const showLoginDialog = ref(false)
const cookieInput = ref('')
const cookieLogging = ref(false)
const viewingPlaylistId = ref(0)
const viewingToplistId = ref(0)

// v3.5.3：下载和上传状态
const downloadingSongId = ref<number | null>(null)
const uploadingSongId = ref<number | null>(null)
// v3.6.3：云盘本地上传 + 批量下载状态与进度
const cloudUploading = ref(false)
const cloudOpStatus = ref('')

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

// v3.2.3：点击搜索框叉号——清除搜索结果并恢复热搜显示
function onSearchClear() {
  searchKeyword.value = ''
  music.searchResults = []
  music.searchKeyword = ''
  music.searchLoading = false
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
    cloudVisible.value = VISIBLE_STEP // v3.2.4：重置可视数量
    music.fetchCloudDrive()
  }
}

// v3.2.4：手动刷新云盘——重置可视数量并重新拉取
function refreshCloudDrive() {
  cloudVisible.value = VISIBLE_STEP
  music.fetchCloudDrive()
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

// v3.5.3：下载歌曲（同时下载音频和歌词到同一目录）
async function handleDownloadSong(song: { id: number; name: string; artist: string }) {
  if (!song?.id) return
  downloadingSongId.value = song.id
  try {
    // 使用主进程下载，一次选择保存位置，歌词自动保存在同一目录
    const result = await music.downloadSong(song.id, song.artist, song.name)
    if (result.success) {
      if (result.lyricPath) {
        ElMessage.success(`已下载：${song.artist} - ${song.name}（含歌词）`)
      } else {
        ElMessage.success(`已下载：${song.artist} - ${song.name}`)
      }
    } else if (result.message !== '用户取消') {
      ElMessage.error(result.message || '下载失败')
    }
  } catch (error) {
    ElMessage.error('下载失败：' + (error as Error).message)
  } finally {
    downloadingSongId.value = null
  }
}

// v3.5.3：快传歌曲到云盘
async function handleQuickUpload(song: { id: number; name: string; artist: string; album?: string }) {
  if (!song?.id) return
  if (!music.neteaseLoggedIn) {
    ElMessage.warning('请先登录网易云账号')
    showLoginDialog.value = true
    return
  }
  uploadingSongId.value = song.id
  try {
    const result = await music.quickUploadSongs([{ id: song.id, name: song.name, artist: song.artist, album: song.album }])
    if (result.success) {
      ElMessage.success(result.message || '快传成功')
      // 如果在云盘标签页，刷新云盘列表
      if (neteaseTab.value === 'clouddrive') {
        await music.fetchCloudDrive()
      }
    } else {
      ElMessage.error(result.message || '快传失败')
    }
  } catch (error) {
    ElMessage.error('快传失败：' + (error as Error).message)
  } finally {
    uploadingSongId.value = null
  }
}

// v3.6.3：云盘本地上传（选择本地音频上传到云盘）
async function handleCloudLocalUpload() {
  if (!music.neteaseLoggedIn) {
    ElMessage.warning('请先登录网易云账号')
    showLoginDialog.value = true
    return
  }
  cloudUploading.value = true
  cloudOpStatus.value = ''
  try {
    const res = await music.cloudUploadFiles()
    if (res.canceled) return
    if (res.success) {
      ElMessage.success(`云盘上传完成：成功 ${res.successCount} / ${res.total}`)
      if (res.failCount) ElMessage.error(`失败 ${res.failCount} 个：${res.failed?.join('、')}`)
      await music.fetchCloudDrive()
    } else {
      ElMessage.error(res.message || '上传失败')
    }
  } catch (e) {
    ElMessage.error('上传失败：' + (e as Error).message)
  } finally {
    cloudUploading.value = false
    cloudOpStatus.value = ''
  }
}

// v3.6.4：批量下载（选择歌曲 → 下载）
const batchDialogVisible = ref(false)
const batchSongList = ref<{ id: number; name: string; artist: string }[]>([])
const batchSelected = ref<number[]>([])
const batchRunning = ref(false)
const batchAll = ref(false)
// v3.6.4：批量选择列表懒加载，每页 100 首
const batchPageSize = 100
const batchVisible = ref(batchPageSize)
const batchPageList = computed(() => batchSongList.value.slice(0, batchVisible.value))
const batchIndeterminate = computed(
  () => batchSelected.value.length > 0 && batchSelected.value.length < batchSongList.value.length
)

function openBatchSelect(list: { id: number; name?: string; artist?: string }[]) {
  // 归一化为普通对象，避免把 Vue 的 reactive Proxy 对象传给 IPC（否则报 “An object could not be cloned”）
  batchSongList.value = (list || []).map((s) => ({
    id: Number(s.id),
    name: String(s?.name ?? ''),
    artist: String(s?.artist ?? '')
  }))
  batchVisible.value = batchPageSize
  // 打开时只默认勾选「已加载」的一页，未加载的歌曲不算入选择
  batchSelected.value = batchSongList.value.slice(0, batchVisible.value).map((s) => s.id)
  batchAll.value = true
  batchDialogVisible.value = true
}
function loadMoreBatchSelect() {
  batchVisible.value += batchPageSize
}
// v3.6.4：全选只勾选「已加载分页」内的歌曲，未加载的不处理；取消全选只清除已加载的勾选
function toggleBatchAll(checked: boolean) {
  const loaded = batchSongList.value.slice(0, batchVisible.value)
  const loadedIds = loaded.map((s) => s.id)
  if (checked) {
    // 全选：仅把已加载的勾上，保留未加载的手动勾选
    batchSelected.value = Array.from(new Set([...batchSelected.value, ...loadedIds]))
  } else {
    // 取消全选：清除已加载的勾选，未加载的手动勾选保留
    const loadedSet = new Set(loadedIds)
    batchSelected.value = batchSelected.value.filter((id) => !loadedSet.has(id))
  }
}
function invertBatchSelect() {
  const loaded = batchSongList.value.slice(0, batchVisible.value)
  const loadedIds = loaded.map((s) => s.id)
  const selectedSet = new Set(batchSelected.value)
  loadedIds.forEach((id) => (selectedSet.has(id) ? selectedSet.delete(id) : selectedSet.add(id)))
  batchSelected.value = Array.from(selectedSet)
}
async function batchConfirm() {
  const selectedSongs = batchSongList.value.filter((s) => batchSelected.value.includes(s.id))
  if (!selectedSongs.length) return
  batchDialogVisible.value = false
  batchRunning.value = true
  cloudOpStatus.value = ''
  try {
    // 精简为普通对象传给 IPC
    const plain = selectedSongs.map((s) => ({ id: Number(s.id), name: String(s.name || ''), artist: String(s.artist || '') }))
    const res = await music.batchDownloadSongs(plain)
    if (res.canceled) return
    if (res.success) {
      ElMessage.success(`批量下载完成：成功 ${res.successCount}/${res.total}`)
      if (res.failCount) ElMessage.error(`失败 ${res.failCount} 首：${res.failed?.map((f) => f.name).join('、')}`)
    } else {
      ElMessage.error(res.message || '下载失败')
    }
  } catch (e) {
    ElMessage.error('批量操作失败：' + (e as Error).message)
  } finally {
    batchRunning.value = false
    cloudOpStatus.value = ''
  }
}

// 切换歌曲时检查喜欢状态 + 获取热门评论
watch(() => music.currentTrack?.id, (newId) => {
  if (newId && music.currentTrack?.source === 'online') {
    // v3.2.6：无闪烁——先读缓存 likedSongIds，命中立即显示，不命中则显示 false
    //   随后 checkSongLikeStatus 会再校验一次（必要时补拉 likelist）并修正状态
    const cachedLiked = music.isSongLiked(newId)
    music.currentLiked = cachedLiked
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
  // v3.4.1：从其他页面（如顶栏心动模式）切歌后返回本页时，当前曲目 ID 已发生变化，
  //         watch(currentTrack?.id) 不会再次触发，导致热门评论/评论弹窗空白。
  //         挂载时若已存在在线曲目，主动补拉其喜欢状态与评论。
  const track = music.currentTrack
  if (track?.id && track.source === 'online') {
    music.currentLiked = music.isSongLiked(track.id)
    music.checkSongLikeStatus(track.id)
    music.fetchSongComments(track.id, 1, 20, 1)
  }
  // v3.6.3：云盘上传/下载进度
  const api = (window as any).electronAPI
  api?.onCloudUploadProgress?.((p: { current: number; total: number; fileName: string; status: string }) => {
    cloudOpStatus.value = `上传 ${p.current}/${p.total} ${p.fileName}：${p.status}`
  })
  api?.onCloudDownloadProgress?.((p: { current: number; total: number; fileName: string; status: string }) => {
    cloudOpStatus.value = `下载 ${p.current}/${p.total} ${p.fileName}：${p.status}`
  })
})

onUnmounted(() => {
  stopQrPolling()
})
</script>

<style scoped>
.music-page {
  padding: 20px;
  height: 100%;
  /* v3.2.3：整页限定在首屏，不再出现页面级滚动；各长列表卡片内部自行滚动 */
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.music-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-shrink: 0;
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
  /* v3.2.3：左右两列底部对齐——网格行拉伸 + 列高 100%，最后一格 flex:1 吸收剩余高度 */
  align-items: stretch;
  flex: 1;
  min-height: 0;
}

/* v3.2.3：左右列高度 100%，子卡片纵向堆叠；最后一格 flex:1 使两列底部落在同一行 */
.music-player-col,
.music-list-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  height: 100%;
}

/* v3.1.0：统一卡片样式，与其他页面保持一致
   v3.4.2：视觉参数改用全局 --glass-* / --mo-radius 变量，与 <GlassCard> 完全一致，
   修复液态玻璃模式下圆角/模糊/高光等效果在本页不生效的问题 */
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
  transition: box-shadow 0.25s ease;
  padding: 20px;
  /* v3.2.6：移除 overflow:hidden，避免内部 hover transform 与 backdrop-filter
     GPU 层叠加时绘制到相邻卡片上层（盖住别的卡片的视觉问题） */
  overflow: visible;
  display: flex;
  flex-direction: column;
  min-height: 0;
  isolation: isolate;
}

/* v3.4.2：液态高光层（顶部渐变光 + 左上镜面光斑），与全局 .glass-card--card::before 一致。
   z-index:-1 + isolation:isolate 使内容天然位于高光之上，无需逐子元素提升 z-index */
.glass-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: -1;
  background:
    radial-gradient(120% 60% at 18% 0%, rgba(255, 255, 255, var(--glass-highlight-corner)) 0%, transparent 60%),
    linear-gradient(180deg, rgba(255, 255, 255, var(--glass-highlight-top)) 0%, transparent 32%);
}

/* v3.4.2：液态玻璃模式下：菲涅尔镜面反射 + 色差边缘 + 噪声纹理（与全局一致） */
body.liquid-glass .glass-card::before {
  background:
    linear-gradient(180deg, rgba(255,255,255,calc(var(--glass-highlight-top) * 1.5)) 0%, transparent 30%),
    linear-gradient(90deg, rgba(255,255,255,var(--glass-highlight-corner)) 0%, transparent 15%, transparent 85%, rgba(255,255,255,var(--glass-highlight-corner)) 100%),
    linear-gradient(0deg, rgba(255,255,255,var(--glass-highlight-bottom)) 0%, transparent 20%);
}
body.liquid-glass .glass-card {
  box-shadow:
    var(--glass-shadow),
    inset 0 1px 0 rgba(255, 255, 255, var(--glass-edge-highlight)),
    inset 0 -1px 0 rgba(255, 255, 255, var(--glass-highlight-bottom)),
    inset 1px 0 0 rgba(255, 100, 100, 0.02),
    inset -1px 0 0 rgba(100, 100, 255, 0.02);
}
body.liquid-glass .glass-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0.025;
  z-index: -1;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
body.liquid-glass .glass-card:hover {
  box-shadow:
    0 8px 28px rgba(31, 64, 130, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, calc(var(--glass-edge-highlight) + 0.08)),
    inset 0 -1px 0 rgba(255, 255, 255, var(--glass-highlight-bottom)),
    inset 1px 0 0 rgba(255, 100, 100, 0.03),
    inset -1px 0 0 rgba(100, 100, 255, 0.03);
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

/* v3.2.2：热门评论卡片：紧凑高度，不参与空间争夺
   v3.4.1：内部可滚动，长评论超出高度时在卡片内滚动而非溢出 */
.hot-comment-card {
  flex-shrink: 0;
  max-height: 220px;
  margin-bottom: 0 !important;
}

/* v3.5.2：评论内容独立滚动容器，标题「热门评论」固定在卡片顶部（不参与滚动），
   标题外观与歌词卡片标题完全一致（无 sticky 背景条/边框），滚动只发生在评论区 */
.hot-comment-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

/* v3.2.4：右侧 Tab 内容卡片（搜索/云盘/排行榜/我的歌单）——主内容区，basis 0 + flex:1 填充剩余空间
   内部列表各自 overflow:auto 滚动，始终可见，不再被下方播放列表挤占
   v3.2.7：显式 overflow:hidden 防止内部列表内容越过卡片边界覆盖其他区域
   （全局 .glass-card--card 为解决 hover 问题设为 overflow:visible，此处必须单独收紧） */
.search-card,
.clouddrive-card,
.toplist-card,
.myplaylists-card {
  flex: 1 1 0;
  min-height: 0;
  margin-bottom: 0 !important;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  isolation: isolate;
}
/* 卡片内所有直接子元素：允许内容滚动但不出界 */
.search-card > *,
.clouddrive-card > *,
.toplist-card > *,
.myplaylists-card > * {
  min-width: 0;
  min-height: 0;
}

/* v3.2.4：底部播放列表卡片——按内容高度，上限 40vh，内部滚动；
   flex:0 1 auto 不主动增长，避免歌曲多时挤占上方 Tab 内容卡片 */
.playlist-card {
  flex: 0 1 auto;
  min-height: 120px;
  max-height: 40vh;
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

.ctrl-btn:hover:not(.active) {
  background: var(--mo-surface-hover, rgba(255, 255, 255, 0.74));
  color: var(--mo-text-1, #222);
  border-color: var(--glass-border, rgba(255, 255, 255, 0.8));
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

/* 搜索卡片（flex 规则见上方 .search-card，v3.2.3：不再单独设 margin-bottom） */
.search-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  /* v3.5.2：防止搜索结果出现时输入框被 flex 布局压缩 */
  flex-shrink: 0;
}

.search-loading {
  text-align: center;
  padding: 20px;
  color: var(--mo-text-3);
}

.search-results {
  /* v3.5.2：flex basis 改为 0，避免内容高度反向挤压上方搜索框；
     卡片本身 overflow:hidden + flex:1 限制总高，无需 max-height */
  flex: 1 1 0;
  min-height: 0;
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
  max-height: 24vh;
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
  /* v3.6.4：按钮较多时允许换行并垂直居中，避免图标按钮被挤压错位 */
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
}

.search-empty {
  text-align: center;
  padding: 20px;
  color: var(--mo-text-3);
  font-size: 13px;
}

/* 播放列表卡片（底部填充格，flex 规则见上方 .playlist-card） */
.playlist-count {
  font-size: 12px;
  color: var(--mo-text-3);
  font-weight: 400;
  margin-left: 8px;
}

/* v3.2.4：长列表"加载更多"按钮 */
.load-more-row {
  text-align: center;
  padding: 10px;
  margin: 4px 0;
  font-size: 12px;
  color: var(--mo-text-2);
  background: var(--mo-fill-1, rgba(125, 125, 125, 0.08));
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  user-select: none;
}
.load-more-row:hover {
  background: var(--mo-primary, #409eff);
  color: #fff;
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

/* v3.1.2：歌单网格自适应列数
   v3.2.6：overflow-x:visible + isolation:isolate 防止网格项 hover 上浮时与 backdrop-filter
     叠加"盖住"相邻卡片；每项使用独立定位层（position:relative + z-index:0/1） */
.user-playlists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 14px;
  max-height: 460px;
  overflow-x: visible;
  overflow-y: auto;
  padding-right: 4px;
  isolation: isolate;
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
  transition: transform 0.2s, box-shadow 0.2s;
  /* v3.2.6：显式定位层，避免 hover 时与 backdrop-filter 卡的 GPU 层叠加绘制错乱 */
  position: relative;
  z-index: 0;
  border-radius: 10px; /* 匹配封面圆角，使 hover 阴影贴合 */
}

.playlist-grid-item:hover {
  /* v3.2.6：用阴影替代 translateY(-2px) 上浮，减少 GPU 层重叠；
     保留轻微上移但加 z-index:1，确保只在网格层内显示，不溢出盖其他卡片 */
  transform: translateY(-1px);
  z-index: 1;
  box-shadow: 0 4px 14px rgba(31, 64, 130, 0.12);
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
  font-size: 13px;
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
  font-size: 12px;
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
  /* v3.6.4：批量按钮较多时允许换行 + 垂直居中，避免图标与文字按钮错位 */
  flex-wrap: wrap;
  align-items: center;
}

/* v3.6.3：云盘上传/下载进度提示 */
.cloud-op-status {
  font-size: 12px;
  color: #909399;
  margin-bottom: 10px;
  word-break: break-all;
}

/* v3.6.4：批量操作选择对话框 */
.batch-select-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.batch-select-count {
  margin-left: auto;
  font-size: 13px;
  color: #909399;
}
.batch-select-list {
  max-height: 360px;
  overflow-y: auto;
  border-top: 1px solid var(--el-border-color-light, #ebeef5);
}
.batch-select-group {
  display: flex;
  flex-direction: column;
  width: 100%;
}
.batch-select-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 6px 4px;
  border-bottom: 1px solid var(--el-border-color-lighter, #f0f2f5);
}
.batch-item-name {
  font-size: 13px;
}
.batch-item-artist {
  font-size: 12px;
  color: #909399;
}
.batch-select-empty {
  text-align: center;
  color: #909399;
  padding: 20px;
  font-size: 13px;
}
.batch-select-more {
  text-align: center;
  color: #409eff;
  padding: 10px;
  font-size: 13px;
  cursor: pointer;
}
.batch-select-more:hover {
  color: #79bbff;
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
/* v3.1.5：热搜列表（v3.2.3：hotsearch-card 已废弃，热搜内嵌到搜索卡片） */
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

/* v3.1.5：排行榜（flex 规则见上方 .toplist-card）
   v3.2.6：改为 2 列网格——飙升榜/新歌榜等两榜同一行展示
   v3.2.7：内容溢出修复——卡片 overflow 隐藏 + isolation 防层叠 */
.toplist-list {
  max-height: 480px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  isolation: isolate;
}

/* v3.2.7：排行榜卡片改为图标左、文字右的水平布局，并严格防止内容溢出 */
.toplist-item {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s, box-shadow 0.2s;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  position: relative;
  z-index: 0;
  text-align: left;
  overflow: hidden;
  min-height: 0;
  isolation: isolate;
}

.toplist-item:hover {
  background: var(--mo-bg-2);
  border-color: var(--glass-border, var(--mo-border));
  box-shadow: 0 4px 14px rgba(31, 64, 130, 0.10);
  /* v3.2.7：去掉 hover 的 translateY(-1px) 与 z-index:1，
     防止 backdrop-filter 层叠导致 hover 卡片绘制到相邻卡片上层 */
}

.toplist-cover {
  width: 64px;
  height: 64px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
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
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  overflow: hidden;
}

.toplist-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--mo-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toplist-update {
  font-size: 10px;
  color: var(--mo-text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toplist-preview {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 2px;
  overflow: hidden;
}

.toplist-track-preview {
  font-size: 10px;
  color: var(--mo-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

@media (max-width: 1100px) {
  .toplist-list {
    grid-template-columns: 1fr;
  }
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
  /* v3.4.1：长文本/连续字符（URL、表情等）溢出卡片修复——
     用 overflow-wrap:anywhere 强制在任意字符处断行，配合 pre-wrap 保留换行 */
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  min-width: 0;
}

.comment-reply {
  margin-top: 6px;
  padding: 6px 10px;
  background: var(--mo-bg-2);
  border-radius: 6px;
  font-size: 12px;
  color: var(--mo-text-2);
  line-height: 1.5;
  /* v3.4.1：回复内容同样处理长文本断行，防止撑破卡片 */
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  min-width: 0;
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
