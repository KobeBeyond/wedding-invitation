// pages/router/router.js — 入口路由页
// 根据打开方式判断角色：分享链接 → 访客，直接打开 → 创作者
Page({
  onLoad(options) {
    // 场景1：通过分享链接打开（query 带 inv 参数）
    if (options && options.inv) {
      wx.reLaunch({
        url: `/pages/guest/view/view?inv=${options.inv}`
      })
      return
    }

    // 场景2：通过扫码打开（scene 参数需解码）
    const launchOptions = wx.getLaunchOptionsSync()
    if (launchOptions.query && launchOptions.query.inv) {
      wx.reLaunch({
        url: `/pages/guest/view/view?inv=${launchOptions.query.inv}`
      })
      return
    }
    if (launchOptions.scene === 1047 || launchOptions.scene === 1048) {
      // 扫小程序码进入，解析 scene 参数
      const scene = decodeURIComponent(launchOptions.query.scene || '')
      const match = scene.match(/inv=(\w+)/)
      if (match) {
        wx.reLaunch({
          url: `/pages/guest/view/view?inv=${match[1]}`
        })
        return
      }
    }

    // 场景3：直接打开 → 创作者首页
    wx.reLaunch({
      url: '/pages/creator/dashboard/dashboard'
    })
  }
})
