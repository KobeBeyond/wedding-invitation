// pages/creator/dashboard/dashboard.js
const app = getApp()

Page({
  data: {
    invitations: [],
    loading: true,
    isEmpty: false,
    showAvatarModal: false,
    modalAvatarUrl: ''
  },

  onShow() {
    // 已有数据时静默刷新，不重置 loading 状态
    const silent = this.data.invitations.length > 0
    this.loadInvitations(silent)
  },

  // 检查本地是否有头像
  checkAvatar() {
    const cached = wx.getStorageSync('wedding_avatar')
    return !!cached
  },

  // 头像弹窗 — 选择头像
  onModalChooseAvatar(e) {
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
      getApp().updateUserInfo('', avatarUrl)
      this.setData({ showAvatarModal: false, modalAvatarUrl: '' })
      // 保存成功后加载数据
      this.loadInvitations(false)
    } catch (err) {
      console.error('保存头像失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
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
