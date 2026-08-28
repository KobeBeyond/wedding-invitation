// pages/common/avatar-setup/avatar-setup.js — 头像设置页
const app = getApp()

Page({
  data: {
    modalAvatarUrl: ''
  },

  onLoad() {
    // 如果已有头像，直接返回
    const cached = wx.getStorageSync('wedding_avatar')
    if (cached) {
      wx.navigateBack()
    }
  },

  // 选择头像
  onChooseAvatar(e) {
    const tempPath = e.detail.avatarUrl
    if (!tempPath) return
    this.setData({ modalAvatarUrl: tempPath }, () => {
      this.saveAvatar()
    })
  },

  // 保存头像
  async saveAvatar() {
    const { modalAvatarUrl } = this.data
    if (!modalAvatarUrl) return
    wx.showLoading({ title: '保存中...' })
    try {
      let avatarUrl = modalAvatarUrl
      if (modalAvatarUrl.startsWith('http://tmp') || modalAvatarUrl.startsWith('wxfile://')) {
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `avatars/user_${Date.now()}.jpg`,
          filePath: modalAvatarUrl
        })
        avatarUrl = uploadRes.fileID
      }
      wx.setStorageSync('wedding_avatar', avatarUrl)
      app.updateUserInfo('', avatarUrl)
      wx.showToast({ title: '设置成功', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack()
      }, 800)
    } catch (err) {
      console.error('保存头像失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  }
})
