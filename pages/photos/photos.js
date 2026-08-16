// pages/photos/photos.js
Page({
  data: {
    photos: [],
    photoRows: [],
    currentIdx: 0
  },

  onLoad() {
    const app = getApp()
    const photos = app.globalData.photos || []
    // 按每行 3 个分组
    const photoRows = []
    for (let i = 0; i < photos.length; i += 3) {
      const row = photos.slice(i, i + 3).map((p, j) => ({
        ...p,
        idx: i + j
      }))
      photoRows.push(row)
    }
    this.setData({ photos, photoRows })
  },

  swiperChange(e) {
    this.setData({ currentIdx: e.detail.current })
  },

  tapThumbnail(e) {
    const idx = e.currentTarget.dataset.idx
    this.setData({ currentIdx: idx })
  },

  previewPhoto(e) {
    const idx = e.currentTarget.dataset.idx
    const urls = this.data.photos
      .filter(p => p.url)
      .map(p => p.url)
    if (urls.length === 0) {
      wx.showToast({ title: '请先配置婚纱照', icon: 'none' })
      return
    }
    wx.previewImage({
      current: urls[idx] || urls[0],
      urls
    })
  },

  onShareAppMessage() {
    const app = getApp()
    return {
      title: `${app.globalData.groomName}&${app.globalData.brideName}的幸福瞬间`,
      path: '/pages/photos/photos'
    }
  }
})
