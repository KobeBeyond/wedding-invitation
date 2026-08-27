// pages/creator/rsvp-stats/rsvp-stats.js
Page({
  data: {
    invitationId: '',
    loading: true,

    // 统计概览
    stats: {
      rsvpCount: 0,
      attendingGuests: 0,
      notAttendingGuests: 0,
      totalAttendingPeople: 0,
      blessingCount: 0
    },

    // 筛选
    filter: 'all', // all | yes | no
    filterOptions: [
      { key: 'all', label: '全部' },
      { key: 'yes', label: '出席' },
      { key: 'no', label: '缺席' }
    ],

    // 列表
    guestList: [],
    filteredList: []
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({ title: '请柬ID缺失', icon: 'none' })
      wx.navigateBack()
      return
    }
    this.setData({ invitationId: options.id })
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData()
    wx.stopPullDownRefresh()
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      // 并行拉取统计和明细
      const [statsRes, listRes] = await Promise.all([
        this.callGetStats(),
        this.callGetRSVPList()
      ])

      const stats = statsRes.result && statsRes.result.success
        ? statsRes.result
        : {
            rsvpCount: 0,
            attendingGuests: 0,
            notAttendingGuests: 0,
            totalAttendingPeople: 0,
            blessingCount: 0
          }

      // 补充缺席人数（getStats 没返回，从列表算）
      const guestList = (listRes.result && listRes.result.data) || []
      const notAttending = guestList.filter(g => g.attending === 'no').length

      this.setData({
        stats: {
          rsvpCount: stats.rsvpCount || 0,
          attendingGuests: stats.attendingGuests || 0,
          notAttendingGuests: notAttending,
          totalAttendingPeople: stats.totalAttendingPeople || 0,
          blessingCount: stats.blessingCount || 0
        },
        guestList: guestList,
        loading: false
      })
      this.applyFilter()
    } catch (err) {
      console.error('loadData error:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  callGetStats() {
    return wx.cloud.callFunction({
      name: 'getStats',
      data: { invitationId: this.data.invitationId }
    })
  },

  callGetRSVPList() {
    return wx.cloud.callFunction({
      name: 'getRSVPList',
      data: { invitationId: this.data.invitationId }
    })
  },

  // 切换筛选
  switchFilter(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ filter: key }, () => {
      this.applyFilter()
    })
  },

  applyFilter() {
    const { guestList, filter } = this.data
    let filtered = guestList
    if (filter === 'yes') {
      filtered = guestList.filter(g => g.attending === 'yes')
    } else if (filter === 'no') {
      filtered = guestList.filter(g => g.attending === 'no')
    }
    this.setData({ filteredList: filtered })
  }
})
