// pages/creator/dashboard/dashboard.js
const app = getApp()

Page({
  data: {
    invitations: [],
    loading: true,
    isEmpty: false,
    isLoggedIn: true,
    loginAvatarUrl: '',
    loginNickName: ''
  },

  onShow() {
    // 先检查登录态
    this.checkLoginState()
    // 已有数据时静默刷新，不重置 loading 状态
    const silent = this.data.invitations.length > 0
    this.loadInvitations(silent)
  },

  // 检查登录态
  checkLoginState() {
    const app = getApp()
    const userInfo = app.globalData.userInfo || {}
    const loggedIn = !!(userInfo.avatarUrl && userInfo.nickName)
    this.setData({ isLoggedIn: loggedIn })
    return loggedIn
  },

  // 登录遮罩 — 选择头像
  onLoginChooseAvatar(e) {
    const tempPath = e.detail.avatarUrl
    if (!tempPath) return
    this.setData({ loginAvatarUrl: tempPath })
  },

  // 登录遮罩 — 输入昵称
  onLoginNickNameInput(e) {
    this.setData({ loginNickName: e.detail.value })
  },

  // 登录遮罩 — 确认进入
  async confirmLogin() {
    const { loginAvatarUrl, loginNickName } = this.data
    if (!loginNickName.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    if (!loginAvatarUrl) {
      wx.showToast({ title: '请选择头像', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中...' })
    try {
      let avatarUrl = loginAvatarUrl
      if (loginAvatarUrl.startsWith('http://tmp') || loginAvatarUrl.startsWith('wxfile://')) {
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `avatars/user_${Date.now()}.jpg`,
          filePath: loginAvatarUrl
        })
        avatarUrl = uploadRes.fileID
      }
      wx.setStorageSync('wedding_avatar', avatarUrl)
      wx.setStorageSync('wedding_nickname', loginNickName)
      getApp().updateUserInfo(loginNickName, avatarUrl)
      this.setData({
        isLoggedIn: true,
        loginAvatarUrl: '',
        loginNickName: ''
      })
      wx.showToast({ title: '欢迎回来', icon: 'success' })
    } catch (err) {
      console.error('登录保存失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后将清除您的头像和昵称，需要重新设置才能使用',
      confirmColor: '#ff6b6b',
      success: res => {
        if (res.confirm) {
          // 清除本地缓存
          wx.removeStorageSync('wedding_avatar')
          wx.removeStorageSync('wedding_nickname')
          // 清除全局数据
          const app = getApp()
          app.globalData.userInfo = null
          app.globalData.userOpenId = ''
          // 刷新状态
          this.setData({
            isLoggedIn: false,
            loginAvatarUrl: '',
            loginNickName: ''
          })
          wx.showToast({ title: '已退出登录', icon: 'none' })
        }
      }
    })
  },

  // 加载我的请柬列表
  // silent=true 时不显示 loading 态，已有列表保持可见
  loadInvitations(silent) {
    if (!silent) this.setData({ loading: true })
    wx.cloud.callFunction({
      name: 'getMyInvitations',
      success: res => {
        if (res.result && res.result.success) {
          const list = res.result.data || []
          this.setData({
            invitations: list,
            isEmpty: list.length === 0,
            loading: false
          })
        } else {
          this.setData({ loading: false })
          wx.showToast({ title: '加载失败', icon: 'none' })
        }
      },
      fail: err => {
        console.error('loadInvitations failed:', err)
        this.setData({ loading: false })
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    })
  },

  // 新建请柬 → 去模板选择页
  goCreate() {
    wx.navigateTo({ url: '/pages/creator/template/template' })
  },

  // 查看请柬（以来宾视角预览）
  onView(e) {
    const id = e.detail.id
    wx.navigateTo({
      url: `/pages/guest/view/view?inv=${id}`
    })
  },

  // 编辑请柬
  onEdit(e) {
    const id = e.detail.id
    wx.navigateTo({
      url: `/pages/creator/editor/editor?id=${id}`
    })
  },

  // 分享管理
  onShare(e) {
    const id = e.detail.id
    wx.navigateTo({
      url: `/pages/creator/share/share?id=${id}`
    })
  },

  // RSVP 统计
  onStats(e) {
    const id = e.detail.id
    wx.navigateTo({
      url: `/pages/creator/rsvp-stats/rsvp-stats?id=${id}`
    })
  },

  // 删除请柬
  onDelete(e) {
    const id = e.detail.id
    wx.showModal({
      title: '删除请柬',
      content: '删除后不可恢复，确定要删除吗？',
      confirmColor: '#ff6b6b',
      success: res => {
        if (res.confirm) {
          this.deleteInvitation(id)
        }
      }
    })
  },

  deleteInvitation(id) {
    wx.showLoading({ title: '删除中...' })
    wx.cloud.callFunction({
      name: 'deleteInvitation',
      data: { invitationId: id },
      success: res => {
        wx.hideLoading()
        if (res.result && res.result.success) {
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadInvitations()
        } else {
          wx.showToast({ title: res.result.message || '删除失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    })
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadInvitations()
    wx.stopPullDownRefresh()
  }
})
