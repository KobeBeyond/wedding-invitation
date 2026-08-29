// pages/guest/view/view.js — 来宾视角：完整请柬页面
const app = getApp()
const { preloadImages, centerCropImage, getAppVersion } = require('../../../utils/util.js')
const { QUOTES: LOCAL_BLESSING_QUOTES } = require('../../../utils/blessingQuotes.js')

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
    rsvpAgreed: false,  // 是否同意协议

    // 祝福墙
    blessingQuotes: [],   // 平台预设语录库（从云端加载，失败用本地兜底）
    currentBlessing: '',  // 当前随机选中的语录预览
    blessingSent: false,  // 是否已发送过祝福（发送后显示感谢文案，防止重复发送）
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

    // 地图（原生组件，保留 POI 文字；安卓滚动重绘属平台行为，可接受）
    // mapSnapshot / hideMapPoi 截图方案已回退

    // 版本号：动态读取线上版本，开发/体验版回退默认值
    appVersion: getAppVersion(),

    // 花瓣彩蛋
petalList: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
// 被点碎的花瓣（idx → true 表示已消失）
petalHidden: {},
petalBubble: '',
// 自增 id：每次点击变化，强制重建动画节点，保证绽放动效每次都重新播放
burstId: 0,
burstX: 0,
burstY: 0,

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
    // 加载平台预设祝福语录库（失败重试，最终失败隐藏发送入口）
    this.loadBlessingQuotes()
    // 静默检查头像（不弹窗），有则显示在输入栏
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
    if (this._coverTimeout) clearTimeout(this._coverTimeout)
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

          // 封面 loading 兑底超时，防止 bindload 未触发卡在 loading
          if (d.coverImage) this.startCoverTimeout()

          // 预加载关键图片，减少滑动时的白屏
          const urls = []
          if (d.coverImage) urls.push(d.coverImage)
          if (d.groomAvatar) urls.push(d.groomAvatar)
          if (d.brideAvatar) urls.push(d.brideAvatar)
          if (d.photos) d.photos.forEach(p => { if (p.url) urls.push(p.url) })
          preloadImages(urls)

          // 预生成居中裁剪的分享图（5:4）：微信分享默认从左边裁剪，宽图会丢右半边
          const shareSrc = d.shareImage || d.coverImage
          if (shareSrc) {
            centerCropImage(shareSrc).then(cropped => {
              if (cropped) this._shareImage = cropped
            })
          }

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
    // loading 遮罩展示期间跳过倒计时刷新：避免每秒 setData 打断主线程导致戒指动画掉帧跳动
    // loading 结束后下一秒会自动刷成正确值
    if (!this.data.coverLoaded) return

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
    const idx = parseInt(e.detail.value, 10)
    this.setData({
      guestCountIndex: idx,
      'rsvpForm.guestCount': idx + 1
    })
  },

  // 切换协议勾选
  toggleAgreement() {
    this.setData({ rsvpAgreed: !this.data.rsvpAgreed })
  },

  // 查看用户服务协议
  viewServiceAgreement() {
    wx.navigateTo({ url: '/pages/common/agreement/agreement?type=service' })
  },

  // 查看隐私政策
  viewPrivacyPolicy() {
    wx.navigateTo({ url: '/pages/common/agreement/agreement?type=privacy' })
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

    // 提交前检查头像，没有则跳转头像设置页
    const hasAvatar = this.checkUserInfo()
    if (!hasAvatar) {
      wx.navigateTo({ url: '/pages/common/avatar-setup/avatar-setup' })
      return
    }

    // 检查协议勾选
    if (!this.data.rsvpAgreed) {
      wx.showToast({ title: '请先阅读并同意协议', icon: 'none' })
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

        // 逐条循环播放历史弹幕（头像 + 祝福语），组件内部按轨道防重叠调度，播完一轮从头再来
        const danmaku = this.selectComponent('#danmaku')
        if (danmaku) {
          const items = list.map(b => ({
            text: b.text,
            avatar: b.avatarUrl || '',
            name: b.nickName || ''
          }))
          danmaku.addBatch(items)
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
      // 原生相册面板可能抢占音频焦点导致音乐暂停，选完头像主动恢复
      if (this._audioCtx && this.data.musicStarted) {
        setTimeout(() => {
          if (this._audioCtx && this.data.musicStarted && !this.data.playing) {
            this._audioCtx.play()
          }
        }, 300)
      }
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

  // 加载平台预设祝福语录库：先尝试云端，失败/为空时自动降级到本地内置语录
  async loadBlessingQuotes() {
    let quotes = []
    try {
      const res = await wx.cloud.callFunction({ name: 'getBlessingQuotes' })
      const data = res.result && res.result.data
      if (data && data.length > 0) {
        quotes = data
      }
    } catch (err) {
      // 云函数未部署或数据库异常：静默降级到本地兜底
    }
    if (!quotes.length) {
      quotes = LOCAL_BLESSING_QUOTES
    }
    this.setData({ blessingQuotes: quotes })
    // 语录库就绪后，自动随机选一条作为预览
    this._pickRandomBlessing(quotes)
  },

  // 从语录库随机选一条作为当前预览（避免连续重复）
  _pickRandomBlessing(quotes) {
    quotes = quotes || this.data.blessingQuotes
    if (!quotes || !quotes.length) return
    let idx = Math.floor(Math.random() * quotes.length)
    if (quotes.length > 1 && this._lastQuoteIdx === idx) {
      idx = (idx + 1) % quotes.length
    }
    this._lastQuoteIdx = idx
    const text = quotes[idx].text || quotes[idx]
    this.setData({ currentBlessing: text })
  },

  // 用户点击「换一条」：重新随机选一条语录预览
  refreshBlessing() {
    this._pickRandomBlessing()
  },

  async sendBlessing() {
    const text = this.data.currentBlessing
    if (!text) {
      wx.showToast({ title: '祝福语录加载中，请稍候', icon: 'none' })
      return
    }

    // 未设置头像时，跳转头像设置页
    const hasUserInfo = this.checkUserInfo()
    if (!hasUserInfo) {
      wx.navigateTo({ url: '/pages/common/avatar-setup/avatar-setup' })
      return
    }

    const avatarUrl = this.data.userAvatar || ''

    // 先本地飘一条弹幕
    const danmaku = this.selectComponent('#danmaku')
    if (danmaku) {
      danmaku.addDanmu(text, avatarUrl, '')
    }

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
          blessingList: list,
          blessingSent: true
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
    // 不再 autoplay：等 loading 遮罩淡出时（onCoverLoad / 超时兑底）再统一触发播放，
    // 保证「音乐响起」和「loading 消失」同时发生，而不是背景先响、页面还在转圈
    ctx.autoplay = false
    // 提前预热：加载音频资源但不播放，等 play() 时能立即出声
    try { ctx.prepare && ctx.prepare() } catch (e) {}
    ctx.onError((err) => {
      console.error('Music error:', err)
      // 仅格式/解码类永久性错误才隐藏按钮并销毁（音乐确实无法播放）；
      // 其余错误（如原生相册/相机面板抢占音频焦点导致的瞬时中断）保留上下文，
      // 后续 onShow / 头像选择完成时可通过 play() 恢复播放
      const errCode = err && err.errCode
      if (errCode === 10002 || errCode === 10003) {
        this.setData({ showMusicBtn: false, playing: false })
        try { ctx.destroy() } catch (e) {}
        this._audioCtx = null
      } else {
        this.setData({ playing: false })
      }
    })
    ctx.onPlay(() => {
      // autoplay 启动成功也标记 musicStarted，防止后续 tap 重复调 play() 触发真机报错
      this.setData({ playing: true, musicStarted: true })
    })
    ctx.onPause(() => {
      this.setData({ playing: false })
    })
    this._audioCtx = ctx
  },

  // 首次点击页面时自动播放音乐（微信限制需用户交互后才能播放音频）
  onPageTap() {
    if (this.data.musicStarted || !this._audioCtx) return
    // 已经在播放（autoplay 已启动）时仅补标记，绝不对播放中的 context 重复调 play()
    // 真机上对正在播放的 audio 再次 play() 会触发中断报错，导致音乐停止且 icon 被隐藏
    if (this.data.playing) {
      this.setData({ musicStarted: true })
      return
    }
    this._audioCtx.play()
    this.setData({ musicStarted: true, playing: true })
  },

  // 展开/收起婚礼流程
  toggleTimeline() {
    this.setData({ timelineExpanded: !this.data.timelineExpanded })
  },

  // 阻止 loading 遮罩下的页面滑动
  preventScroll() {},

  // 封面 loading 结束（图片加载完成/失败/6s超时）的统一收口：
  // loading 淡出与背景音乐开始播放在同一时刻触发
  onCoverLoad() {
    if (this._coverTimeout) {
      clearTimeout(this._coverTimeout)
      this._coverTimeout = null
    }
    if (!this.data.coverLoaded) {
      this.setData({ coverLoaded: true })
      // loading 消失的同时启动背景音乐（仅首次）
      if (this._audioCtx && !this.data.musicStarted) {
        this._audioCtx.play()
        this.setData({ musicStarted: true, playing: true })
      }
    }
  },

  // 封面 loading 兑底超时：无论图片是否加载完成，最多 6s 后强制去掉 loading 遮罩
  // 防止 bindload 在部分机型/缓存场景下未触发，导致永久卡在 loading
  startCoverTimeout() {
    if (this._coverTimeout) clearTimeout(this._coverTimeout)
    this._coverTimeout = setTimeout(() => {
      this._coverTimeout = null
      if (!this.data.coverLoaded) {
        console.warn('cover loading timeout, force hide')
        this.setData({ coverLoaded: true })
        // 超时兑底同样触发音乐：不能 loading 卡死了音乐也永远不响
        if (this._audioCtx && !this.data.musicStarted) {
          this._audioCtx.play()
          this.setData({ musicStarted: true, playing: true })
        }
      }
    }, 6000)
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

  // ===== 花瓣彩蛋 =====
  // 点击飘落的花瓣：花瓣碎裂消失，位置炸开碎片烟花，随机弹出一句祝福
  onPetalTap(e) {
    // 祝福文本与 emoji 各自独立随机，组合更丰富
    const texts = [
      '愿你们百年好合，永结同心',
      '新婚快乐，白头偕老',
      '愿往后余生，皆是甜蜜',
      '执子之手，与子偕老',
      '祝福你们，爱情甜蜜如初',
      '愿岁月温柔，爱情长久',
      '天作之合，鸾凤和鸣',
      '愿你们的爱情，历久弥新',
      '琴瑟和鸣，幸福美满',
      '愿每一个明天，都比今天更爱彼此'
    ]
    const emojis = ['💒', '☺️', '😄', '🌹', '💕', '✨', '🎊', '🌸', '💫', '🌈', '💖', '🥂']
    let text = texts[Math.floor(Math.random() * texts.length)]
    // 避免连续两次抽到同一句
    if (text === this._lastBlessingText && texts.length > 1) {
      text = texts[(texts.indexOf(text) + 1) % texts.length]
    }
    this._lastBlessingText = text
    const emoji = emojis[Math.floor(Math.random() * emojis.length)]

    // 点击位置（changedTouches 优先，取 clientX/clientY 配合 position:fixed）
    const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0])
    const x = t ? t.clientX : (e.detail.x || 187)
    const y = t ? t.clientY : (e.detail.y || 333)

    // burstId 自增：配合 wxml 中 wx:key="*this"，每次点击都重建动画节点，
    // 否则气泡存活期内（2.5s）节点不销毁，CSS 动画不会重新播放
    this.setData({
      petalBubble: text + ' ' + emoji,
      burstX: x,
      burstY: y,
      burstId: this.data.burstId + 1
    })

    // 点击的花瓣碎裂消失，4s 后从顶部重新飘落
    const idx = e.currentTarget.dataset.idx
    if (idx !== undefined && idx !== null) {
      this.setData({ ['petalHidden.' + idx]: true })
      setTimeout(() => {
        this.setData({ ['petalHidden.' + idx]: false })
      }, 4000)
    }

    // 2.5s 后自动消失
    if (this._petalBubbleTimer) clearTimeout(this._petalBubbleTimer)
    this._petalBubbleTimer = setTimeout(() => {
      this.setData({ petalBubble: '' })
    }, 2500)
  },

  // ===== 分享 =====
  onShareAppMessage() {
    const d = this.data.invitation || {}
    return {
      title: d.shareTitle || `${d.groomName} & ${d.brideName}的婚礼请柬`,
      path: `/pages/router/router?inv=${this.data.inv}`,
      // 优先用居中裁剪后的分享图，未生成或失败时回退原图
      imageUrl: this._shareImage || d.shareImage || d.coverImage || ''
    }
  },

  onShareTimeline() {
    const d = this.data.invitation || {}
    return {
      title: d.shareTitle || `${d.groomName} & ${d.brideName}的婚礼请柬`,
      query: `inv=${this.data.inv}`,
      imageUrl: this._shareImage || d.shareImage || d.coverImage || ''
    }
  },

  goCreate() {
    wx.reLaunch({ url: '/pages/creator/dashboard/dashboard' })
  }
})
