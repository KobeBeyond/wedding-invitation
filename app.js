// app.js
App({
  globalData: {
    cloudEnvId: 'cloud1-d8g3si1j80e52a25f',
    // 运行时缓存（非硬编码）
    userOpenId: '',           // 当前用户 openId（login 后填充）
    userInfo: null,           // 当前用户信息 { nickName, avatarUrl }
    currentInvitation: null,  // 访客端：当前查看的请柬数据
    currentInvId: ''          // 访客端：当前请柬 ID
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: this.globalData.cloudEnvId,
      traceUser: true
    })
    // 初始化数据库集合（幂等操作，已存在则跳过）
    wx.cloud.callFunction({
      name: 'initDB',
      success: res => {
        console.log('✅ 数据库初始化完成', res.result)
      },
      fail: err => {
        console.error('❌ 数据库初始化失败', err)
      }
    })

    // 静默登录
    this.silentLogin()
  },

  // 静默登录：获取 openId，写入/更新 users 集合
  silentLogin() {
    wx.cloud.callFunction({
      name: 'login',
      success: res => {
        if (res.result && res.result.success) {
          this.globalData.userOpenId = res.result.openid
          if (res.result.user) {
            this.globalData.userInfo = res.result.user
          }
          console.log('✅ 登录成功', this.globalData.userOpenId)
        }
      },
      fail: err => {
        console.error('❌ 静默登录失败', err)
      }
    })
  }
})
