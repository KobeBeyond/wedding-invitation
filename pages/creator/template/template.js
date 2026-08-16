// pages/creator/template/template.js
const { getTemplateList } = require('../../../templates/index.js')

Page({
  data: {
    templates: [],
    selectedId: ''
  },

  onLoad() {
    this.setData({
      templates: getTemplateList(),
      selectedId: 'classic-rose'
    })
  },

  // 选择模板
  selectTemplate(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ selectedId: id })
  },

  // 确认创建
  confirmCreate() {
    const templateId = this.data.selectedId
    wx.showLoading({ title: '创建中...' })

    wx.cloud.callFunction({
      name: 'createInvitation',
      data: { template: templateId },
      success: res => {
        wx.hideLoading()
        if (res.result && res.result.success) {
          // 跳转到编辑器
          wx.redirectTo({
            url: `/pages/creator/editor/editor?id=${res.result._id}`
          })
        } else {
          wx.showToast({ title: res.result.message || '创建失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    })
  }
})
