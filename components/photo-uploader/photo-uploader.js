// components/photo-uploader/photo-uploader.js
const { compressImage } = require('../../utils/util.js')

Component({
  properties: {
    photos: { type: Array, value: [] },
    max: { type: Number, value: 9 },
    disabled: { type: Boolean, value: false }
  },

  data: {
    uploading: false,
    uploadProgress: 0
  },

  methods: {
    // 选择并上传照片
    choosePhoto() {
      if (this.data.uploading) return
      const current = this.properties.photos
      if (current.length >= this.properties.max) {
        wx.showToast({ title: `最多上传${this.properties.max}张`, icon: 'none' })
        return
      }
      const remaining = this.properties.max - current.length

      wx.chooseMedia({
        count: remaining,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: res => {
          this.uploadFiles(res.tempFiles)
        }
      })
    },

    // 上传文件到云存储（串行压缩+上传，避免并发过大）
    async uploadFiles(tempFiles) {
      if (!tempFiles || tempFiles.length === 0) return
      this.setData({ uploading: true, uploadProgress: 0 })

      const photos = this.properties.photos.slice()
      const total = tempFiles.length

      for (let i = 0; i < total; i++) {
        const file = tempFiles[i]
        try {
          // 先压缩到 2M 以内
          const compressedPath = await compressImage(file.tempFilePath)
          const timestamp = Date.now()
          const cloudPath = `photos/${timestamp}_${i}.jpg`
          const res = await new Promise((resolve, reject) => {
            wx.cloud.uploadFile({
              cloudPath,
              filePath: compressedPath,
              success: resolve,
              fail: reject
            })
          })
          photos.push({
            id: `${timestamp}_${i}`,
            fileID: res.fileID
          })
        } catch (err) {
          console.error('上传失败', err)
          wx.showToast({ title: `第${i + 1}张上传失败`, icon: 'none' })
        }
        this.setData({ uploadProgress: Math.round((i + 1) / total * 100) })
      }

      this.setData({ uploading: false, uploadProgress: 0 })
      this.triggerEvent('change', { photos })
    },

    // 删除照片
    deletePhoto(e) {
      const idx = e.currentTarget.dataset.index
      const photos = this.properties.photos.slice()
      photos.splice(idx, 1)
      this.triggerEvent('change', { photos })
    },

    // 预览照片
    previewPhoto(e) {
      const idx = e.currentTarget.dataset.index
      const photos = this.properties.photos
      wx.previewImage({
        current: photos[idx].fileID,
        urls: photos.map(p => p.fileID)
      })
    },

    // 上移
    moveUp(e) {
      const idx = e.currentTarget.dataset.index
      if (idx === 0) return
      const photos = this.properties.photos.slice()
      const temp = photos[idx - 1]
      photos[idx - 1] = photos[idx]
      photos[idx] = temp
      this.triggerEvent('change', { photos })
    },

    // 下移
    moveDown(e) {
      const idx = e.currentTarget.dataset.index
      const photos = this.properties.photos.slice()
      if (idx === photos.length - 1) return
      const temp = photos[idx + 1]
      photos[idx + 1] = photos[idx]
      photos[idx] = temp
      this.triggerEvent('change', { photos })
    }
  }
})
