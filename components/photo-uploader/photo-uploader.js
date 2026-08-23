// components/photo-uploader/photo-uploader.js
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

    // 上传文件到云存储
    uploadFiles(tempFiles) {
      if (!tempFiles || tempFiles.length === 0) return
      this.setData({ uploading: true, uploadProgress: 0 })

      const photos = this.properties.photos.slice()
      let completed = 0
      const total = tempFiles.length

      tempFiles.forEach((file, index) => {
        const timestamp = Date.now()
        const cloudPath = `photos/${timestamp}_${index}.${file.tempFilePath.split('.').pop()}`
        const task = wx.cloud.uploadFile({
          cloudPath,
          filePath: file.tempFilePath,
          success: res => {
            photos.push({
              id: `${timestamp}_${index}`,
              fileID: res.fileID
            })
          },
          fail: err => {
            console.error('上传失败', err)
            wx.showToast({ title: `第${index + 1}张上传失败`, icon: 'none' })
          },
          complete: () => {
            completed++
            this.setData({ uploadProgress: Math.round(completed / total * 100) })
            if (completed === total) {
              this.setData({ uploading: false, uploadProgress: 0 })
              this.triggerEvent('change', { photos })
            }
          }
        })
      })
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
