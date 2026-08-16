// pages/guest/view/view.js — 来宾视角：完整请柬页面
const app = getApp()

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
    blessingCount: 0,
    blessingsLoading: true,

    // 音乐
    playing: false,
    musicStarted: false,
    showMusicBtn: true,

    // 同来人员
    hasCompanion: '',
    companionCount: 0,
    companionCountIndex: 0,
    companionCountOptions: ['1人', '2人', '3人', '4人', '5人', '6人', '7人', '8人', '9人', '10人'],

    // 用户昵称
    userNickName: ''
  },

  onLoad(options) {
    if (!options.inv) {
      wx.showToast({ title: '请柬不存在', icon: 'error' })
      setTimeout(() => wx.reLaunch({ url: '/pages/creator/dashboard/dashboard' }), 2000)
      return
    }
    this.setData({ inv: options.inv })
    this.loadInvitation(options.inv)
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer)
    if (this._blessingWatcher) this._blessingWatcher.close()
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
            loading: false
          })

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

  updateCountdown(target) {
    const diff = target - Date.now()
    if (diff <= 0) {
      this.setData({ 'countdown.finished': true })
      clearInterval(this._timer)
      return
    }
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    this.setData({ countdown: { days, hours, minutes, seconds, finished: false } })
  },

  // ===== 婚纱照 =====
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

  onHasCompanionChange(e) {
    this.setData({ hasCompanion: e.detail.value })
  },

  onCompanionCountChange(e) {
    const idx = e.detail.value
    this.setData({
      companionCountIndex: idx,
      companionCount: idx + 1
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
          hasCompanion: this.data.hasCompanion,
          companionCount: this.data.hasCompanion === 'yes' ? this.data.companionCount : 0,
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
        this.setData({ blessingCount: count, blessingsLoading: false })

        // 逐条播放历史弹幕（昵称: 祝福语）
        const danmaku = this.selectComponent('#danmaku')
        if (danmaku) {
          const texts = res.result.data.map(b => {
            const name = b.nickName || '匿名好友'
            return `${name}: ${b.text}`
          })
          danmaku.addBatch(texts)
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

          this.setData({ blessingCount: this.data.blessingCount + 1 })
          const danmaku = this.selectComponent('#danmaku')
          if (danmaku) {
            const name = newBlessing.nickName || '匿名好友'
            danmaku.addDanmu(`${name}: ${newBlessing.text}`)
          }
        },
        onError: (err) => {
          console.error('Blessing watch error:', err)
        }
      })
  },

  onBlessingInput(e) {
    this.setData({ blessingText: e.detail.value })
  },

  async sendBlessing() {
    const text = this.data.blessingText.trim()
    if (!text) {
      wx.showToast({ title: '请输入祝福内容', icon: 'none' })
      return
    }

    // 获取用户昵称
    let nickName = this.data.userNickName
    if (!nickName) {
      try {
        const profile = await wx.getUserProfile({
          desc: '用于祝福墙展示昵称'
        })
        nickName = profile.userInfo.nickName || '匿名好友'
        this.setData({ userNickName: nickName })
      } catch (e) {
        nickName = '匿名好友'
      }
    }

    const danmakuText = `${nickName}: ${text}`

    // 先本地飘一条
    const danmaku = this.selectComponent('#danmaku')
    if (danmaku) {
      danmaku.addDanmu(danmakuText)
    }
    this.setData({ blessingText: '' })

    try {
      await wx.cloud.callFunction({
        name: 'submitBlessing',
        data: {
          text,
          nickName,
          invitationId: this.data.inv
        }
      })
      // watcher 会自动更新计数
    } catch (err) {
      console.error('Submit blessing error:', err)
      // 云函数失败时本地弹幕已展示
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

  toggleMusic() {
    if (!this._audioCtx) return
    if (this.data.playing) {
      this._audioCtx.pause()
      this.setData({ playing: false })
    } else {
      this._audioCtx.play()
      this.setData({ playing: true })
    }
  },

  // ===== 分享 =====
  onShareAppMessage() {
    const d = this.data.invitation || {}
    return {
      title: d.shareTitle || `${d.groomName}&${d.brideName}邀请您参加我们的婚礼`,
      path: `/pages/router/router?inv=${this.data.inv}`,
      imageUrl: d.coverImage || ''
    }
  },

  onShareTimeline() {
    const d = this.data.invitation || {}
    return {
      title: d.shareTitle || `${d.groomName}&${d.brideName}的婚礼邀请`,
      query: `inv=${this.data.inv}`,
      imageUrl: d.coverImage || ''
    }
  },

  goCreate() {
    wx.reLaunch({ url: '/pages/creator/dashboard/dashboard' })
  }
})
