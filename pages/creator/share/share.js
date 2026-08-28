// pages/creator/share/share.js
Page({
  data: {
    invitationId: '',
    invitation: null,
    stats: { views: 0, rsvp: 0, blessings: 0 },
    loading: true
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ invitationId: options.id })
      this.loadInvitation(options.id)
    }
  },

  loadInvitation(id) {
    wx.cloud.callFunction({
      name: 'getInvitation',
      data: { invitationId: id },
      success: res => {
        if (res.result && res.result.success) {
          this.setData({
            invitation: res.result.data,
            stats: {
              views: res.result.data.viewCount || 0,
              rsvp: 0,
              blessings: 0
            },
            loading: false
          })
          this.loadStats(id)
        } else {
          this.setData({ loading: false })
          wx.showToast({ title: '加载失败', icon: 'none' })
        }
      },
      fail: () => {
        this.setData({ loading: false })
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    })
  },

  // 加载统计数据
  loadStats(id) {
    wx.cloud.callFunction({
      name: 'getStats',
      data: { invitationId: id },
      success: res => {
        if (res.result && res.result.success) {
          this.setData({
            stats: {
              views: this.data.stats.views,
              rsvp: res.result.rsvpCount || 0,
              blessings: res.result.blessingCount || 0
            }
          })
        }
      }
    })
  },

  // 分享给好友（点击 open-type="share" 按钮时触发）
  onShareAppMessage() {
    const inv = this.data.invitation || {}
    const title = inv.shareTitle || `${inv.groomName}&${inv.brideName}邀请您参加我们的婚礼`
    return {
      title,
      path: `/pages/router/router?inv=${this.data.invitationId}`,
      imageUrl: inv.shareImage || inv.coverImage || ''
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    const inv = this.data.invitation || {}
    const title = inv.shareTitle || `${inv.groomName}&${inv.brideName}的婚礼邀请`
    return {
      title,
      query: `inv=${this.data.invitationId}`,
      imageUrl: inv.shareImage || inv.coverImage || ''
    }
  },

  // 复制邀请文案
  copyInviteText() {
    const inv = this.data.invitation || {}
    const text = `${inv.shareTitle || inv.groomName + '与' + inv.brideName + '的婚礼'}\n时间：${inv.weddingDate}\n地点：${inv.venueName || ''} ${inv.venueAddress || ''}\n\n打开微信搜索小程序「Nupcias」查看完整请柬`

    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '已复制邀请文案', icon: 'success' })
      }
    })
  },

  // 查看请柬（以来宾视角预览）
  goView() {
    wx.navigateTo({
      url: `/pages/guest/view/view?inv=${this.data.invitationId}`
    })
  },

  // 返回首页
  goBack() {
    wx.redirectTo({ url: '/pages/creator/dashboard/dashboard' })
  },

  // 编辑
  goEdit() {
    wx.redirectTo({
      url: `/pages/creator/editor/editor?id=${this.data.invitationId}`
    })
  }
})
