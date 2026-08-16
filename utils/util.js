// utils/util.js

/**
 * 格式化日期为中文格式
 */
function formatTime(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  return `${year}年${pad(month)}月${pad(day)}日`
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

/**
 * 计算倒计时
 * @param {string} targetDate - 目标日期 YYYY-MM-DD
 * @returns {{days:number,hours:number,minutes:number,seconds:number}|null}
 */
function getCountdown(targetDate) {
  const target = new Date(targetDate + 'T00:00:00').getTime()
  const now = Date.now()
  let diff = target - now
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, finished: true }
  }
  const days    = Math.floor(diff / 86400000)
  const hours   = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  return { days, hours, minutes, seconds, finished: false }
}

/**
 * 生成简单随机 ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6)
}

/**
 * 节流函数
 */
function throttle(fn, delay) {
  let last = 0
  return function () {
    const now = Date.now()
    if (now - last >= delay) {
      last = now
      fn.apply(this, arguments)
    }
  }
}

module.exports = {
  formatTime,
  formatDate,
  getCountdown,
  generateId,
  throttle,
  pad
}
