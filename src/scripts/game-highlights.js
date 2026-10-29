import { integrationConfig } from '@/config'
import { showToast, placeToast } from './site-toast'
import { closeWithMotion } from './close-with-motion'
// Route-scoped controller. Keeping this file in Astro's asset pipeline gives every change a hash.
;(function () {
  if (window.__gameHighlightsController) {
    window.__gameHighlightsController.schedule()
    return
  }

  var initPending = false
  var cleanupCurrentPage = function () {}
  var storageKey = 'replay-os-admin-passcode'
  var storageCapacityBytes = 10000000000
  var selfHostedOrigin = integrationConfig.highlights.mediaOrigin
  var pageSize = 12
  var playerThemeLoad = null

  function loadPlayerTheme() {
    if (window.customElements?.get('media-theme-yt')) return Promise.resolve()
    if (!playerThemeLoad) {
      var themeUrl = 'https://cdn.jsdelivr.net/npm/player.style@0.3.4/yt/+esm'
      playerThemeLoad = import(/* @vite-ignore */ themeUrl).catch(function () {
        playerThemeLoad = null
        // Keep native video controls available when the theme cannot load.
      })
    }
    return playerThemeLoad
  }
  var videoSourceProfiles = {
    r2: { label: 'R2 自托管', shortLabel: 'R2' },
    bilibili: { label: '哔哩哔哩', shortLabel: 'BILI' },
    youtube: { label: 'YouTube', shortLabel: 'YT' },
    douyin: { label: '抖音', shortLabel: 'DY' }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }

  function getElements() {
    return {
      page: document.querySelector('[data-highlights-page]'),
      adminTrigger: document.querySelector('[data-admin-trigger]'),
      adminTriggerLabel: document.querySelector('[data-admin-trigger-label]'),
      adminGate: document.querySelector('[data-admin-gate]'),
      closeAdminGateButtons: document.querySelectorAll('[data-close-admin-gate]'),
      adminLoginForm: document.querySelector('[data-admin-login-form]'),
      adminPasscode: document.querySelector('#admin-passcode'),
      adminLoginStatus: document.querySelector('[data-admin-login-status]'),
      adminOnly: document.querySelectorAll('[data-admin-only]'),
      adminLogout: document.querySelector('[data-admin-logout]'),
      adminSync: document.querySelector('[data-admin-sync]'),
      addToggle: document.querySelector('#add-highlight-toggle'),
      addToggleLabel: document.querySelector('[data-highlight-toggle-label]'),
      editor: document.querySelector('[data-highlight-editor]'),
      closeEditorButtons: document.querySelectorAll('[data-close-highlight-editor]'),
      form: document.querySelector('#highlight-form'),
      highlightId: document.querySelector('#highlight-id'),
      urlField: document.querySelector('[data-url-field]'),
      editorModeLabel: document.querySelector('[data-editor-mode-label]'),
      editorModeTitle: document.querySelector('[data-editor-mode-title]'),
      editorSubmit: document.querySelector('[data-editor-submit]'),
      game: document.querySelector('#highlight-game'),
      gameSelect: document.querySelector('[data-game-select]'),
      gameTrigger: document.querySelector('[data-game-select-trigger]'),
      gameTriggerCode: document.querySelector('[data-game-select-code]'),
      gameTriggerLabel: document.querySelector('[data-game-select-label]'),
      gameTriggerPlayerId: document.querySelector('[data-game-select-player-id]'),
      gameOptionsPanel: document.querySelector('[data-game-select-options]'),
      gameOptionButtons: document.querySelectorAll('[data-game-select-option]'),
      url: document.querySelector('#highlight-url'),
      title: document.querySelector('#highlight-title'),
      description: document.querySelector('#highlight-description'),
      tags: document.querySelector('#highlight-tags'),
      passcode: document.querySelector('#highlight-passcode'),
      submit: document.querySelector('#highlight-form .save-button'),
      status: document.querySelector('[data-form-status]'),
      libraryStatus: document.querySelector('[data-library-status]'),
      libraryStatusCode: document.querySelector('[data-library-status-code]'),
      libraryStatusTitle: document.querySelector('[data-library-status-title]'),
      libraryStatusMessage: document.querySelector('[data-library-status-message]'),
      libraryRetry: document.querySelector('[data-library-retry]'),
      search: document.querySelector('[data-capture-search]'),
      tagFilters: document.querySelector('[data-tag-filters]'),
      clearFiltersButtons: document.querySelectorAll('[data-clear-filters]'),
      loadMore: document.querySelector('[data-load-more]'),
      loadMoreCount: document.querySelector('[data-load-more-count]'),
      list: document.querySelector('[data-highlight-list]'),
      folders: document.querySelector('[data-capture-folders]'),
      folderButtons: document.querySelectorAll('[data-capture-folder]'),
      folderCounts: document.querySelectorAll('[data-folder-count]'),
      folderHeading: document.querySelector('[data-folder-heading]'),
      folderBack: document.querySelector('[data-folder-back]'),
      allEmpty: document.querySelector('[data-all-empty]'),
      filterEmpty: document.querySelector('[data-filter-empty]'),
      filters: document.querySelectorAll('[data-game-filter]'),
      filterCounts: document.querySelectorAll('[data-filter-count]'),
      storageMeter: document.querySelector('[data-storage-meter]'),
      storageUsed: document.querySelector('[data-storage-used]'),
      storagePercent: document.querySelector('[data-storage-percent]'),
      storageTrack: document.querySelector('[data-storage-track]'),
      storageProgress: document.querySelector('[data-storage-progress]'),
      storageRemaining: document.querySelector('[data-storage-remaining]'),
      storageCount: document.querySelector('[data-storage-count]'),
      storageWarning: document.querySelector('[data-storage-warning]'),
      systemSync: document.querySelector('[data-system-sync]'),
      systemNode: document.querySelector('[data-system-node]'),
      playerModal: document.querySelector('[data-player-modal]'),
      closePlayerButtons: document.querySelectorAll('[data-close-player]'),
      playerStage: document.querySelector('[data-player-stage]'),
      playerTitle: document.querySelector('[data-player-title]'),
      playerCaptureNumber: document.querySelector('[data-player-capture-number]'),
      playerGame: document.querySelector('[data-player-game]'),
      playerDate: document.querySelector('[data-player-date]'),
      playerTags: document.querySelector('[data-player-tags]'),
      playerPrevious: document.querySelector('[data-player-previous]'),
      playerNext: document.querySelector('[data-player-next]')
    }
  }

  function formatBytes(value) {
    var bytes = Number(value)
    if (!Number.isFinite(bytes) || bytes < 0) return '大小未知'
    if (bytes === 0) return '0 MB'
    if (bytes >= 1000000000) return (bytes / 1000000000).toFixed(2) + ' GB'
    if (bytes >= 1000000) return (bytes / 1000000).toFixed(1) + ' MB'
    return Math.max(1, Math.round(bytes / 1000)) + ' KB'
  }

  function formatDate(value) {
    return String(value || '').replaceAll('-', '.')
  }

  function formatDuration(value) {
    var duration = Number(value)
    if (!Number.isFinite(duration) || duration <= 0) return '--:--'
    var hours = Math.floor(duration / 3600)
    var minutes = Math.floor((duration % 3600) / 60)
    var seconds = Math.floor(duration % 60)
    return hours > 0
      ? String(hours) +
          ':' +
          String(minutes).padStart(2, '0') +
          ':' +
          String(seconds).padStart(2, '0')
      : String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0')
  }

  function buildStorageSummary(highlights) {
    var selfHosted = highlights.filter(function (highlight) {
      return highlight.source === 'r2'
    })
    var counted = selfHosted.filter(function (highlight) {
      return Number.isSafeInteger(Number(highlight.sizeBytes)) && Number(highlight.sizeBytes) >= 0
    })
    var usedBytes = counted.reduce(function (total, highlight) {
      return total + Number(highlight.sizeBytes)
    }, 0)

    return {
      capacityBytes: storageCapacityBytes,
      usedBytes: usedBytes,
      remainingBytes: Math.max(0, storageCapacityBytes - usedBytes),
      exceededByBytes: Math.max(0, usedBytes - storageCapacityBytes),
      percentage: (usedBytes / storageCapacityBytes) * 100,
      exceeded: usedBytes > storageCapacityBytes,
      totalVideoCount: selfHosted.length,
      countedVideoCount: counted.length,
      unknownVideoCount: selfHosted.length - counted.length,
      totalObjectCount: selfHosted.length,
      unclassifiedVideoCount: 0
    }
  }

  function readInitialHighlights() {
    var source = document.querySelector('[data-initial-highlights]')
    if (!source) return []
    try {
      var parsed = JSON.parse(source.textContent || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  function getSessionPasscode() {
    try {
      return sessionStorage.getItem(storageKey) || ''
    } catch {
      return ''
    }
  }

  function rememberPasscode(passcode) {
    try {
      sessionStorage.setItem(storageKey, passcode)
    } catch {
      // Session storage can be unavailable in private browsing contexts.
    }
  }

  function forgetPasscode() {
    try {
      sessionStorage.removeItem(storageKey)
    } catch {
      // Session storage can be unavailable in private browsing contexts.
    }
  }

  function getVideoReference(rawValue) {
    var input = String(rawValue || '').trim()
    if (!input) return null
    var url
    try {
      url = new URL(input)
    } catch {
      return null
    }

    if (url.protocol !== 'https:' || url.username || url.password) return null
    url.hash = ''

    if (url.origin === selfHostedOrigin && url.pathname !== '/') {
      return { source: 'r2', url: url.toString() }
    }

    var bilibiliHosts = [
      'bilibili.com',
      'www.bilibili.com',
      'm.bilibili.com',
      'player.bilibili.com'
    ]
    if (bilibiliHosts.includes(url.hostname)) {
      var pathId = url.pathname.match(/\/video\/(BV[0-9A-Za-z]+|av\d+)/i)?.[1] || ''
      var queryId =
        url.searchParams.get('bvid') ||
        (url.searchParams.get('aid') ? 'av' + url.searchParams.get('aid') : '')
      var rawBilibiliId = pathId || queryId
      if (rawBilibiliId) {
        var pageValue = Number(url.searchParams.get('p') || url.searchParams.get('page') || '1')
        var page = Number.isSafeInteger(pageValue) && pageValue > 0 ? Math.min(pageValue, 1000) : 1
        var isBvid = /^BV/i.test(rawBilibiliId)
        var bilibiliId = isBvid ? 'BV' + rawBilibiliId.slice(2) : rawBilibiliId.replace(/^av/i, '')
        if (
          (isBvid && /^BV[0-9A-Za-z]+$/.test(bilibiliId)) ||
          (!isBvid && /^\d+$/.test(bilibiliId))
        ) {
          var bilibiliUrl = new URL(
            isBvid
              ? 'https://www.bilibili.com/video/' + bilibiliId
              : 'https://www.bilibili.com/video/av' + bilibiliId
          )
          if (page > 1) bilibiliUrl.searchParams.set('p', String(page))
          var bilibiliEmbed = new URL('https://player.bilibili.com/player.html')
          bilibiliEmbed.searchParams.set('isOutside', 'true')
          bilibiliEmbed.searchParams.set(isBvid ? 'bvid' : 'aid', bilibiliId)
          bilibiliEmbed.searchParams.set('page', String(page))
          bilibiliEmbed.searchParams.set('high_quality', '1')
          bilibiliEmbed.searchParams.set('danmaku', '0')
          return {
            source: 'bilibili',
            url: bilibiliUrl.toString(),
            videoId: bilibiliId,
            embedUrl: bilibiliEmbed.toString()
          }
        }
      }
    }

    var youtubeHosts = [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'www.youtube-nocookie.com',
      'youtube-nocookie.com'
    ]
    var youtubeId = ''
    if (url.hostname === 'youtu.be') youtubeId = url.pathname.split('/').filter(Boolean)[0] || ''
    else if (youtubeHosts.includes(url.hostname)) {
      youtubeId =
        url.searchParams.get('v') ||
        url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/)?.[1] ||
        ''
    }
    if (/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) {
      var youtubeUrl = new URL('https://www.youtube.com/watch')
      youtubeUrl.searchParams.set('v', youtubeId)
      var youtubeEmbed = new URL('https://www.youtube.com/embed/' + youtubeId)
      youtubeEmbed.searchParams.set('playsinline', '1')
      youtubeEmbed.searchParams.set('rel', '0')
      return {
        source: 'youtube',
        url: youtubeUrl.toString(),
        videoId: youtubeId,
        embedUrl: youtubeEmbed.toString()
      }
    }

    var douyinHosts = [
      'douyin.com',
      'www.douyin.com',
      'm.douyin.com',
      'www.iesdouyin.com',
      'open.douyin.com'
    ]
    if (douyinHosts.includes(url.hostname)) {
      var douyinId =
        url.searchParams.get('vid') ||
        url.pathname.match(/\/(?:share\/)?video\/(\d{15,22})/)?.[1] ||
        ''
      if (/^\d{15,22}$/.test(douyinId)) {
        var douyinEmbed = new URL('https://open.douyin.com/player/video')
        douyinEmbed.searchParams.set('vid', douyinId)
        douyinEmbed.searchParams.set('autoplay', '0')
        return {
          source: 'douyin',
          url: 'https://www.douyin.com/video/' + douyinId,
          videoId: douyinId,
          embedUrl: douyinEmbed.toString()
        }
      }
    }

    return null
  }

  function playIcon() {
    return document.querySelector('[data-highlight-icon="play"]')?.innerHTML || ''
  }

  function editIcon() {
    return document.querySelector('[data-highlight-icon="edit"]')?.innerHTML || ''
  }

  function trashIcon() {
    return document.querySelector('[data-highlight-icon="trash"]')?.innerHTML || ''
  }

  function initGameHighlights() {
    var elements = getElements()
    if (!elements.page || elements.page.dataset.highlightsInit === '1') return
    elements.page.dataset.highlightsInit = '1'

    var listenerController = new AbortController()
    var signal = listenerController.signal
    var previewObserver = null
    var searchTimer = 0
    var state = {
      highlights: readInitialHighlights(),
      gameFilter: 'all',
      tagFilter: 'all',
      searchQuery: '',
      visibleLimit: pageSize,
      busy: false,
      loading: true,
      libraryNotice: null,
      storageSummary: null,
      storageIssue: null,
      admin: false,
      editingId: null,
      playerHighlights: [],
      playerIndex: -1,
      lastFocused: null,
      durations: new Map()
    }
    state.storageSummary = buildStorageSummary(state.highlights)

    var profileMap = {}
    elements.filters.forEach(function (filter) {
      profileMap[filter.dataset.gameFilter] = {
        label: filter.dataset.gameLabel || filter.dataset.gameFilter || '',
        playerId: filter.dataset.playerId || ''
      }
    })

    function addListener(target, type, listener, options) {
      if (!target) return
      target.addEventListener(type, listener, { ...(options || {}), signal: signal })
    }

    function setStatus(message, type) {
      if (!elements.status) return
      elements.status.textContent = type === 'error' ? '' : message
      if (type === 'error') showToast(message, 'error')
    }

    function setBusy(busy) {
      state.busy = busy
      ;[
        elements.game,
        elements.gameTrigger,
        elements.url,
        elements.title,
        elements.description,
        elements.tags,
        elements.submit
      ].forEach(function (control) {
        if (
          control instanceof HTMLButtonElement ||
          control instanceof HTMLInputElement ||
          control instanceof HTMLTextAreaElement ||
          control instanceof HTMLSelectElement
        ) {
          control.disabled = busy
        }
      })
    }

    function getCaptureNumber(highlight) {
      var index = state.highlights.findIndex(function (item) {
        return item.id === highlight.id
      })
      return String(Math.max(1, state.highlights.length - Math.max(0, index))).padStart(4, '0')
    }

    function getHighlightTags(highlight) {
      return Array.isArray(highlight.tags)
        ? highlight.tags.filter(function (tag) {
            return typeof tag === 'string' && tag.trim()
          })
        : []
    }

    function getFilteredHighlights() {
      var query = state.searchQuery.trim().toLocaleLowerCase('zh-CN')
      return state.highlights.filter(function (highlight) {
        if (state.gameFilter !== 'all' && highlight.game !== state.gameFilter) return false
        var tags = getHighlightTags(highlight)
        if (
          state.tagFilter !== 'all' &&
          !tags.some(function (tag) {
            return tag.toLocaleLowerCase('zh-CN') === state.tagFilter
          })
        )
          return false
        if (!query) return true

        var profile = profileMap[highlight.game] || {}
        var haystack = [
          highlight.title,
          highlight.description,
          highlight.game,
          profile.label,
          profile.playerId,
          highlight.source,
          ...tags
        ]
          .join(' ')
          .toLocaleLowerCase('zh-CN')
        return haystack.includes(query)
      })
    }

    function renderPreviewMedia(highlight) {
      var reference = getVideoReference(highlight.url)
      var source = videoSourceProfiles[highlight.source]
        ? highlight.source
        : reference?.source || 'r2'
      var videoUrl = reference?.source === source ? reference.url : ''
      if (videoUrl && source === 'r2') {
        return (
          '<video class="capture-preview-video" data-preview-video data-highlight-id="' +
          escapeHtml(highlight.id) +
          '" ' +
          'data-src="' +
          escapeHtml(videoUrl) +
          '" preload="none"' +
          ' muted playsinline tabindex="-1" aria-hidden="true"></video>'
        )
      }

      return (
        '<span class="capture-external-preview" aria-hidden="true"><small>' +
        escapeHtml(videoUrl ? (state.admin ? '点击编辑' : '点击播放') : '视频暂不可用') +
        '</small></span>'
      )
    }

    function renderCard(highlight) {
      var duration = state.durations.get(highlight.id) || '--:--'
      var adminActions =
        state.admin && highlight.source !== 'r2'
          ? '<div class="capture-admin-actions"><button type="button" aria-label="删除外部录像" data-delete-highlight="' +
            escapeHtml(highlight.id) +
            '">' +
            trashIcon() +
            '删除</button></div>'
          : ''

      return (
        '<article class="capture-card game-video-card" data-game="' +
        escapeHtml(highlight.game) +
        '" data-source="' +
        escapeHtml(highlight.source) +
        '" data-highlight-id="' +
        escapeHtml(highlight.id) +
        '">' +
        '<button class="capture-card-media" type="button" ' +
        (state.admin
          ? 'data-edit-highlight="' + escapeHtml(highlight.id) + '" '
          : 'data-open-player ') +
        'data-highlight-id="' +
        escapeHtml(highlight.id) +
        '" aria-label="' +
        (state.admin ? '编辑 ' : '播放 ') +
        escapeHtml(highlight.title) +
        '">' +
        renderPreviewMedia(highlight) +
        '<span class="capture-card-shade" aria-hidden="true"></span>' +
        '<span class="capture-play-indicator' +
        (state.admin ? ' capture-edit-indicator' : '') +
        '" aria-hidden="true">' +
        (state.admin ? editIcon() : playIcon()) +
        '</span><span class="capture-duration" data-video-duration>' +
        escapeHtml(duration) +
        '</span>' +
        (highlight.date
          ? '<time class="capture-date" datetime="' +
            escapeHtml(highlight.date) +
            '">' +
            escapeHtml(formatDate(highlight.date)) +
            '</time>'
          : '') +
        '<span class="capture-playback-error" data-preview-error hidden><strong>预览暂不可用</strong><small>' +
        (state.admin ? '点击编辑录像' : '点击尝试播放') +
        '</small></span></button>' +
        adminActions +
        '</article>'
      )
    }

    function renderTags() {
      if (!elements.tagFilters) return
      var counts = new Map()
      state.highlights.forEach(function (highlight) {
        getHighlightTags(highlight).forEach(function (tag) {
          var normalized = tag.toLocaleLowerCase('zh-CN')
          var current = counts.get(normalized) || { label: tag, count: 0 }
          current.count += 1
          counts.set(normalized, current)
        })
      })
      if (state.tagFilter !== 'all' && !counts.has(state.tagFilter)) state.tagFilter = 'all'
      var tags = Array.from(counts.entries()).sort(function (left, right) {
        return (
          right[1].count - left[1].count || left[1].label.localeCompare(right[1].label, 'zh-CN')
        )
      })
      elements.tagFilters.innerHTML =
        '<button class="tag-filter' +
        (state.tagFilter === 'all' ? ' is-active' : '') +
        '" type="button" data-tag-filter="all" aria-pressed="' +
        String(state.tagFilter === 'all') +
        '">全部</button>' +
        tags
          .map(function (entry) {
            var active = state.tagFilter === entry[0]
            return (
              '<button class="tag-filter' +
              (active ? ' is-active' : '') +
              '" type="button" data-tag-filter="' +
              escapeHtml(entry[0]) +
              '" aria-pressed="' +
              String(active) +
              '">#' +
              escapeHtml(entry[1].label) +
              '</button>'
            )
          })
          .join('')
    }

    function renderLibraryStatus() {
      if (!elements.libraryStatus) return
      var notice = state.loading
        ? {
            code: 'SYNC / 01',
            title: '正在载入高光',
            message: '正在读取录像索引。',
            type: 'loading'
          }
        : state.libraryNotice

      elements.page.setAttribute('aria-busy', String(state.loading))
      elements.libraryStatus.hidden = !notice
      if (!notice) return
      elements.libraryStatus.classList.toggle('is-loading', notice.type === 'loading')
      elements.libraryStatus.classList.toggle('is-warning', notice.type === 'warning')
      elements.libraryStatus.classList.toggle('is-error', notice.type === 'error')
      if (elements.libraryStatusCode) elements.libraryStatusCode.textContent = notice.code
      if (elements.libraryStatusTitle) elements.libraryStatusTitle.textContent = notice.title
      if (elements.libraryStatusMessage) elements.libraryStatusMessage.textContent = notice.message
      if (elements.libraryRetry) elements.libraryRetry.hidden = notice.type !== 'error'
    }

    function getLibraryNotice(issue, hasHighlights) {
      if (!issue) return null
      if (issue === 'stale-cache')
        return {
          code: 'CACHE / ACTIVE',
          title: '正在显示缓存录像',
          message: '节点暂时不可达，现有录像仍可观看。',
          type: 'warning'
        }
      if (issue === 'metadata-invalid')
        return {
          code: 'INDEX / LOCKED',
          title: '录像索引暂不可用',
          message: '现有内容已进入只读保护状态。',
          type: 'error'
        }
      return {
        code: 'NODE / OFFLINE',
        title: hasHighlights ? '同步暂时中断' : '录像节点离线',
        message: hasHighlights
          ? '当前继续显示已有录像，可以稍后重试同步。'
          : '暂时无法读取录像，请稍后重试。',
        type: 'error'
      }
    }

    function renderStorageSummary(rawSummary) {
      var summary = rawSummary || buildStorageSummary(state.highlights)
      var capacityBytes = Number(summary.capacityBytes) || storageCapacityBytes
      var usedBytes = Math.max(0, Number(summary.usedBytes) || 0)
      var percentage = Math.max(0, Number(summary.percentage) || 0)
      var unknownVideoCount = Math.max(0, Number(summary.unknownVideoCount) || 0)
      var totalVideoCount = Math.max(0, Number(summary.totalVideoCount) || 0)
      var exceeded = Boolean(summary.exceeded) || usedBytes > capacityBytes
      if (elements.storageUsed)
        elements.storageUsed.textContent =
          formatBytes(usedBytes) + ' / ' + formatBytes(capacityBytes)
      if (elements.storagePercent)
        elements.storagePercent.textContent = unknownVideoCount
          ? '≥' + percentage.toFixed(1) + '%'
          : percentage.toFixed(percentage >= 1 ? 1 : 2) + '%'
      if (elements.storageProgress instanceof HTMLElement)
        elements.storageProgress.style.width = Math.min(100, percentage) + '%'
      if (elements.storageTrack)
        elements.storageTrack.setAttribute('aria-valuenow', Math.min(100, percentage).toFixed(2))
      if (elements.storageRemaining)
        elements.storageRemaining.textContent = exceeded
          ? '容量已超出建议额度'
          : '剩余 ' + formatBytes(Math.max(0, capacityBytes - usedBytes))
      if (elements.storageCount)
        elements.storageCount.textContent = String(totalVideoCount).padStart(3, '0')
      if (elements.systemSync)
        elements.systemSync.textContent = state.storageIssue ? 'DEGRADED' : 'ONLINE'
      if (elements.systemNode)
        elements.systemNode.textContent = state.storageIssue ? 'R2 / STANDBY' : 'R2 / ACTIVE'
      if (elements.storageMeter) {
        elements.storageMeter.classList.toggle(
          'is-warning',
          Boolean(state.storageIssue) || percentage >= 80 || unknownVideoCount > 0
        )
        elements.storageMeter.classList.toggle('is-exceeded', exceeded)
      }
      if (elements.storageWarning) {
        var showWarning =
          state.admin && (Boolean(state.storageIssue) || exceeded || unknownVideoCount > 0)
        elements.storageWarning.hidden = !showWarning
        elements.storageWarning.textContent = showWarning
          ? exceeded
            ? 'STORAGE WARNING — 录像存储已超出建议额度。'
            : state.storageIssue
              ? 'NODE NOTICE — 节点状态异常，请在部署平台检查存储配置。'
              : 'METADATA NOTICE — 部分录像容量信息尚未完成同步。'
          : ''
      }
    }

    function render() {
      var folderOverview =
        state.gameFilter === 'all' && state.tagFilter === 'all' && !state.searchQuery.trim()
      var filteredHighlights = getFilteredHighlights()
      var visibleHighlights = folderOverview ? [] : filteredHighlights.slice(0, state.visibleLimit)
      state.playerHighlights = filteredHighlights
      renderTags()
      renderLibraryStatus()
      renderStorageSummary(state.storageSummary)

      if (elements.folders) elements.folders.hidden = !folderOverview
      if (elements.folderHeading) elements.folderHeading.hidden = folderOverview
      elements.folderCounts.forEach(function (element) {
        var count = state.highlights.filter(function (highlight) {
          return highlight.game === element.dataset.folderCount
        }).length
        element.textContent = state.loading ? '载入中' : count + ' 段录像'
      })

      if (elements.list) {
        elements.list.hidden = folderOverview
        if (previewObserver) previewObserver.disconnect()
        elements.list.innerHTML = visibleHighlights
          .map(function (highlight) {
            return (
              '<div class="highlight-item" data-highlight-item data-game="' +
              escapeHtml(highlight.game) +
              '">' +
              renderCard(highlight) +
              '</div>'
            )
          })
          .join('')
        hydratePreviewVideos(elements.list)
      }

      if (elements.allEmpty)
        elements.allEmpty.hidden = state.loading || state.highlights.length !== 0
      if (elements.filterEmpty)
        elements.filterEmpty.hidden =
          state.loading || state.highlights.length === 0 || filteredHighlights.length > 0
      if (elements.loadMore)
        elements.loadMore.hidden = folderOverview || filteredHighlights.length <= state.visibleLimit
      if (elements.loadMoreCount)
        elements.loadMoreCount.textContent =
          '+' + String(Math.max(0, filteredHighlights.length - state.visibleLimit)).padStart(2, '0')

      elements.filters.forEach(function (button) {
        var filter = button.dataset.gameFilter || 'all'
        var count =
          filter === 'all'
            ? state.highlights.length
            : state.highlights.filter(function (highlight) {
                return highlight.game === filter
              }).length
        var active = filter === state.gameFilter
        button.classList.toggle('is-active', active)
        button.setAttribute('aria-pressed', String(active))
        button.disabled = filter !== 'all' && count === 0
      })
      elements.filterCounts.forEach(function (countElement) {
        var filter = countElement.dataset.filterCount || 'all'
        var count =
          filter === 'all'
            ? state.highlights.length
            : state.highlights.filter(function (highlight) {
                return highlight.game === filter
              }).length
        countElement.textContent = String(count).padStart(2, '0')
      })
      paintInteractions()
      loadInteractionStats()
      if (!state.admin && commentsList) {
        commentsList.querySelectorAll('[data-delete-comment]').forEach(function (button) {
          button.remove()
        })
      }
    }

    var interactionStats = new Map()
    var statsPending = new Set()
    var statsFailed = new Set()
    var likesPending = new Set()
    var commentsPanel = document.querySelector('[data-comments-panel]')
    var commentForm = document.querySelector('[data-comment-form]')
    var commentsList = document.querySelector('[data-comments-list]')
    var commentsStatus = document.querySelector('[data-comments-status]')
    var commentStatus = document.querySelector('[data-comment-status]')
    var commentsMore = document.querySelector('[data-comments-more]')
    var commentsRetry = document.querySelector('[data-comments-retry]')
    var commentsId = ''
    var commentsCursor = null
    var commentsVersion = 0
    var commentsTrigger = null
    var commentsBusy = false
    var commentDrafts = new Map()

    function renderInteractions(id) {
      var heart = document.querySelector('[data-highlight-icon="heart"]')?.innerHTML || ''
      var comment = document.querySelector('[data-highlight-icon="comment"]')?.innerHTML || ''
      return (
        '<div class="capture-interactions"><button type="button" data-like-highlight="' +
        escapeHtml(id) +
        '" aria-label="点赞这条高光" aria-pressed="false">' +
        heart +
        '<span data-like-count>—</span></button><button type="button" data-comment-highlight="' +
        escapeHtml(id) +
        '" aria-label="查看这条高光的评论">' +
        comment +
        '<span>评论</span><span data-comment-count>—</span></button></div>'
      )
    }

    async function interactionRequest(query, body, method) {
      var response = await fetch('/api/highlight-interactions' + query, {
        method: method || (body ? 'POST' : 'GET'),
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: signal
      })
      var data = await response.json()
      if (!response.ok) throw new Error(data.error || '互动暂时不可用，请稍后重试。')
      return data
    }

    function paintInteractions() {
      elements.page.querySelectorAll('[data-like-highlight]').forEach(function (button) {
        var id = button.dataset.likeHighlight
        var stats = interactionStats.get(id)
        button.setAttribute('aria-pressed', String(Boolean(stats?.liked)))
        button.setAttribute('aria-label', stats?.liked ? '已点赞这条高光' : '点赞这条高光')
        button.disabled = likesPending.has(id) || statsPending.has(id)
        button.querySelector('[data-like-count]').textContent = stats ? String(stats.likes) : '—'
      })
      elements.page.querySelectorAll('[data-comment-highlight]').forEach(function (button) {
        var stats = interactionStats.get(button.dataset.commentHighlight)
        button.querySelector('[data-comment-count]').textContent = stats
          ? String(stats.comments)
          : '—'
      })
    }

    async function loadInteractionStats() {
      var ids = Array.from(
        new Set(
          Array.from(elements.page.querySelectorAll('[data-like-highlight]'), function (button) {
            return button.dataset.likeHighlight
          })
        )
      ).filter(function (id) {
        return id && !interactionStats.has(id) && !statsPending.has(id) && !statsFailed.has(id)
      })
      if (!ids.length) return
      ids.forEach(function (id) {
        statsPending.add(id)
      })
      paintInteractions()
      try {
        for (var i = 0; i < ids.length; i += 24) {
          var data = await interactionRequest(
            '?ids=' +
              ids
                .slice(i, i + 24)
                .map(encodeURIComponent)
                .join(',')
          )
          Object.entries(data.stats).forEach(function (entry) {
            if (!interactionStats.has(entry[0])) interactionStats.set(entry[0], entry[1])
          })
        }
        paintInteractions()
      } catch (error) {
        ids.forEach(function (id) {
          statsFailed.add(id)
        })
        if (!signal.aborted) {
          document.querySelector('[data-interaction-status]').textContent = error.message
          document.querySelector('[data-interaction-retry]').hidden = false
        }
      } finally {
        ids.forEach(function (id) {
          statsPending.delete(id)
        })
        paintInteractions()
      }
    }

    async function likeHighlight(id) {
      if (likesPending.has(id) || interactionStats.get(id)?.liked) return
      likesPending.add(id)
      paintInteractions()
      var status = document.querySelector('[data-interaction-status]')
      var playerStatus = document.querySelector('[data-player-interaction-status]')
      try {
        var stats = await interactionRequest('', { id: id, action: 'like' })
        interactionStats.set(id, stats)
        status.textContent = ''
        if (playerStatus) playerStatus.textContent = ''
        showToast('已点赞，谢谢喜欢。')
      } catch (error) {
        if (!signal.aborted) {
          status.textContent = ''
          if (playerStatus) playerStatus.textContent = ''
          showToast(error.message, 'error')
        }
      } finally {
        likesPending.delete(id)
        paintInteractions()
      }
    }

    function renderComments(comments, append) {
      var html = comments
        .map(function (comment) {
          return (
            '<li><header><strong>' +
            escapeHtml(comment.nickname) +
            '</strong><time datetime="' +
            escapeHtml(comment.createdAt) +
            '">' +
            escapeHtml(new Date(comment.createdAt).toLocaleString('zh-CN')) +
            '</time></header><p>' +
            escapeHtml(comment.content) +
            '</p>' +
            (state.admin
              ? '<button type="button" data-delete-comment="' +
                escapeHtml(comment.id) +
                '">删除评论</button>'
              : '') +
            '</li>'
          )
        })
        .join('')
      if (append) commentsList.insertAdjacentHTML('beforeend', html)
      else commentsList.innerHTML = html
    }

    async function loadComments(append) {
      var id = commentsId
      var version = ++commentsVersion
      commentsStatus.textContent = '正在加载评论…'
      commentsMore.disabled = true
      commentsRetry.hidden = true
      try {
        var data = await interactionRequest(
          '?id=' +
            encodeURIComponent(id) +
            (append && commentsCursor ? '&before=' + encodeURIComponent(commentsCursor) : '')
        )
        if (version !== commentsVersion) return
        renderComments(data.comments, append)
        commentsCursor = data.next
        commentsMore.hidden = !data.next
        commentsStatus.textContent = commentsList.children.length
          ? ''
          : '还没有评论，来聊聊这个瞬间吧。'
      } catch (error) {
        if (version !== commentsVersion || signal.aborted) return
        commentsStatus.textContent = error.message
        commentsRetry.hidden = false
      } finally {
        if (version === commentsVersion) commentsMore.disabled = false
      }
    }

    function openComments(id, trigger) {
      var highlight = state.highlights.find(function (item) {
        return item.id === id
      })
      if (!highlight || commentsBusy) return
      if (commentsId) commentDrafts.set(commentsId, commentForm.elements.content.value)
      if (elements.playerModal && !elements.playerModal.hidden) setPlayerOpen(false, false, true)
      commentsId = id
      commentsTrigger = trigger
      commentsCursor = null
      commentsPanel.hidden = false
      commentsList.replaceChildren()
      commentsMore.hidden = true
      commentStatus.textContent = ''
      document.querySelector('[data-comments-capture]').textContent = highlight.title
      commentForm.reset()
      commentForm.elements.content.value = commentDrafts.get(id) || ''
      try {
        commentForm.elements.nickname.value = localStorage.getItem('highlight-nickname') || ''
      } catch {
        /* Storage is optional. */
      }
      loadComments(false)
      commentsPanel.scrollIntoView({ block: 'start', behavior: 'instant' })
      document.querySelector('#highlight-comments-title').focus({ preventScroll: true })
    }

    addListener(elements.page, 'click', function (event) {
      if (!(event.target instanceof Element)) return
      var like = event.target.closest('[data-like-highlight]')
      if (like) {
        likeHighlight(like.dataset.likeHighlight)
        return
      }
      var comment = event.target.closest('[data-comment-highlight]')
      if (comment) {
        openComments(comment.dataset.commentHighlight, comment)
        return
      }
      var remove = event.target.closest('[data-delete-comment]')
      if (remove && state.admin && !commentsBusy) {
        if (!window.confirm('删除这条评论？')) return
        var id = commentsId
        remove.disabled = true
        interactionRequest(
          '',
          { id: id, commentId: remove.dataset.deleteComment, passcode: getSessionPasscode() },
          'DELETE'
        )
          .then(function (data) {
            interactionStats.set(id, data.stats)
            paintInteractions()
            if (commentsId === id) loadComments(false)
            if (!signal.aborted) showToast('评论已删除。')
          })
          .catch(function (error) {
            if (!signal.aborted) {
              commentStatus.textContent = ''
              showToast(error.message, 'error')
            }
          })
          .finally(function () {
            remove.disabled = false
          })
      }
    })
    addListener(document.querySelector('[data-close-comments]'), 'click', function () {
      commentsPanel.hidden = true
      commentsVersion += 1
      if (commentsTrigger?.isConnected && commentsTrigger.getClientRects().length)
        commentsTrigger.focus()
      else elements.search?.focus()
    })
    addListener(document.querySelector('[data-interaction-retry]'), 'click', function () {
      statsFailed.clear()
      document.querySelector('[data-interaction-status]').textContent = ''
      document.querySelector('[data-interaction-retry]').hidden = true
      loadInteractionStats()
    })
    addListener(commentsMore, 'click', function () {
      loadComments(true)
    })
    addListener(commentsRetry, 'click', function () {
      loadComments(false)
    })
    addListener(commentForm, 'submit', async function (event) {
      event.preventDefault()
      if (!commentsId || commentsBusy) return
      var id = commentsId
      var button = commentForm.querySelector('[type="submit"]')
      commentsBusy = true
      button.disabled = true
      commentStatus.textContent = '正在发表…'
      try {
        var data = await interactionRequest('', {
          id: id,
          action: 'comment',
          nickname: commentForm.elements.nickname.value,
          content: commentForm.elements.content.value,
          website: commentForm.elements.website.value
        })
        interactionStats.set(id, data.stats)
        paintInteractions()
        try {
          localStorage.setItem('highlight-nickname', commentForm.elements.nickname.value.trim())
        } catch {
          /* Storage is optional. */
        }
        commentForm.elements.content.value = ''
        commentDrafts.delete(id)
        commentStatus.textContent = ''
        showToast('评论已发表。')
        await loadComments(false)
      } catch (error) {
        if (!signal.aborted) {
          commentStatus.textContent = ''
          showToast(error.message, 'error')
        }
      } finally {
        commentsBusy = false
        button.disabled = false
      }
    })

    function hydratePreviewVideos(scope) {
      if (!(scope instanceof Element)) return
      scope.querySelectorAll('[data-preview-video]').forEach(function (video) {
        if (!(video instanceof HTMLVideoElement) || video.dataset.previewBound === '1') return
        video.dataset.previewBound = '1'
        var highlightId = video.dataset.highlightId || ''
        addListener(video, 'loadedmetadata', function () {
          var duration = formatDuration(video.duration)
          if (highlightId) state.durations.set(highlightId, duration)
          video
            .closest('.capture-card, .featured-capture')
            ?.querySelectorAll('[data-video-duration]')
            .forEach(function (element) {
              element.textContent = duration
            })
          if (video.currentTime === 0 && video.duration > 0.2) {
            try {
              video.currentTime = 0.1
            } catch {
              /* Some browsers disallow seeking before data is ready. */
            }
          }
        })
        addListener(video, 'error', function () {
          var errorState = video
            .closest('.capture-card-media, .featured-media')
            ?.querySelector('[data-preview-error]')
          if (errorState) errorState.hidden = false
        })
        if (video.dataset.src) {
          if (previewObserver) previewObserver.observe(video)
          else {
            video.src = video.dataset.src
            video.removeAttribute('data-src')
            video.load()
          }
        }
      })
    }

    function applyLibraryData(data) {
      if (!Array.isArray(data.highlights)) return false
      state.highlights = data.highlights
      state.storageSummary = data.storageSummary || buildStorageSummary(state.highlights)
      state.storageIssue = data.storageIssue || null
      state.visibleLimit = pageSize
      return true
    }

    async function loadHighlights(force) {
      state.loading = true
      state.libraryNotice = null
      renderLibraryStatus()
      var controller = new AbortController()
      var timeout = window.setTimeout(function () {
        controller.abort()
      }, 12000)
      try {
        var response = await fetch(
          '/api/game-highlights' + (force ? '?refresh=' + Date.now() : ''),
          {
            cache: force ? 'no-store' : 'default',
            signal: controller.signal
          }
        )
        var data = await response.json().catch(function () {
          return {}
        })
        if (!response.ok || !applyLibraryData(data)) throw new Error('library unavailable')
        state.loading = false
        state.libraryNotice =
          data.storageAvailable === false
            ? getLibraryNotice(state.storageIssue || 'r2-unavailable', state.highlights.length > 0)
            : null
        render()
      } catch {
        state.loading = false
        state.libraryNotice = getLibraryNotice('r2-unavailable', state.highlights.length > 0)
        render()
      } finally {
        window.clearTimeout(timeout)
      }
    }

    function setAdminMode(active) {
      state.admin = Boolean(active)
      elements.page.dataset.adminMode = state.admin ? 'admin' : 'visitor'
      elements.adminOnly.forEach(function (element) {
        element.hidden = !state.admin
      })
      if (elements.adminTrigger) elements.adminTrigger.hidden = state.admin
      if (elements.passcode instanceof HTMLInputElement)
        elements.passcode.value = state.admin ? getSessionPasscode() : ''
      render()
      if (commentsId && commentsPanel && !commentsPanel.hidden) loadComments(false)
    }

    function setAdminGateOpen(open, immediate = false) {
      if (!elements.adminGate) return
      if (!open) {
        if (elements.adminGate.hidden) return
        closeWithMotion(
          elements.adminGate,
          function () {
            elements.adminGate.hidden = true
            placeToast()
            document.documentElement.classList.remove('replay-modal-open')
            if (state.lastFocused instanceof HTMLElement) state.lastFocused.focus()
          },
          immediate
        )
        return
      }
      elements.adminGate.hidden = !open
      placeToast()
      document.documentElement.classList.toggle('replay-modal-open', open)
      if (open) {
        state.lastFocused = document.activeElement
        if (elements.adminLoginStatus) elements.adminLoginStatus.textContent = ''
        window.requestAnimationFrame(function () {
          elements.adminPasscode?.focus()
        })
      }
    }

    async function verifyAdmin(passcode, silent) {
      if (!passcode) return false
      if (elements.adminLoginStatus && !silent)
        elements.adminLoginStatus.textContent = 'VERIFYING SESSION...'
      try {
        var response = await fetch('/api/game-highlights', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'verify', passcode: passcode })
        })
        if (!response.ok) {
          if (elements.adminLoginStatus && !silent) {
            elements.adminLoginStatus.textContent = ''
            showToast(
              response.status === 503 ? '管理入口暂不可用，请稍后重试。' : '管理口令无效。',
              'error'
            )
          }
          return false
        }
        rememberPasscode(passcode)
        setAdminMode(true)
        setAdminGateOpen(false)
        if (!silent) showToast('已进入管理模式。')
        return true
      } catch {
        if (elements.adminLoginStatus && !silent) {
          elements.adminLoginStatus.textContent = ''
          showToast('暂时无法验证，请稍后重试。', 'error')
        }
        return false
      }
    }

    function setGameSelectOpen(open, focusSelected) {
      if (
        !(elements.gameTrigger instanceof HTMLButtonElement) ||
        !(elements.gameOptionsPanel instanceof HTMLElement)
      )
        return
      var nextOpen = Boolean(open) && !elements.gameTrigger.disabled
      elements.gameTrigger.setAttribute('aria-expanded', String(nextOpen))
      elements.gameOptionsPanel.hidden = !nextOpen
      elements.gameSelect?.classList.toggle('is-open', nextOpen)
      if (nextOpen && focusSelected) {
        window.requestAnimationFrame(function () {
          var selected = Array.from(elements.gameOptionButtons).find(function (option) {
            return option.getAttribute('aria-selected') === 'true'
          })
          ;(selected || elements.gameOptionButtons[0])?.focus()
        })
      }
    }

    function focusGameOption(index) {
      var options = Array.from(elements.gameOptionButtons)
      if (!options.length) return
      var normalizedIndex = (index + options.length) % options.length
      options[normalizedIndex]?.focus()
    }

    function syncSelectedGame() {
      if (!(elements.game instanceof HTMLSelectElement)) return
      var selected = elements.game.options[elements.game.selectedIndex]
      if (!selected) return
      if (elements.gameTriggerCode)
        elements.gameTriggerCode.textContent = selected.dataset.shortLabel || ''
      if (elements.gameTriggerLabel)
        elements.gameTriggerLabel.textContent = selected.textContent?.trim() || ''
      if (elements.gameTriggerPlayerId)
        elements.gameTriggerPlayerId.textContent = selected.dataset.playerId || ''
      elements.gameOptionButtons.forEach(function (option) {
        var isSelected = option.dataset.gameValue === elements.game.value
        option.classList.toggle('is-selected', isSelected)
        option.setAttribute('aria-selected', String(isSelected))
      })
    }

    function resetEditor() {
      state.editingId = null
      elements.form?.reset()
      if (elements.highlightId instanceof HTMLInputElement) elements.highlightId.value = ''
      if (elements.url instanceof HTMLInputElement) {
        elements.url.disabled = false
        elements.url.required = true
      }
      if (elements.urlField) elements.urlField.hidden = false
      if (elements.editorModeLabel) elements.editorModeLabel.textContent = '外部来源'
      if (elements.editorModeTitle) elements.editorModeTitle.textContent = '添加外部录像'
      if (elements.editorSubmit) elements.editorSubmit.textContent = '保存录像'
      setStatus('', '')
      syncSelectedGame()
    }

    function setEditorOpen(open, returnFocus, immediate = false) {
      if (!elements.editor) return
      if (!open) {
        if (elements.editor.hidden) return
        setGameSelectOpen(false, false)
        closeWithMotion(
          elements.editor,
          function () {
            elements.editor.hidden = true
            placeToast()
            document.documentElement.classList.remove('replay-modal-open')
            if (elements.addToggle) elements.addToggle.setAttribute('aria-expanded', 'false')
            if (returnFocus && state.lastFocused instanceof HTMLElement) state.lastFocused.focus()
            resetEditor()
          },
          immediate
        )
        return
      }
      elements.editor.hidden = !open
      placeToast()
      document.documentElement.classList.toggle('replay-modal-open', open)
      if (elements.addToggle) elements.addToggle.setAttribute('aria-expanded', String(open))
      if (open) {
        state.lastFocused = document.activeElement
        window.requestAnimationFrame(function () {
          elements.gameTrigger?.focus()
        })
      }
    }

    function openEditorFor(highlight) {
      if (!state.admin) return
      state.editingId = highlight.id
      if (elements.highlightId instanceof HTMLInputElement)
        elements.highlightId.value = highlight.id
      if (elements.game instanceof HTMLSelectElement) elements.game.value = highlight.game
      if (elements.url instanceof HTMLInputElement) {
        elements.url.value = highlight.url || ''
        elements.url.disabled = true
        elements.url.required = false
      }
      if (elements.urlField) elements.urlField.hidden = true
      if (elements.title instanceof HTMLInputElement) elements.title.value = highlight.title || ''
      if (elements.description instanceof HTMLTextAreaElement)
        elements.description.value = highlight.description || ''
      if (elements.tags instanceof HTMLInputElement)
        elements.tags.value = getHighlightTags(highlight).join(', ')
      if (elements.editorModeLabel) elements.editorModeLabel.textContent = '编辑录像'
      if (elements.editorModeTitle) elements.editorModeTitle.textContent = '编辑录像信息'
      if (elements.editorSubmit) elements.editorSubmit.textContent = '保存修改'
      syncSelectedGame()
      setEditorOpen(true, false)
    }

    async function submitHighlight(event) {
      event.preventDefault()
      if (state.busy || !state.admin) return
      var passcode = getSessionPasscode()
      var game = elements.game instanceof HTMLSelectElement ? elements.game.value : ''
      var url = elements.url instanceof HTMLInputElement ? elements.url.value.trim() : ''
      var title = elements.title instanceof HTMLInputElement ? elements.title.value.trim() : ''
      var description =
        elements.description instanceof HTMLTextAreaElement ? elements.description.value.trim() : ''
      var tags =
        elements.tags instanceof HTMLInputElement
          ? elements.tags.value
              .split(',')
              .map(function (tag) {
                return tag.trim()
              })
              .filter(Boolean)
          : []
      if (!state.editingId) {
        var reference = getVideoReference(url)
        if (!reference || reference.source === 'r2' || !reference.embedUrl) {
          setStatus('请输入受支持的哔哩哔哩、YouTube 或抖音视频链接。', 'error')
          elements.url?.focus()
          return
        }
      }

      setBusy(true)
      setStatus(state.editingId ? '正在更新录像信息…' : '正在写入录像索引…', '')
      try {
        var response = await fetch('/api/game-highlights', {
          method: state.editingId ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(
            state.editingId
              ? {
                  id: state.editingId,
                  game: game,
                  title: title,
                  description: description,
                  tags: tags,
                  passcode: passcode
                }
              : {
                  game: game,
                  url: url,
                  title: title,
                  description: description,
                  tags: tags,
                  passcode: passcode
                }
          )
        })
        var data = await response.json().catch(function () {
          return {}
        })
        if (!response.ok || !applyLibraryData(data)) {
          if (response.status === 401) {
            forgetPasscode()
            setAdminMode(false)
            throw new Error('管理员会话已失效，请重新验证。')
          }
          throw new Error(
            response.status === 503 ? '管理写入服务暂不可用。' : '录像保存失败，请检查输入后重试。'
          )
        }
        setStatus('', '')
        showToast('录像信息已保存。')
        render()
        window.setTimeout(function () {
          setEditorOpen(false, false)
        }, 350)
      } catch (error) {
        setStatus(error instanceof Error ? error.message : '录像保存失败，请稍后重试。', 'error')
      } finally {
        setBusy(false)
      }
    }

    async function deleteHighlight(highlight) {
      if (!state.admin || highlight.source === 'r2') return
      if (!window.confirm('确认删除这条外链录像记录？此操作无法撤销。')) return
      try {
        var response = await fetch('/api/game-highlights', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: highlight.id, passcode: getSessionPasscode() })
        })
        var data = await response.json().catch(function () {
          return {}
        })
        if (!response.ok || !applyLibraryData(data)) throw new Error('删除失败，请稍后重试。')
        render()
        showToast('录像记录已删除。')
      } catch (error) {
        showToast(error instanceof Error ? error.message : '删除失败，请稍后重试。', 'error')
      }
    }

    async function syncAdminLibrary() {
      if (!state.admin || state.busy) return
      state.busy = true
      if (elements.adminSync instanceof HTMLButtonElement) elements.adminSync.disabled = true
      try {
        var response = await fetch('/api/game-highlights', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'sync', passcode: getSessionPasscode() })
        })
        var data = await response.json().catch(function () {
          return {}
        })
        if (!response.ok || !applyLibraryData(data)) throw new Error('同步失败')
        state.libraryNotice = null
        render()
        showToast('录像索引已同步。')
      } catch {
        state.libraryNotice = getLibraryNotice('r2-unavailable', state.highlights.length > 0)
        renderLibraryStatus()
        showToast('同步失败，请稍后重试。', 'error')
      } finally {
        state.busy = false
        if (elements.adminSync instanceof HTMLButtonElement) elements.adminSync.disabled = false
      }
    }

    function setPlayerOpen(open, returnFocus, immediate = false) {
      if (!elements.playerModal) return
      if (!open) {
        if (elements.playerModal.hidden) return
        var video = elements.playerStage?.querySelector('video')
        if (video instanceof HTMLVideoElement) video.pause()
        closeWithMotion(
          elements.playerModal,
          function () {
            elements.playerModal.hidden = true
            placeToast()
            document.documentElement.classList.remove('replay-modal-open')
            elements.playerStage?.replaceChildren()
            if (returnFocus && state.lastFocused instanceof HTMLElement) state.lastFocused.focus()
            state.playerIndex = -1
          },
          immediate
        )
        return
      }
      elements.playerModal.hidden = !open
      placeToast()
      document.documentElement.classList.toggle('replay-modal-open', open)
    }

    function renderPlayer() {
      var highlight = state.playerHighlights[state.playerIndex]
      if (!highlight || !elements.playerStage) return
      document.querySelector('[data-player-interactions]').innerHTML =
        renderInteractions(highlight.id) +
        '<p class="interaction-status" data-player-interaction-status role="status" aria-live="polite"></p>'
      paintInteractions()
      loadInteractionStats()
      var reference = getVideoReference(highlight.url)
      var captureNumber = getCaptureNumber(highlight)
      var game = profileMap[highlight.game]?.label || highlight.game || 'GAME'
      if (elements.playerTitle) elements.playerTitle.textContent = highlight.title || '游戏精彩时刻'
      if (elements.playerCaptureNumber)
        elements.playerCaptureNumber.textContent = 'CAPTURE // ' + captureNumber
      if (elements.playerGame) elements.playerGame.textContent = game
      if (elements.playerDate) elements.playerDate.textContent = formatDate(highlight.date)
      if (elements.playerTags)
        elements.playerTags.innerHTML = getHighlightTags(highlight)
          .map(function (tag) {
            return '<li>#' + escapeHtml(tag) + '</li>'
          })
          .join('')
      if (elements.playerPrevious instanceof HTMLButtonElement)
        elements.playerPrevious.disabled = state.playerIndex <= 0
      if (elements.playerNext instanceof HTMLButtonElement)
        elements.playerNext.disabled = state.playerIndex >= state.playerHighlights.length - 1

      if (reference?.source === 'r2') {
        elements.playerStage.innerHTML =
          '<media-theme-yt class="modal-yt-player"><video slot="media" class="modal-video self-hosted-video" src="' +
          escapeHtml(reference.url) +
          '" autoplay preload="metadata" playsinline aria-label="' +
          escapeHtml(highlight.title) +
          '">你的浏览器不支持 HTML5 视频播放。</video></media-theme-yt><div class="player-error" data-player-error hidden><strong>PLAYBACK ERROR</strong><span>Capture source unavailable.</span><button type="button" data-player-retry>RETRY</button></div>'
        var video = elements.playerStage.querySelector('video')
        if (video instanceof HTMLVideoElement) {
          video.controls = !window.customElements?.get('media-theme-yt')
          loadPlayerTheme().then(function () {
            if (video.isConnected && window.customElements?.get('media-theme-yt'))
              video.controls = false
          })
          addListener(video, 'error', function () {
            var errorState = elements.playerStage?.querySelector('[data-player-error]')
            if (errorState) errorState.hidden = false
          })
        }
      } else if (reference?.embedUrl) {
        var embedUrl = new URL(reference.embedUrl)
        if (reference.source === 'youtube') embedUrl.searchParams.set('autoplay', '1')
        elements.playerStage.innerHTML =
          '<iframe class="modal-video-frame" src="' +
          escapeHtml(embedUrl.toString()) +
          '" title="' +
          escapeHtml(highlight.title) +
          '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>'
      } else {
        elements.playerStage.innerHTML =
          '<div class="player-error"><strong>PLAYBACK ERROR</strong><span>Capture source unavailable.</span></div>'
      }
    }

    function openPlayer(highlightId, trigger) {
      var index = state.playerHighlights.findIndex(function (highlight) {
        return highlight.id === highlightId
      })
      if (index < 0) {
        state.playerHighlights = state.highlights
        index = state.playerHighlights.findIndex(function (highlight) {
          return highlight.id === highlightId
        })
      }
      if (index < 0) return
      state.playerIndex = index
      state.lastFocused = trigger || document.activeElement
      setPlayerOpen(true, false)
      renderPlayer()
      window.requestAnimationFrame(function () {
        elements.playerModal?.querySelector('.player-modal-head [data-close-player]')?.focus()
      })
    }

    function getFocusable(container) {
      if (!(container instanceof HTMLElement)) return []
      return Array.from(
        container.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(function (control) {
        return (
          control instanceof HTMLElement && !control.hidden && control.getClientRects().length > 0
        )
      })
    }

    function trapFocus(container, event) {
      var focusable = getFocusable(container)
      if (!focusable.length) {
        event.preventDefault()
        return
      }
      var first = focusable[0]
      var last = focusable[focusable.length - 1]
      var active = document.activeElement
      if (!container.contains(active) || !focusable.includes(active)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    previewObserver =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            function (entries) {
              entries.forEach(function (entry) {
                if (!entry.isIntersecting || !(entry.target instanceof HTMLVideoElement)) return
                var video = entry.target
                if (video.dataset.src) {
                  video.src = video.dataset.src
                  video.removeAttribute('data-src')
                  video.load()
                }
                previewObserver?.unobserve(video)
              })
            },
            { rootMargin: '240px 0px' }
          )
        : null

    addListener(elements.adminTrigger, 'click', function () {
      setAdminGateOpen(true)
    })
    elements.closeAdminGateButtons.forEach(function (button) {
      addListener(button, 'click', function () {
        setAdminGateOpen(false)
      })
    })
    addListener(elements.adminLoginForm, 'submit', function (event) {
      event.preventDefault()
      var passcode =
        elements.adminPasscode instanceof HTMLInputElement
          ? elements.adminPasscode.value.trim()
          : ''
      verifyAdmin(passcode, false)
    })
    addListener(elements.adminLogout, 'click', function () {
      forgetPasscode()
      setAdminMode(false)
    })
    addListener(elements.adminSync, 'click', syncAdminLibrary)
    addListener(elements.addToggle, 'click', function () {
      if (!state.admin) return
      resetEditor()
      setEditorOpen(true, false)
    })
    elements.closeEditorButtons.forEach(function (button) {
      addListener(button, 'click', function () {
        setEditorOpen(false, true)
      })
    })
    addListener(elements.form, 'submit', submitHighlight)
    addListener(elements.game, 'change', syncSelectedGame)
    addListener(elements.gameTrigger, 'click', function () {
      setGameSelectOpen(elements.gameTrigger?.getAttribute('aria-expanded') !== 'true', true)
    })
    addListener(elements.gameTrigger, 'keydown', function (event) {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      var options = Array.from(elements.gameOptionButtons)
      var selectedIndex = options.findIndex(function (option) {
        return option.getAttribute('aria-selected') === 'true'
      })
      setGameSelectOpen(true, false)
      window.requestAnimationFrame(function () {
        if (event.key === 'Home') focusGameOption(0)
        else if (event.key === 'End') focusGameOption(options.length - 1)
        else focusGameOption(selectedIndex + (event.key === 'ArrowDown' ? 1 : -1))
      })
    })
    elements.gameOptionButtons.forEach(function (option) {
      addListener(option, 'click', function () {
        if (elements.game instanceof HTMLSelectElement) {
          elements.game.value = option.dataset.gameValue || ''
          syncSelectedGame()
          setGameSelectOpen(false, false)
          elements.gameTrigger?.focus()
        }
      })
      addListener(option, 'keydown', function (event) {
        var options = Array.from(elements.gameOptionButtons)
        var index = options.indexOf(option)
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          focusGameOption(index + (event.key === 'ArrowDown' ? 1 : -1))
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault()
          focusGameOption(event.key === 'Home' ? 0 : options.length - 1)
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          option.click()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          setGameSelectOpen(false, false)
          elements.gameTrigger?.focus()
        }
      })
    })
    elements.filters.forEach(function (button) {
      addListener(button, 'click', function () {
        state.gameFilter = button.dataset.gameFilter || 'all'
        state.visibleLimit = pageSize
        render()
      })
    })
    elements.folderButtons.forEach(function (button) {
      addListener(button, 'click', function () {
        state.gameFilter = button.dataset.captureFolder
        state.visibleLimit = pageSize
        render()
        elements.folderBack?.focus()
      })
    })
    addListener(elements.folderBack, 'click', function () {
      var previousGame = state.gameFilter
      state.gameFilter = 'all'
      state.tagFilter = 'all'
      state.searchQuery = ''
      state.visibleLimit = pageSize
      if (elements.search instanceof HTMLInputElement) elements.search.value = ''
      render()
      var previousFolder = Array.from(elements.folderButtons).find(function (button) {
        return button.dataset.captureFolder === previousGame
      })
      ;(previousFolder || elements.folderButtons[0])?.focus()
    })
    addListener(elements.tagFilters, 'click', function (event) {
      if (!(event.target instanceof Element)) return
      var button = event.target.closest('[data-tag-filter]')
      if (!button) return
      state.tagFilter = button.dataset.tagFilter || 'all'
      state.visibleLimit = pageSize
      render()
    })
    addListener(elements.search, 'input', function () {
      window.clearTimeout(searchTimer)
      searchTimer = window.setTimeout(function () {
        state.searchQuery = elements.search instanceof HTMLInputElement ? elements.search.value : ''
        state.visibleLimit = pageSize
        render()
      }, 120)
    })
    elements.clearFiltersButtons.forEach(function (button) {
      addListener(button, 'click', function () {
        state.gameFilter = 'all'
        state.tagFilter = 'all'
        state.searchQuery = ''
        state.visibleLimit = pageSize
        if (elements.search instanceof HTMLInputElement) elements.search.value = ''
        render()
      })
    })
    addListener(elements.loadMore, 'click', function () {
      state.visibleLimit += pageSize
      render()
    })
    addListener(elements.libraryRetry, 'click', function () {
      loadHighlights(true)
    })
    addListener(elements.list, 'click', function (event) {
      if (!(event.target instanceof Element)) return
      var playButton = event.target.closest('[data-open-player]')
      if (playButton) {
        openPlayer(playButton.dataset.highlightId || '', playButton)
        return
      }
      var editButton = event.target.closest('[data-edit-highlight]')
      if (editButton) {
        var editHighlight = state.highlights.find(function (highlight) {
          return highlight.id === editButton.dataset.editHighlight
        })
        if (editHighlight) openEditorFor(editHighlight)
        return
      }
      var deleteButton = event.target.closest('[data-delete-highlight]')
      if (deleteButton) {
        var deleteTarget = state.highlights.find(function (highlight) {
          return highlight.id === deleteButton.dataset.deleteHighlight
        })
        if (deleteTarget) deleteHighlight(deleteTarget)
      }
    })
    elements.closePlayerButtons.forEach(function (button) {
      addListener(button, 'click', function () {
        setPlayerOpen(false, true)
      })
    })
    addListener(elements.playerPrevious, 'click', function () {
      if (state.playerIndex > 0) {
        state.playerIndex -= 1
        renderPlayer()
      }
    })
    addListener(elements.playerNext, 'click', function () {
      if (state.playerIndex + 1 < state.playerHighlights.length) {
        state.playerIndex += 1
        renderPlayer()
      }
    })
    addListener(elements.playerStage, 'click', function (event) {
      if (!(event.target instanceof Element)) return
      var retry = event.target.closest('[data-player-retry]')
      if (retry) renderPlayer()
    })
    addListener(document, 'pointerdown', function (event) {
      if (
        elements.gameSelect?.classList.contains('is-open') &&
        event.target instanceof Node &&
        !elements.gameSelect.contains(event.target)
      )
        setGameSelectOpen(false, false)
    })
    addListener(document, 'keydown', function (event) {
      var target = event.target
      var isTextInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        elements.search?.focus()
        return
      }
      if (elements.playerModal && !elements.playerModal.hidden) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setPlayerOpen(false, true)
          return
        }
        if (event.key === 'Tab') {
          trapFocus(elements.playerModal, event)
          return
        }
        if (event.key === ' ' && !isTextInput && !(target instanceof HTMLButtonElement)) {
          var video = elements.playerStage?.querySelector('video')
          if (video instanceof HTMLVideoElement) {
            event.preventDefault()
            if (video.paused) video.play().catch(function () {})
            else video.pause()
          }
        }
        return
      }
      if (elements.editor && !elements.editor.hidden) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setEditorOpen(false, true)
          return
        }
        if (event.key === 'Tab') trapFocus(elements.editor, event)
        return
      }
      if (elements.adminGate && !elements.adminGate.hidden) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setAdminGateOpen(false)
          return
        }
        if (event.key === 'Tab') trapFocus(elements.adminGate, event)
      }
    })

    setAdminMode(false)
    resetEditor()
    render()
    loadHighlights(false)
    var savedPasscode = getSessionPasscode()
    if (savedPasscode) verifyAdmin(savedPasscode, true)

    cleanupCurrentPage = function () {
      window.clearTimeout(searchTimer)
      previewObserver?.disconnect()
      listenerController.abort()
      setPlayerOpen(false, false, true)
      setEditorOpen(false, false, true)
      setAdminGateOpen(false, true)
      elements.page.dataset.highlightsInit = '0'
    }
  }

  function schedule() {
    if (initPending) return
    initPending = true
    requestAnimationFrame(function () {
      initPending = false
      initGameHighlights()
    })
  }

  function cleanup() {
    cleanupCurrentPage()
    cleanupCurrentPage = function () {}
  }

  window.__gameHighlightsController = { schedule: schedule, cleanup: cleanup }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', schedule, { once: true })
  else schedule()
  document.addEventListener('astro:after-swap', schedule)
  document.addEventListener('astro:page-load', schedule)
  document.addEventListener('astro:before-swap', cleanup)
})()
