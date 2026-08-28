// pages/guest/view/view.js — 来宾视角：完整请柬页面
const app = getApp()
const { preloadImages } = require('../../../utils/util.js')

Page({
  data: {
    inv: '',
    invitation: null,
    loading: true,
    markers: [],

    // 倒计时
    countdown: { days: 0, hours: 0, minutes: 0, seconds: 0, finished: false },

    // 婚纱照
    photoIdx: 0,

    // RSVP
    rsvpForm: {
      name: '',
      phone: '',
      attending: '',
      guestCount: 1,
      dietary: ''
    },
    guestCountOptions: ['1人', '2人', '3人', '4人', '5人', '6人', '7人', '8人', '9人', '10人'],
    guestCountIndex: 0,
    rsvpSubmitting: false,
    rsvpSubmitted: false,

    // 祝福墙
    blessingText: '',
    canSend: false,
    userAvatar: '',  // 微信头像临时路径
    blessingCount: 0,
    blessingsLoading: true,
    blessingList: [],
    blessingPage: 0,
    blessingPageSize: 6,
    blessingPageStart: 0,
    blessingPageEnd: 6,
    blessingTotalPages: 0,
    blessingPageNumbers: [],

    // 音乐
    playing: false,
    musicStarted: false,
    showMusicBtn: true,

    // 婚礼流程默认折叠（只显示前5个）
    timelineExpanded: false,

    // 封面图加载状态
    coverLoaded: false,

    // 头像选择弹窗
    showUserModal: false,
    modalAvatarUrl: '',

  },

  onLoad(options) {
    if (!options.inv) {
      wx.showToast({ title: '请柬不存在', icon: 'error' })
      setTimeout(() => wx.reLaunch({ url: '/pages/creator/dashboard/dashboard' }), 2000)
      return
    }
    this.setData({ inv: options.inv })
    this.loadInvitation(options.inv)
    this.checkUserInfo()
  },

  // 页面回到前台时恢复音乐播放
  onShow() {
    // 只要用户之前启动过音乐（musicStarted），就恢复播放
    // 不依赖 playing 状态，因为 wx.previewImage 等操作会触发 onPause 把 playing 设为 false
    if (this._audioCtx && this.data.musicStarted) {
      setTimeout(() => {
        if (this._audioCtx && this.data.musicStarted) {
          this._audioCtx.play()
        }
      }, 300)
    }
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer)
    if (this._pollTimer) clearInterval(this._pollTimer)
    if (this._blessingWatcher) {
      try { this._blessingWatcher.close() } catch (e) {}
    }
    if (this._audioCtx) {
      this._audioCtx.destroy()
    }
  },

  // ===== 加载请柬数据 =====
  loadInvitation(id) {
    wx.cloud.callFunction({
      name: 'getInvitation',
      data: { invitationId: id },
      success: res => {
        if (res.result && res.result.success) {
          const d = res.result.data
          app.globalData.currentInvitation = d
          app.globalData.currentInvId = id

          // 地图坐标兜底：西平县中心区域（approximate）
          const FALLBACK_LAT = 33.0920
          const FALLBACK_LNG = 114.0210
          if ((!d.venueLat || !d.venueLng) && (d.venueName || d.venueAddress)) {
            d.venueLat = FALLBACK_LAT
            d.venueLng = FALLBACK_LNG
          }

          // 构建地图标记
          const markers = []
          if (d.venueLat && d.venueLng) {
            markers.push({
              id: 0,
              latitude: d.venueLat,
              longitude: d.venueLng,
              title: d.venueName || '',
              width: 28,
              height: 28
            })
          }

          // 婚礼流程兜底：无数据或所有条目均为空值时使用默认流程
          const needTimelineFallback = !d.timeline || d.timeline.length === 0 ||
            d.timeline.every(item => !item.time && !item.title && !item.description)
          if (needTimelineFallback) {
            d.timeline = [
              { time: '10:00', title: '迎宾签到', description: '宾客入场签到，领取座位卡' },
              { time: '10:30', title: '婚礼仪式', description: '新人入场，交换戒指，宣誓' },
              { time: '11:30', title: '合影留念', description: '与亲友拍摄合影' },
              { time: '12:00', title: '婚宴敬酒', description: '新人逐桌敬酒，感谢宾客' },
              { time: '14:00', title: '送客道别', description: '感谢各位宾客的到来' }
            ]
          }

          // 照片字段归一化：photo-uploader 存的是 fileID，guest view 模板用的是 url
          if (d.photos && d.photos.length > 0) {
            d.photos = d.photos.map(p => ({
              ...p,
              url: p.url || p.fileID || ''
            })).filter(p => p.url)
          }

          this.setData({
            invitation: d,
            markers,
            loading: false,
            coverLoaded: !d.coverImage
          })

          // 预加载关键图片，减少滑动时的白屏
          const urls = []
          if (d.coverImage) urls.push(d.coverImage)
          if (d.groomAvatar) urls.push(d.groomAvatar)
          if (d.brideAvatar) urls.push(d.brideAvatar)
          if (d.photos) d.photos.forEach(p => { if (p.url) urls.push(p.url) })
          preloadImages(urls)

          this.startCountdown(d.weddingDate)
          this.loadBlessings(id)
          this.initMusic(d.musicUrl)
        } else {
          this.setData({ loading: false })
          wx.showToast({ title: res.result.message || '请柬不存在', icon: 'none' })
        }
      },
      fail: () => {
        this.setData({ loading: false })
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    })
  },

  // ===== 倒计时 =====
  startCountdown(dateStr) {
    if (!dateStr) return
    const target = new Date(dateStr + 'T00:00:00').getTime()
    this.updateCountdown(target)
    this._timer = setInterval(() => this.updateCountdown(target), 1000)
  },

  // 上一秒的倒计时值，用于 diff 判断是否需要 setData
  _lastCD: null,

  updateCountdown(target) {
    const diff = target - Date.now()
    if (diff <= 0) {
      if (!this._lastCD || !this._lastCD.finished) {
        this.setData({ 'countdown.finished': true })
        this._lastCD = { finished: true }
      }
      clearInterval(this._timer)
      return
    }
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)

    // diff 比较：只有值真正变化时才 setData，避免每秒全页重渲染
    const last = this._lastCD
    if (!last || last.days !== days || last.hours !== hours ||
        last.minutes !== minutes || last.seconds !== seconds) {
      this.setData({
        'countdown.days': days,
        'countdown.hours': hours,
        'countdown.minutes': minutes,
        'countdown.seconds': seconds,
        'countdown.finished': false
      })
      this._lastCD = { days, hours, minutes, seconds, finished: false }
    }
  },

  // ===== 婚纱照（堆叠卡片轮播）=====
  onSwiperChange(e) {
    this.setData({ photoIdx: e.detail.current })
  },

  tapThumbnail(e) {
    this.setData({ photoIdx: e.currentTarget.dataset.idx })
  },

  previewPhoto(e) {
    const idx = e.currentTarget.dataset.idx
    const photos = this.data.invitation.photos || []
    const urls = photos.filter(p => p.url).map(p => p.url)
    if (urls.length === 0) return
    wx.previewImage({
      current: urls[idx] || urls[0],
      urls
    })
  },

  // ===== 地图导航 =====
  openNavigation() {
    const d = this.data.invitation
    if (!d.venueLat || !d.venueLng) {
      wx.showToast({ title: '暂无位置信息', icon: 'none' })
      return
    }
    wx.openLocation({
      latitude: d.venueLat,
      longitude: d.venueLng,
      name: d.venueName || '',
      address: d.venueAddress || '',
      scale: 18
    })
  },

  callVenue() {
    const phone = this.data.invitation.venuePhone
    if (!phone) return
    wx.makePhoneCall({ phoneNumber: phone })
  },

  // ===== RSVP 回执 =====
  onRsvpInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`rsvpForm.${field}`]: e.detail.value })
  },

  onAttendingChange(e) {
    this.setData({ 'rsvpForm.attending': e.detail.value })
  },

  onGuestCountChange(e) {
    const idx = e.detail.value
    this.setData({
      guestCountIndex: idx,
      'rsvpForm.guestCount': idx + 1
    })
  },

  async submitRSVP() {
    const { name, phone, attending } = this.data.rsvpForm

    if (!name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }
    if (!phone.trim() || phone.length !== 11) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (!attending) {
      wx.showToast({ title: '请选择是否出席', icon: 'none' })
      return
    }

    this.setData({ rsvpSubmitting: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'submitRSVP',
        data: {
          ...this.data.rsvpForm,
          invitationId: this.data.inv
        }
      })

      if (res.result && res.result.success) {
        this.setData({ rsvpSubmitted: true, rsvpSubmitting: false })
        wx.showToast({ title: '提交成功', icon: 'success' })
      } else {
        throw new Error(res.result ? res.result.message : '提交失败')
      }
    } catch (err) {
      console.error('RSVP submit error:', err)
      this.setData({ rsvpSubmitting: false })
      wx.showToast({ title: err.message || '提交失败', icon: 'none' })
    }
  },

  // ===== 祝福墙 =====
  async loadBlessings(invitationId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getBlessings',
        data: { invitationId }
      })
      if (res.result && res.result.data) {
        const count = res.result.data.length
        const list = res.result.data
        this.setData({
          blessingCount: count,
          blessingList: list,
          blessingsLoading: false
        })
        this.updatePagedBlessings()

        // 预加载所有头像，避免换页时图片重新从网络拉取
        const avatarUrls = list.filter(b => b.avatarUrl).map(b => b.avatarUrl)
        if (avatarUrls.length > 0) {
          preloadImages(avatarUrls)
        }

        // 逐条播放历史弹幕（头像 + 祝福语），按照片轮播时间均匀分布
        const danmaku = this.selectComponent('#danmaku')
        if (danmaku) {
          const items = list.map(b => ({
            text: b.text,
            avatar: b.avatarUrl || '',
            name: b.nickName || ''
          }))
          const photoCount = (this.data.invitation.photos && this.data.invitation.photos.length) || 1
          danmaku.addBatch(items, { photoCount, interval: 3500 })
        }
      } else {
        this.setData({ blessingsLoading: false })
      }
    } catch (err) {
      console.error('Load blessings error:', err)
      this.setData({ blessingsLoading: false })
    }
    this.startBlessingWatch(invitationId)
  },

  // 根据当前页码，计算分页显示范围（用 hidden 控制，不 slice 数组，避免换页时 image 重建重载）
  updatePagedBlessings() {
    const { blessingList, blessingPage, blessingPageSize } = this.data
    const totalPages = Math.ceil(blessingList.length / blessingPageSize) || 0
    const start = blessingPage * blessingPageSize
    const end = start + blessingPageSize
    // 生成页码数组 [0, 1, 2, ...]
    const pageNumbers = []
    for (let i = 0; i < totalPages; i++) {
      pageNumbers.push(i)
    }
    this.setData({
      blessingPageStart: start,
      blessingPageEnd: end,
      blessingTotalPages: totalPages,
      blessingPageNumbers: pageNumbers
    })
  },

  // 切换到指定页（dataset 取出的是字符串，必须转成数字，否则高亮和边界判断全错）
  goBlessingPage(e) {
    const page = parseInt(e.currentTarget.dataset.page, 10)
    if (isNaN(page) || page < 0 || page >= this.data.blessingTotalPages) return
    this.setData({ blessingPage: page }, () => {
      this.updatePagedBlessings()
    })
  },

  // 上一页
  prevBlessingPage() {
    if (this.data.blessingPage <= 0) return
    this.setData({ blessingPage: this.data.blessingPage - 1 }, () => {
      this.updatePagedBlessings()
    })
  },

  // 下一页
  nextBlessingPage() {
    if (this.data.blessingPage >= this.data.blessingTotalPages - 1) return
    this.setData({ blessingPage: this.data.blessingPage + 1 }, () => {
      this.updatePagedBlessings()
    })
  },

  startBlessingWatch(invitationId) {
    const db = wx.cloud.database()
    this._blessingWatcher = db.collection('blessings')
      .where({ invitationId })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .watch({
        onChange: (snapshot) => {
          if (!snapshot.docs || snapshot.docs.length === 0) return
          const newBlessing = snapshot.docs[0]
          if (this._lastBlessingId === newBlessing._id) return
          this._lastBlessingId = newBlessing._id

          // 新祝福加入列表头部（列表按 createdAt 倒序，最新在前），并刷新分页
          const list = this.data.blessingList.slice()
          // 防重复：发送时已乐观插入过
          const exists = list.some(b => b._id === newBlessing._id)
          if (!exists) {
            list.unshift(newBlessing)
          }
          this.setData({
            blessingCount: exists ? this.data.blessingCount : this.data.blessingCount + 1,
            blessingList: list
          }, () => {
            this.updatePagedBlessings()
          })

          const danmaku = this.selectComponent('#danmaku')
          if (danmaku) {
            danmaku.addDanmu(newBlessing.text, newBlessing.avatarUrl || '', newBlessing.nickName || '', {
              duration: 6 + Math.random() * 4
            })
          }
        },
        onError: (err) => {
          console.error('Blessing watch error:', err)
          if (this._blessingWatcher) {
            try { this._blessingWatcher.close() } catch (e) {}
            this._blessingWatcher = null
          }
          this._startPolling(invitationId)
        }
      })
  },

  _startPolling(invitationId) {
    if (this._pollTimer) return
    this._pollTimer = setInterval(async () => {
      try {
        const res = await wx.cloud.callFunction({
          name: 'getBlessings',
          data: { invitationId }
        })
        if (!res.result || !res.result.data || res.result.data.length === 0) return
        const latest = res.result.data[0]
        if (this._lastBlessingId === latest._id) return
        this._lastBlessingId = latest._id
        this.setData({ blessingCount: res.result.data.length })
      const danmaku = this.selectComponent('#danmaku')
      if (danmaku && latest) {
        danmaku.addDanmu(latest.text, latest.avatarUrl || '', latest.nickName || '', {
          duration: 6 + Math.random() * 4
        })
      }
      } catch (e) {
        console.error('Polling blessings error:', e)
      }
    }, 8000)
  },

  // 检查用户头像：优先用 app.globalData，没有再弹窗引导
  checkUserInfo() {
    const app = getApp()
    const userInfo = app.globalData.userInfo || {}
    if (userInfo.avatarUrl) {
      this.setData({
        userAvatar: userInfo.avatarUrl,
        modalAvatarUrl: userInfo.avatarUrl
      })
      return true
    }
    // 尝试读本地缓存
    const cachedAvatar = wx.getStorageSync('wedding_avatar')
    if (cachedAvatar) {
      this.setData({
        userAvatar: cachedAvatar,
        modalAvatarUrl: cachedAvatar
      })
      return true
    }
    return false
  },

  // 阻止冒泡（弹窗内部点击不关闭）
  noop() {},

  // 显示头像选择弹窗
  openUserModal() {
    this.setData({ showUserModal: true })
  },

  // 关闭弹窗
  closeUserModal() {
    this.setData({ showUserModal: false })
  },

  // 弹窗内选择头像
  onModalChooseAvatar(e) {
    const tempPath = e.detail.avatarUrl
    if (!tempPath) return
    this.setData({ modalAvatarUrl: tempPath }, () => {
      // 选完头像自动保存
      this.confirmAvatar()
    })
  },

  // 确认保存头像
  async confirmAvatar() {
    const { modalAvatarUrl } = this.data
    if (!modalAvatarUrl) {
      wx.showToast({ title: '请选择头像', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中...' })
    try {
      let avatarUrl = modalAvatarUrl
      if (modalAvatarUrl.startsWith('http://tmp') || modalAvatarUrl.startsWith('wxfile://')) {
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `avatars/visitor_${Date.now()}.jpg`,
          filePath: modalAvatarUrl
        })
        avatarUrl = uploadRes.fileID
      }
      wx.setStorageSync('wedding_avatar', avatarUrl)
      this.setData({
        userAvatar: avatarUrl,
        showUserModal: false
      })
      wx.showToast({ title: '已设置头像', icon: 'success' })
    } catch (err) {
      console.error('保存头像失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 旧版 chooseAvatar 回调（输入栏左侧头像按钮）
  onChooseAvatar(e) {
    const tempPath = e.detail.avatarUrl
    if (!tempPath) return
    this.setData({ modalAvatarUrl: tempPath })
    this.confirmAvatar()
  },

  onBlessingInput(e) {
    const value = e.detail.value
    this.setData({
      blessingText: value,
      canSend: value.trim().length > 0
    })
  },

  async sendBlessing() {
    const text = this.data.blessingText.trim()
    if (!text) {
      wx.showToast({ title: '请输入祝福内容', icon: 'none' })
      return
    }

    // 未设置头像/昵称时，弹出补全弹窗
    const hasUserInfo = this.checkUserInfo()
    if (!hasUserInfo) {
      this.openUserModal()
      return
    }

    const avatarUrl = this.data.userAvatar || ''

    // 先本地飘一条弹幕
    const danmaku = this.selectComponent('#danmaku')
    if (danmaku) {
      danmaku.addDanmu(text, avatarUrl, '')
    }
    this.setData({ blessingText: '' })

    try {
      const submitRes = await wx.cloud.callFunction({
        name: 'submitBlessing',
        data: {
          text,
          nickName: '',
          avatarUrl,
          invitationId: this.data.inv
        }
      })
      // 乐观更新：立即把新祝福插入列表头部并刷新分页
      if (submitRes.result && submitRes.result._id) {
        this._lastBlessingId = submitRes.result._id // 防止 watcher 重复插入
        const newItem = { _id: submitRes.result._id, text, nickName: '', avatarUrl }
        const list = this.data.blessingList.slice()
        list.unshift(newItem)
        this.setData({
          blessingCount: this.data.blessingCount + 1,
          blessingList: list
        }, () => {
          this.updatePagedBlessings()
        })
      }
    } catch (err) {
      console.error('Submit blessing error:', err)
    }
  },

  // ===== 背景音乐 =====
  initMusic(musicUrl) {
    if (!musicUrl) return

    // 检测不支持的音频格式（ncm 等加密格式微信无法解码）
    const lowerUrl = musicUrl.toLowerCase()
    const unsupportedExts = ['.ncm', '.qmc', '.kwm', '.mflac']
    if (unsupportedExts.some(ext => lowerUrl.includes(ext))) {
      console.error('不支持的音频格式，请上传 MP3/AAC/WAV/M4A 格式的文件')
      this.setData({ showMusicBtn: false })
      return
    }

    const ctx = wx.createInnerAudioContext()
    ctx.src = musicUrl
    ctx.loop = true
    ctx.volume = 0.4
    ctx.autoplay = true
    ctx.onError((err) => {
      console.error('Music error:', err)
      // 音频解码失败时隐藏音乐按钮，销毁无效的音频上下文
      this.setData({ showMusicBtn: false, playing: false })
      try { ctx.destroy() } catch (e) {}
      this._audioCtx = null
    })
    ctx.onPlay(() => {
      this.setData({ playing: true })
    })
    ctx.onPause(() => {
      this.setData({ playing: false })
    })
    this._audioCtx = ctx
  },

  // 首次点击页面时自动播放音乐（微信限制需用户交互后才能播放音频）
  onPageTap() {
    if (this.data.musicStarted || !this._audioCtx) return
    this._audioCtx.play()
    this.setData({ musicStarted: true, playing: true })
  },

  // 展开/收起婚礼流程
  toggleTimeline() {
    this.setData({ timelineExpanded: !this.data.timelineExpanded })
  },

  // 封面图加载完成
  onCoverLoad() {
    this.setData({ coverLoaded: true })
  },

  toggleMusic() {
    if (!this._audioCtx) return
    if (this.data.playing) {
      this._audioCtx.pause()
      this.setData({ playing: false })
    } else {
      this._audioCtx.play()
      // 同步标记 musicStarted，避免后续 onPageTap 重复触发 play
      this.setData({ playing: true, musicStarted: true })
    }
  },

  // ===== 分享 =====
  onShareAppMessage() {
    const d = this.data.invitation || {}
    return {
      title: d.shareTitle || `${d.groomName} & ${d.brideName}的婚礼请柬`,
      path: `/pages/router/router?inv=${this.data.inv}`,
      imageUrl: d.coverImage || ''
    }
  },

  onShareTimeline() {
    const d = this.data.invitation || {}
    return {
      title: d.shareTitle || `${d.groomName} & ${d.brideName}的婚礼请柬`,
      query: `inv=${this.data.inv}`,
      imageUrl: d.coverImage || ''
    }
  },

  goCreate() {
    wx.reLaunch({ url: '/pages/creator/dashboard/dashboard' })
  }
})
