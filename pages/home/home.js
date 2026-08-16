// pages/home/home.js
const util = require('../../utils/util.js')

Page({
  data: {
    groom: '',
    bride: '',
    weddingDateText: '',
    countdown: { days: 0, hours: 0, minutes: 0, seconds: 0, finished: false },
    musicPlaying: false
  },

  audioCtx: null,
  timer: null,

  onLoad() {
    const app = getApp()
    const gd = app.globalData

    this.setData({
      groom: gd.groomName,
      bride: gd.brideName,
      weddingDateText: util.formatTime(gd.weddingDate)
    })

    // 初始化倒计时
    this.updateCountdown()
    this.timer = setInterval(() => this.updateCountdown(), 1000)

    // 初始化音频
    this.initAudio(gd.musicUrl)
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer)
    if (this.audioCtx) {
      this.audioCtx.destroy()
      this.audioCtx = null
    }
  },

  updateCountdown() {
    const app = getApp()
    const cd = util.getCountdown(app.globalData.weddingDate)
    this.setData({ countdown: cd })
  },

  initAudio(url) {
    if (!url) return
    this.audioCtx = wx.createInnerAudioContext()
    this.audioCtx.src = url
    this.audioCtx.loop = true
  },

  toggleMusic() {
    if (!this.audioCtx) {
      wx.showToast({ title: '暂未配置音乐', icon: 'none' })
      return
    }
    if (this.data.musicPlaying) {
      this.audioCtx.pause()
      this.setData({ musicPlaying: false })
    } else {
      this.audioCtx.play()
      this.setData({ musicPlaying: true })
    }
  },

  // 页面跳转
  goHome()     { wx.reLaunch({ url: '/pages/home/home' }) },
  goPhotos()   { wx.navigateTo({ url: '/pages/photos/photos' }) },
  goVenue()    { wx.navigateTo({ url: '/pages/venue/venue' }) },
  goRsvp()     { wx.navigateTo({ url: '/pages/rsvp/rsvp' }) },
  goBlessings() { wx.navigateTo({ url: '/pages/blessings/blessings' }) },
  goSchedule() { wx.navigateTo({ url: '/pages/schedule/schedule' }) },

  onShareAppMessage() {
    const app = getApp()
    const gd = app.globalData
    return {
      title: `${gd.groomName}&${gd.brideName}邀请您参加我们的婚礼`,
      path: '/pages/home/home',
      imageUrl: ''
    }
  }
})
