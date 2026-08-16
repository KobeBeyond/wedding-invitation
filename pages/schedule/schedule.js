// pages/schedule/schedule.js
Page({
  data: {
    schedule: [
      { time: '09:30', icon: '👋', title: '迎宾签到', desc: '婚礼酒店大厅，请准时到达签到' },
      { time: '10:18', icon: '💍', title: '婚礼仪式', desc: '交换戒指、宣誓，见证幸福时刻' },
      { time: '11:00', icon: '📸', title: '合影留念', desc: '与亲友合影，定格美好瞬间' },
      { time: '11:30', icon: '🥂', title: '敬酒环节', desc: '新人逐桌敬酒，感谢亲友到来' },
      { time: '12:00', icon: '🍽', title: '婚宴开席', desc: '请大家尽情享用，共度美好时光' },
      { time: '14:00', icon: '🎊', title: '送客', desc: '感谢各位的到来，期待再聚' }
    ]
  },

  onShareAppMessage() {
    const app = getApp()
    return {
      title: `${app.globalData.groomName}&${app.globalData.brideName}的婚礼流程`,
      path: '/pages/schedule/schedule'
    }
  }
})
