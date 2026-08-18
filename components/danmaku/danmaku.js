// components/danmaku/danmaku.js
const util = require('../../utils/util.js')

const COLORS = [
  '#fff8f0', '#fff0f0', '#fdf5f6', '#fce8ec',
  '#fff5e6', '#ffeecc', '#f9f0e8', '#f5ebe0'
]

Component({
  data: {
    danmuList: []
  },

  methods: {
    /**
     * 添加一条弹幕
     * @param {string} text - 弹幕文字
     */
    addDanmu(text) {
      if (!text || !text.trim()) return

      const id = util.generateId()
      const top = Math.random() * 70 + 5       // 5% ~ 75%
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      const fontSize = Math.floor(Math.random() * 16) + 28  // 28~44rpx
      const duration = Math.random() * 7 + 8    // 8~15s
      const delay = Math.random() * 0.5         // 0~0.5s

      const danmu = { id, text, top, color, fontSize, duration, delay }

      this.setData({
        danmuList: this.data.danmuList.concat([danmu])
      })

      // 动画结束后移除
      const totalMs = (duration + delay) * 1000 + 500
      setTimeout(() => {
        const list = this.data.danmuList.filter(d => d.id !== id)
        this.setData({ danmuList: list })
      }, totalMs)
    },

    /**
     * 批量添加弹幕（用于加载历史数据时）
     * @param {Array} items - 文字数组
     */
    addBatch(items) {
      if (!items || !items.length) return
      items.forEach((text, i) => {
        setTimeout(() => this.addDanmu(text), i * 800)
      })
    },

    /**
     * 清空弹幕
     */
    clear() {
      this.setData({ danmuList: [] })
    }
  }
})
