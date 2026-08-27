// pages/admin/compress/compress.js — 批量压缩已有图片
const { compressImage } = require('../../utils/util.js')

Page({
  data: {
    loading: false,
    logs: [],
    total: 0,
    done: 0
  },

  onLoad() {
    wx.showModal({
      title: '批量压缩图片',
      content: '这将遍历所有请柬，把超过2MB的图片压缩后替换。操作不可撤销，是否继续？',
      success: res => {
        if (res.confirm) this.startCompress()
      }
    })
  },

  log(msg) {
    const logs = this.data.logs
    logs.push(msg)
    this.setData({ logs: logs.slice(-50) })
    console.log('[Compress]', msg)
  },

  async startCompress() {
    this.setData({ loading: true })
    try {
      // 1. 拉取所有请柬
      this.log('正在查询请柬列表...')
      const invRes = await wx.cloud.callFunction({ name: 'getMyInvitations' })
      if (!invRes.result || !invRes.result.success) {
        this.log('查询失败: ' + (invRes.result && invRes.result.message))
        return
      }
      const invitations = invRes.result.data || []
      this.setData({ total: invitations.length })
      this.log(`共 ${invitations.length} 条请柬`)

      // 2. 逐条处理
      for (let i = 0; i < invitations.length; i++) {
        const inv = invitations[i]
        this.setData({ done: i + 1 })
        this.log(`[${i + 1}/${invitations.length}] 处理请柬 ${inv._id}`)
        await this.processInvitation(inv)
      }

      this.log('✅ 全部处理完成')
      wx.showToast({ title: '处理完成', icon: 'success' })
    } catch (err) {
      this.log('❌ 异常: ' + err.message)
      console.error(err)
    } finally {
      this.setData({ loading: false })
    }
  },

  async processInvitation(inv) {
    const updateData = {}
    const MAX_SIZE = 2 * 1024 * 1024

    // 处理封面图
    if (inv.coverImage) {
      const newFileID = await this.compressAndReupload(inv.coverImage, 'cover', MAX_SIZE)
      if (newFileID) updateData.coverImage = newFileID
    }

    // 处理新郎头像
    if (inv.groomAvatar) {
      const newFileID = await this.compressAndReupload(inv.groomAvatar, 'groomAvatar', MAX_SIZE)
      if (newFileID) updateData.groomAvatar = newFileID
    }

    // 处理新娘头像
    if (inv.brideAvatar) {
      const newFileID = await this.compressAndReupload(inv.brideAvatar, 'brideAvatar', MAX_SIZE)
      if (newFileID) updateData.brideAvatar = newFileID
    }

    // 处理照片
    if (inv.photos && inv.photos.length > 0) {
      const newPhotos = []
      for (let j = 0; j < inv.photos.length; j++) {
        const p = inv.photos[j]
        const url = p.url || p.fileID
        if (url) {
          const newFileID = await this.compressAndReupload(url, `photo_${j}`, MAX_SIZE)
          newPhotos.push({
            id: p.id || `${Date.now()}_${j}`,
            fileID: newFileID || url,
            url: newFileID || url
          })
        }
      }
      if (newPhotos.length > 0) updateData.photos = newPhotos
    }

    // 更新数据库
    if (Object.keys(updateData).length > 0) {
      try {
        await wx.cloud.callFunction({
          name: 'updateInvitation',
          data: {
            invitationId: inv._id,
            ...updateData
          }
        })
        this.log(`  → 已更新`)
      } catch (err) {
        this.log(`  → 更新失败: ${err.message}`)
      }
    } else {
      this.log(`  → 无需更新`)
    }
  },

  async compressAndReupload(fileID, label, maxBytes) {
    try {
      // 1. 下载到本地
      const downloadRes = await new Promise((resolve, reject) => {
        wx.cloud.downloadFile({ fileID, success: resolve, fail: reject })
      })
      const tempPath = downloadRes.tempFilePath

      // 2. 检查大小
      const info = await new Promise((resolve, reject) => {
        wx.getFileInfo({ filePath: tempPath, success: resolve, fail: reject })
      })

      if (info.size <= maxBytes) {
        this.log(`  ${label}: ${(info.size / 1024 / 1024).toFixed(2)}MB ≤ 2MB，跳过`)
        return null
      }

      this.log(`  ${label}: ${(info.size / 1024 / 1024).toFixed(2)}MB > 2MB，开始压缩...`)

      // 3. 压缩
      const compressedPath = await compressImage(tempPath, maxBytes)

      const newInfo = await new Promise((resolve, reject) => {
        wx.getFileInfo({ filePath: compressedPath, success: resolve, fail: reject })
      })
      this.log(`  ${label}: 压缩后 ${(newInfo.size / 1024 / 1024).toFixed(2)}MB`)

      // 4. 重新上传
      const folder = label.startsWith('photo') ? 'photos' : (label === 'cover' ? 'covers' : 'avatars')
      const uploadRes = await new Promise((resolve, reject) => {
        wx.cloud.uploadFile({
          cloudPath: `${folder}/${Date.now()}_${label}.jpg`,
          filePath: compressedPath,
          success: resolve,
          fail: reject
        })
      })

      // 5. 删除旧文件（不阻塞，失败也没关系）
      wx.cloud.deleteFile({ fileList: [fileID], success: () => {}, fail: () => {} })

      return uploadRes.fileID
    } catch (err) {
      this.log(`  ${label}: 处理失败 - ${err.message}`)
      return null
    }
  }
})
