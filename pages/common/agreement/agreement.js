// pages/common/agreement/agreement.js — 用户服务协议 / 隐私政策
Page({
  data: {
    type: 'service', // service: 用户服务协议, privacy: 隐私政策
    title: '用户服务协议'
  },

  onLoad(options) {
    const type = options.type === 'privacy' ? 'privacy' : 'service'
    this.setData({
      type,
      title: type === 'privacy' ? '隐私政策' : '用户服务协议'
    })
    wx.setNavigationBarTitle({ title: this.data.title })
  }
})
