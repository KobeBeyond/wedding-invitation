// components/danmaku/danmaku.js
const util = require('../../utils/util.js')

Component({
  data: {
    danmuList: []
  },

  methods: {
    /**
     * 生成一个不与其他弹幕太近的垂直位置
     * @param {Array<number>} usedTops - 已占用的位置
     * @param {number} minGap - 最小间距（百分比）
     */
    _generateTop(usedTops, minGap = 12) {
      let attempts = 0
      let top
      do {
        top = Math.random() * 85 + 5   // 5% ~ 90%
        attempts++
      } while (attempts < 20 && usedTops.some(t => Math.abs(t - top) < minGap))
      return top
    },

    /**
     * 添加一条弹幕
     * @param {string} text     - 祝福语
     * @param {string} [avatar] - 头像 url
     * @param {string} [name]   - 昵称
     * @param {Object} [options] - 可选参数 { top, duration, delay }
     */
    addDanmu(text, avatar, name, options = {}) {
      if (!text || !text.trim()) return

      const id = util.generateId()

      // 垂直位置：优先用传入的，否则做碰撞避让
      const usedTops = this.data.danmuList.map(d => d.top)
      const top = options.top !== undefined
        ? options.top
        : this._generateTop(usedTops)

      const duration = options.duration !== undefined
        ? options.duration
        : (Math.random() * 4 + 6)   // 6~10s，比之前短，减少重叠感

      const delay = options.delay !== undefined
        ? options.delay
        : (Math.random() * 0.5)

      const initial = (name && name.trim()) ? name.trim().charAt(0).toUpperCase() : '♥'

      const danmu = { id, text, avatar: avatar || '', initial, top, duration, delay }

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
     * 批量添加弹幕，按照片轮播时间均匀分布
     * @param {Array} items    - [{ text, avatar, name }, ...]
     * @param {Object} options - { photoCount, interval }
     *   photoCount: 照片数量（决定时间窗口数）
     *   interval:  轮播间隔 ms，默认 3500
     */
    addBatch(items, options = {}) {
      if (!items || !items.length) return

      const photoCount = options.photoCount || 1
      const interval = (options.interval || 3500) / 1000   // 转成秒

    // 把弹幕随机打乱，再分配到各个照片的时间窗口
    const shuffled = items.slice().sort(() => Math.random() - 0.5)

      // 预先生成一组不重叠的垂直位置，循环复用
      const preAllocatedTops = []
      for (let i = 0; i < shuffled.length; i++) {
        preAllocatedTops.push(this._generateTop(preAllocatedTops))
      }

      shuffled.forEach((item, i) => {
        // 决定这条弹幕落在第几张照片的时间窗口
        const photoIndex = i % photoCount
        const windowStart = photoIndex * interval
        // 在窗口内随机偏移，留 1.5s 缓冲避免切到下一页时还在开头
        const randomOffset = Math.random() * (interval - 1.5)
        const startTime = (windowStart + randomOffset) * 1000

        setTimeout(() => {
          this.addDanmu(item.text, item.avatar, item.name, {
            top: preAllocatedTops[i],
            duration: Math.random() * 4 + 6,   // 6~10s
            delay: 0
          })
        }, startTime)
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
