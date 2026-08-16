// pages/creator/dashboard/dashboard.js
const app = getApp()

Page({
  data: {
    invitations: [],
    loading: true,
    isEmpty: false
  },

  onShow() {
    this.loadInvitations()
  },

  // 加载我的请柬列表
  loadInvitations() {
    this.setData({ loading: true })
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
