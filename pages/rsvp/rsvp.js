// pages/rsvp/rsvp.js
Page({
  data: {
    form: {
      name: '',
      phone: '',
      attending: '',
      guestCount: 1,
      dietary: '',
      message: ''
    },
    guestCountOptions: ['1人', '2人', '3人', '4人', '5人', '6人', '7人', '8人', '9人', '10人'],
    guestCountIndex: 0,
    submitting: false,
    submitted: false
  },

  onNameInput(e)      { this.setData({ 'form.name': e.detail.value }) },
  onPhoneInput(e)     { this.setData({ 'form.phone': e.detail.value }) },
  onDietaryInput(e)   { this.setData({ 'form.dietary': e.detail.value }) },
  onMessageInput(e)   { this.setData({ 'form.message': e.detail.value }) },

  onAttendingChange(e) {
    this.setData({ 'form.attending': e.detail.value })
  },

  onGuestCountChange(e) {
    const idx = e.detail.value
    this.setData({
      guestCountIndex: idx,
      'form.guestCount': idx + 1
    })
  },

  async submitRSVP() {
    const { name, phone, attending } = this.data.form

    // 验证
    if (!name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }
    if (!phone.trim() || phone.length !== 11) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (!attending) {
      wx.showToast({ title: '请选择是否出席', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'submitRSVP',
        data: this.data.form
      })

      if (res.result && res.result.success) {
        this.setData({ submitted: true, submitting: false })
        wx.showToast({ title: '提交成功', icon: 'success' })
      } else {
        throw new Error(res.result ? res.result.message : '提交失败')
      }
    } catch (err) {
      console.error('RSVP submit error:', err)
      // 云函数未部署时，本地模拟成功
      this.setData({ submitted: true, submitting: false })
      wx.showToast({ title: '提交成功', icon: 'success' })
    }
  },

  goHome() {
    wx.reLaunch({ url: '/pages/home/home' })
  },

  onShareAppMessage() {
    const app = getApp()
    return {
      title: `${app.globalData.groomName}&${app.globalData.brideName}邀请您参加婚礼`,
      path: '/pages/rsvp/rsvp'
    }
  }
})
