// pages/creator/editor/editor.js
Page({
  data: {
    invitationId: '',
    invitation: null,
    loading: true,
    saving: false,

    // 编辑步骤
    steps: ['基本信息', '婚纱照', '婚礼地点', '时间线', '音乐封面'],
    currentStep: 0,

    // 表单数据
    groomName: '',
    brideName: '',
    weddingDate: '',
    groomIntro: '',
    brideIntro: '',
    photos: [],
    venueName: '',
    venueAddress: '',
    venueHall: '',
    venueLat: 0,
    venueLng: 0,
    venuePhone: '',
    timeline: [],
    musicUrl: '',
    coverImage: '',
    shareTitle: ''
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ invitationId: options.id })
      this.loadInvitation(options.id)
    } else {
      wx.showToast({ title: '缺少请柬ID', icon: 'none' })
    }
  },

  // 加载请柬数据
  loadInvitation(id) {
    wx.cloud.callFunction({
      name: 'getInvitation',
      data: { invitationId: id },
      success: res => {
        if (res.result && res.result.success) {
          const d = res.result.data
          this.setData({
            invitation: d,
            groomName: d.groomName || '',
            brideName: d.brideName || '',
            weddingDate: d.weddingDate || '',
            groomIntro: d.groomIntro || '',
            brideIntro: d.brideIntro || '',
            photos: d.photos || [],
            venueName: d.venueName || '',
            venueAddress: d.venueAddress || '',
            venueHall: d.venueHall || '',
            venueLat: d.venueLat || 0,
            venueLng: d.venueLng || 0,
            venuePhone: d.venuePhone || '',
            timeline: d.timeline || [],
            musicUrl: d.musicUrl || '',
            coverImage: d.coverImage || '',
            shareTitle: d.shareTitle || '',
            loading: false
          })
        } else {
          this.setData({ loading: false })
          wx.showToast({ title: res.result.message || '加载失败', icon: 'none' })
        }
      },
      fail: () => {
        this.setData({ loading: false })
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    })
  },

  // 步骤切换
  goStep(e) {
    const step = e.currentTarget.dataset.step
    this.setData({ currentStep: step })
  },

  prevStep() {
    if (this.data.currentStep > 0) {
      this.setData({ currentStep: this.data.currentStep - 1 })
    }
  },

  nextStep() {
    if (this.data.currentStep < this.data.steps.length - 1) {
      this.setData({ currentStep: this.data.currentStep + 1 })
    }
  },

  // 输入框绑定
  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  // 日期选择
  onDateChange(e) {
    this.setData({ weddingDate: e.detail.value })
  },

  // 照片变更（photo-uploader 组件回调）
  onPhotosChange(e) {
    this.setData({ photos: e.detail.photos })
  },

  // 选择地点（地图选点）
  onPickLocation() {
    wx.getSetting({
      success: res => {
        const hasAuth = res.authSetting['scope.userLocation']
        if (hasAuth === false) {
          wx.showModal({
            title: '需要位置权限',
            content: '请在设置中开启位置权限后重试',
            confirmText: '去设置',
            success: modalRes => {
              if (modalRes.confirm) wx.openSetting()
            }
          })
          return
        }
        wx.chooseLocation({
          success: res => {
            this.setData({
              venueAddress: res.address || res.name,
              venueLat: res.latitude,
              venueLng: res.longitude
            })
          },
          fail: err => {
            console.error('chooseLocation fail', err)
            if (err.errMsg && err.errMsg.includes('cancel')) return
            wx.showToast({ title: '选点失败，请重试', icon: 'none' })
          }
        })
      }
    })
  },

  // 时间线操作
  addTimelineItem() {
    const timeline = [...this.data.timeline]
    timeline.push({ time: '', title: '', description: '' })
    this.setData({ timeline })
  },

  onTimelineInput(e) {
    const { index, field } = e.currentTarget.dataset
    const timeline = [...this.data.timeline]
    timeline[index][field] = e.detail.value
    this.setData({ timeline })
  },

  removeTimelineItem(e) {
    const index = e.currentTarget.dataset.index
    const timeline = [...this.data.timeline]
    timeline.splice(index, 1)
    this.setData({ timeline })
  },

  // 选择封面图
  chooseCoverImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: res => {
        const tempFile = res.tempFiles[0]
        wx.showLoading({ title: '上传中...' })
        wx.cloud.uploadFile({
          cloudPath: `covers/${Date.now()}.jpg`,
          filePath: tempFile.tempFilePath,
          success: res => {
            this.setData({ coverImage: res.fileID })
          },
          fail: () => {
            wx.showToast({ title: '上传失败', icon: 'none' })
          },
          complete: () => {
            wx.hideLoading()
          }
        })
      }
    })
  },

  // 选择音乐
  chooseMusic() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['mp3', 'm4a', 'aac'],
      success: res => {
        const tempFile = res.tempFiles[0]
        if (tempFile.size > 10 * 1024 * 1024) {
          wx.showToast({ title: '文件不能超过10MB', icon: 'none' })
          return
        }
        wx.showLoading({ title: '上传中...' })
        wx.cloud.uploadFile({
          cloudPath: `music/${Date.now()}.${tempFile.name.split('.').pop()}`,
          filePath: tempFile.path,
          success: res => {
            this.setData({ musicUrl: res.fileID })
            wx.showToast({ title: '上传成功', icon: 'success' })
          },
          fail: () => {
            wx.showToast({ title: '上传失败', icon: 'none' })
          },
          complete: () => {
            wx.hideLoading()
          }
        })
      }
    })
  },

  // 收集表单数据
  collectFormData() {
    return {
      invitationId: this.data.invitationId,
      groomName: this.data.groomName,
      brideName: this.data.brideName,
      weddingDate: this.data.weddingDate,
      groomIntro: this.data.groomIntro,
      brideIntro: this.data.brideIntro,
      photos: this.data.photos,
      venueName: this.data.venueName,
      venueAddress: this.data.venueAddress,
      venueHall: this.data.venueHall,
      venueLat: this.data.venueLat,
      venueLng: this.data.venueLng,
      venuePhone: this.data.venuePhone,
      timeline: this.data.timeline,
      musicUrl: this.data.musicUrl,
      coverImage: this.data.coverImage,
      shareTitle: this.data.shareTitle
    }
  },

  // 保存草稿
  saveDraft() {
    this.setData({ saving: true })
    wx.cloud.callFunction({
      name: 'updateInvitation',
      data: this.collectFormData(),
      success: res => {
        if (res.result && res.result.success) {
          wx.showToast({ title: '已保存草稿', icon: 'success' })
        } else {
          wx.showToast({ title: res.result.message || '保存失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '网络错误', icon: 'none' })
      },
      complete: () => {
        this.setData({ saving: false })
      }
    })
  },

  // 发布
  publish() {
    const { groomName, brideName, weddingDate, venueName } = this.data
    if (!groomName || !brideName || !weddingDate || !venueName) {
      wx.showToast({ title: '请先填写基本信息', icon: 'none' })
      this.setData({ currentStep: 0 })
      return
    }

    // 先保存数据
    this.setData({ saving: true })
    wx.cloud.callFunction({
      name: 'updateInvitation',
      data: this.collectFormData(),
      success: res => {
        if (res.result && res.result.success) {
          // 再发布
          wx.cloud.callFunction({
            name: 'publishInvitation',
            data: { invitationId: this.data.invitationId },
            success: res => {
              if (res.result && res.result.success) {
                wx.showToast({ title: '发布成功！', icon: 'success' })
                setTimeout(() => {
                  wx.redirectTo({
                    url: `/pages/creator/share/share?id=${this.data.invitationId}`
                  })
                }, 1500)
              } else {
                wx.showToast({ title: res.result.message || '发布失败', icon: 'none' })
              }
            },
            fail: () => {
              wx.showToast({ title: '网络错误', icon: 'none' })
            },
            complete: () => {
              this.setData({ saving: false })
            }
          })
        } else {
          wx.showToast({ title: res.result.message || '保存失败', icon: 'none' })
          this.setData({ saving: false })
        }
      },
      fail: () => {
        wx.showToast({ title: '网络错误', icon: 'none' })
        this.setData({ saving: false })
      }
    })
  }
})
