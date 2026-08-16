// pages/guest/view/view.js — 访客查看页（基础版，后续 Phase 3 完整迁移）
const app = getApp()

Page({
  data: {
    inv: '',
    invitation: null,
    loading: true,
    countdown: { days: 0, hours: 0, minutes: 0, seconds: 0, finished: false },
    timer: null
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

  loadInvitation(id) {
    wx.cloud.callFunction({
      name: 'getInvitation',
      data: { invitationId: id },
      success: res => {
        if (res.result && res.result.success) {
          const d = res.result.data
          // 缓存到全局
          app.globalData.currentInvitation = d
          app.globalData.currentInvId = id

          this.setData({ invitation: d, loading: false })
          this.startCountdown(d.weddingDate)
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

  startCountdown(dateStr) {
    if (!dateStr) return
    const target = new Date(dateStr + 'T00:00:00').getTime()
    this.setData({ timer: setInterval(() => this.updateCountdown(target), 1000) })
  },

  updateCountdown(target) {
    const now = Date.now()
    const diff = target - now
    if (diff <= 0) {
      this.setData({ 'countdown.finished': true })
      clearInterval(this.data.timer)
      return
    }
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    this.setData({ countdown: { days, hours, minutes, seconds, finished: false } })
  },

  onUnload() {
    if (this.data.timer) clearInterval(this.data.timer)
  },

  // 跳转到旧版页面（临时方案，Phase 3 将完整迁移到 pages/guest/）
  goPhotos() {
    wx.navigateTo({ url: '/pages/photos/photos' })
  },
  goVenue() {
    wx.navigateTo({ url: '/pages/venue/venue' })
  },
  goRSVP() {
    wx.navigateTo({ url: '/pages/rsvp/rsvp' })
  },
  goBlessings() {
    wx.navigateTo({ url: '/pages/blessings/blessings' })
  },
  goSchedule() {
    wx.navigateTo({ url: '/pages/schedule/schedule' })
  },

  // CTA: 我也要制作请柬
  goCreate() {
    wx.reLaunch({ url: '/pages/creator/dashboard/dashboard' })
  },

  // 访客也可转发请柬给好友
  onShareAppMessage() {
    const d = this.data.invitation || {}
    return {
      title: d.shareTitle || `${d.groomName}&${d.brideName}邀请您参加我们的婚礼`,
      path: `/pages/router/router?inv=${this.data.inv}`,
      imageUrl: d.coverImage || ''
    }
  },

  // 访客也可分享到朋友圈
  onShareTimeline() {
    const d = this.data.invitation || {}
    return {
      title: d.shareTitle || `${d.groomName}&${d.brideName}的婚礼邀请`,
      query: `inv=${this.data.inv}`,
      imageUrl: d.coverImage || ''
    }
  }
})
