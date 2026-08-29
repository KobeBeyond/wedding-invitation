// components/danmaku/danmaku.js
// 弹幕组件：轨道制防重叠 + 超长省略号 + 循环播放（无时效性，播完一轮从头再来）
const util = require('../../utils/util.js')

// 轨道配置：垂直方向固定 5 条轨道（百分比 top），同轨道弹幕间隔足够远保证不重叠
const LANES = [10, 27, 44, 61, 78]
// 单条弹幕穿屏时长（秒）：从右侧屏幕外移动到左侧屏幕外
const DURATION = 10
// 同一轨道两条弹幕的最小出发间隔（秒）：> DURATION 保证同轨道屏幕内最多 1 条，不重叠
const LANE_GAP = 12
// 全局相邻两条弹幕（任意轨道）最小出发间隔（秒），控制密度：
// DURATION / GLOBAL_GAP ≈ 同屏并发数，3s 时约 3~4 条同屏，不会满屏
const GLOBAL_GAP = 3

Component({
  data: {
    danmuList: []
  },

  lifetimes: {
    detached() {
      this._clearTimers()
    }
  },

  methods: {
    _clearTimers() {
      if (this._timers && this._timers.length) {
        this._timers.forEach(t => clearTimeout(t))
      }
      this._timers = []
      if (this._loopTimer) {
        clearTimeout(this._loopTimer)
        this._loopTimer = null
      }
    },

    // 轨道状态：每条轨道下一次可安排弹幕的时刻（相对调度原点的秒数）
    // 供即时弹幕（用户刚发送）做绝对时刻分配
    _initLanes() {
      if (!this._laneFreeAt) {
        this._laneFreeAt = LANES.map(() => 0)
        this._laneLastStart = LANES.map(() => 0)
      }
    },

    /**
     * 添加一条即时弹幕（用户刚发送的）
     * 走轨道分配，保证与正在飘的弹幕不重叠
     */
    addDanmu(text, avatar, name, options = {}) {
      if (!text || !text.trim()) return
      this._initLanes()
      const now = Date.now() / 1000
      this._emit(text, avatar, name, {
        lane: this._pickLane(now),
        at: now + 0.1
      })
    },

    /**
     * 批量循环播放：保存列表，播完一轮后从头再来
     * 有头像的弹幕排前面，优先展示（新发的弹幕均已强制带头像，
     * 旧的无头像数据靠后展示）
     * @param {Array} items - [{ text, avatar, name }, ...]
     */
    addBatch(items, options = {}) {
      if (!items || !items.length) return
      const sorted = items.slice().sort((a, b) => {
        return (b.avatar && b.avatar.length ? 1 : 0) - (a.avatar && a.avatar.length ? 1 : 0)
      })
      this._loopItems = sorted
      this._playRound()
    },

    // 播放一轮：为每条弹幕分配轨道和出发时刻
    _playRound() {
      this._clearTimers()
      const items = this._loopItems || []
      if (!items.length) return

      this._initLanes()
      // 重置轨道状态（新一轮从现在开始）
      const origin = Date.now() / 1000
      const laneFreeAt = LANES.map(() => 0)      // 相对 origin 的秒数
      const laneLastStart = LANES.map(() => 0)
      let lastStart = -GLOBAL_GAP               // 全局上一条出发时刻
      let lastEnd = 0                            // 本轮结束时刻

      items.forEach((item, i) => {
        // 选一条「最早可用」的轨道
        let lane = 0
        for (let l = 1; l < LANES.length; l++) {
          if (laneFreeAt[l] < laneFreeAt[lane]) lane = l
        }
        let t = Math.max(laneFreeAt[lane], lastStart + GLOBAL_GAP)
        lastStart = t
        laneFreeAt[lane] = t + LANE_GAP
        laneLastStart[lane] = t
        lastEnd = Math.max(lastEnd, t + DURATION)

        const delayMs = (t) * 1000 + 200  // 稍加缓冲
        this._timers.push(setTimeout(() => {
          this._emit(item.text, item.avatar, item.name, { lane, at: Date.now() / 1000 + 0.05 })
        }, delayMs))
      })

      // 一轮结束后循环从头播放
      const roundMs = (lastEnd + 2) * 1000
      this._loopTimer = setTimeout(() => {
        this._playRound()
      }, roundMs)
    },

    // 即时弹幕的轨道分配：找最早空闲的轨道
    _pickLane(now) {
      this._initLanes()
      let lane = 0
      let earliest = Infinity
      for (let l = 0; l < LANES.length; l++) {
        const freeAt = this._laneFreeAt[l] || 0
        // 以绝对秒数比较
        const abs = freeAt + (this._laneOrigin || now)
        if (abs < earliest) {
          earliest = abs
          lane = l
        }
      }
      this._laneOrigin = now
      this._laneFreeAt[lane] = Math.max(this._laneFreeAt[lane] || 0, 6)
      return lane
    },

    // 实际渲染一条弹幕
    _emit(text, avatar, name, { lane, at }) {
      if (!text || !text.trim()) return
      const id = util.generateId()
      const now = Date.now() / 1000
      const delay = Math.max(0, at - now)
      // 轨道内位置微调（±3%），避免完全对齐显得呆板
      const top = LANES[lane % LANES.length] + (Math.random() * 6 - 3)

      const danmu = { id, text, avatar: avatar || '', top, duration: DURATION, delay }

      this.setData({
        danmuList: this.data.danmuList.concat([danmu])
      })

      const totalMs = (delay + DURATION) * 1000 + 500
      setTimeout(() => {
        const list = this.data.danmuList.filter(d => d.id !== id)
        this.setData({ danmuList: list })
      }, totalMs)
    },

    /**
     * 清空弹幕并停止循环
     */
    clear() {
      this._clearTimers()
      this._loopItems = []
      this.setData({ danmuList: [] })
    }
  }
})
