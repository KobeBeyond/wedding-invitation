// utils/util.js

const MAX_SIZE = 2 * 1024 * 1024   // 2MB

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

/**
 * 压缩图片到指定大小以内（默认 2MB）
 * @param {string} filePath - 图片临时路径
 * @param {number} [maxBytes=2097152] - 最大字节数
 * @returns {Promise<string>} - 压缩后的临时路径
 */
function compressImage(filePath, maxBytes) {
  maxBytes = maxBytes || MAX_SIZE
  return new Promise((resolve, reject) => {
    // 先获取文件大小
    wx.getFileInfo({
      filePath,
      success: info => {
        if (info.size <= maxBytes) {
          resolve(filePath)
          return
        }
        // 超过限制，开始压缩
        tryCompress(filePath, info.size, maxBytes, resolve, reject)
      },
      fail: reject
    })
  })
}

/**
 * 递归尝试压缩，直到满足大小要求
 */
function tryCompress(filePath, currentSize, maxBytes, resolve, reject, quality) {
  quality = quality !== undefined ? quality : 80
  if (quality < 20) {
    // 质量太低了，直接返回最后一次压缩结果
    resolve(filePath)
    return
  }

  wx.compressImage({
    src: filePath,
    quality,
    success: res => {
      wx.getFileInfo({
        filePath: res.tempFilePath,
        success: info => {
          if (info.size <= maxBytes) {
            resolve(res.tempFilePath)
          } else {
            // 仍然超限，降低质量继续压
            tryCompress(res.tempFilePath, info.size, maxBytes, resolve, reject, quality - 20)
          }
        },
        fail: () => resolve(res.tempFilePath)
      })
    },
    fail: () => resolve(filePath)   // 压缩失败就用原图
  })
}

/**
 * 预加载一组图片到本地缓存
 * @param {string[]} urls - 图片地址数组
 */
function preloadImages(urls) {
  if (!urls || !urls.length) return
  urls.forEach(url => {
    if (!url) return
    wx.getImageInfo({
      src: url,
      fail: () => {}
    })
  })
}

module.exports = {
  formatTime,
  formatDate,
  getCountdown,
  generateId,
  throttle,
  pad,
  compressImage,
  preloadImages
}
