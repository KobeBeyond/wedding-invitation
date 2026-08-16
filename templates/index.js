// templates/index.js — 请柬模板配置
// 每个模板定义一套视觉风格（颜色 + 字体 + 装饰元素）

const templates = {
  'classic-rose': {
    id: 'classic-rose',
    name: '经典玫瑰',
    desc: '浪漫温馨，粉色主调',
    colors: {
      primary: '#e8a0a0',
      secondary: '#d4af37',
      background: '#fdf5f6',
      text: '#4a4a4a',
      accent: '#ff6b81',
      card: '#ffffff',
      border: '#f0e0e0',
      muted: '#999999'
    },
    font: 'serif',
    icon: '🌹'
  },

  'elegant-gold': {
    id: 'elegant-gold',
    name: '鎏金岁月',
    desc: '奢华大气，金色主调',
    colors: {
      primary: '#c9a55c',
      secondary: '#8b6914',
      background: '#1a1a2e',
      text: '#f0e6d2',
      accent: '#d4af37',
      card: '#16213e',
      border: '#2a2a4a',
      muted: '#8a8a9a'
    },
    font: 'serif',
    icon: '👑'
  },

  'minimal-white': {
    id: 'minimal-white',
    name: '极简白',
    desc: '简约现代，黑白主调',
    colors: {
      primary: '#333333',
      secondary: '#888888',
      background: '#ffffff',
      text: '#1a1a1a',
      accent: '#ff6b81',
      card: '#f8f8f8',
      border: '#e8e8e8',
      muted: '#aaaaaa'
    },
    font: 'sans-serif',
    icon: '⚪'
  }
}

// 获取模板列表（数组形式）
function getTemplateList() {
  return Object.keys(templates).map(key => templates[key])
}

// 获取单个模板
function getTemplate(id) {
  return templates[id] || templates['classic-rose']
}

module.exports = {
  templates,
  getTemplateList,
  getTemplate
}
