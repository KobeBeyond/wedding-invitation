// pages/blessings/blessings.js
Page({
  data: {
    inputText: '',
    blessingCount: 0,
    loading: true
  },

  watcher: null,

  onLoad() {
    this.loadBlessings()
    this.startWatch()
  },

  onUnload() {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  },

  // 加载历史祝福
  async loadBlessings() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getBlessings'
      })
      if (res.result && res.result.data) {
        this.setData({
          blessingCount: res.result.data.length,
          loading: false
        })
        // 逐条播放历史弹幕
        const danmaku = this.selectComponent('#danmaku')
        if (danmaku) {
          const texts = res.result.data.map(b => b.text)
          danmaku.addBatch(texts)
        }
      } else {
        this.setData({ loading: false })
      }
    } catch (err) {
      console.error('Load blessings error:', err)
      this.setData({ loading: false })
    }
  },

  // 实时监听新祝福
  startWatch() {
    const db = wx.cloud.database()
    this.watcher = db.collection('blessings')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .watch({
        onChange: (snapshot) => {
          if (!snapshot.docs || snapshot.docs.length === 0) return
          const newBlessing = snapshot.docs[0]
          // 避免重复
          if (this._lastBlessingId === newBlessing._id) return
          this._lastBlessingId = newBlessing._id

          this.setData({
            blessingCount: this.data.blessingCount + 1
          })

          const danmaku = this.selectComponent('#danmaku')
          if (danmaku) {
            danmaku.addDanmu(newBlessing.text)
          }
        },
        onError: (err) => {
          console.error('Watch error:', err)
        }
      })
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  // 发送祝福
  async sendBlessing() {
    const text = this.data.inputText.trim()
    if (!text) {
      wx.showToast({ title: '请输入祝福内容', icon: 'none' })
      return
    }

    // 先本地飘一条
    const danmaku = this.selectComponent('#danmaku')
    if (danmaku) {
      danmaku.addDanmu(text)
    }
    this.setData({ inputText: '' })

    try {
      await wx.cloud.callFunction({
        name: 'submitBlessing',
        data: { text }
      })
      // watcher 会自动更新计数，这里不重复加
    } catch (err) {
      console.error('Submit blessing error:', err)
      // 云函数未部署时，仍然本地显示弹幕
    }
  },

  onShareAppMessage() {
    const app = getApp()
    return {
      title: `${app.globalData.groomName}&${app.globalData.brideName}的祝福墙`,
      path: '/pages/blessings/blessings'
    }
  }
})
