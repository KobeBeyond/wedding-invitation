// cloudfunctions/getBlessingQuotes/index.js
// 查询祝福语录库；若库为空则自动 seed 100 条预设语录
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 100条精简祝福语录（每条约8-15字，加emoji后预览框可完整显示）
const QUOTES = [
  '愿你们百年好合',
  '新婚快乐白头偕老',
  '执子之手与子偕老',
  '天作之合鸾凤和鸣',
  '往后余生皆是甜蜜',
  '琴瑟和鸣幸福美满',
  '爱情甜蜜如初',
  '岁月温柔爱情长久',
  '爱情历久弥新',
  '花好月圆永浴爱河',
  '珠联璧合佳偶天成',
  '缘定三生情深似海',
  '比翼双飞连理同心',
  '金玉良缘天配一对',
  '从校服到婚纱',
  '始于初见止于终老',
  '往后余生风雪是你',
  '春风十里不如你',
  '遇见你是故事开始',
  '此生固短无你何欢',
  '既见君子云胡不喜',
  '今夕何夕见此良人',
  '结发为夫妻恩爱不疑',
  '愿得一心人白头不离',
  '两情若是久长时',
  '身无彩凤心有灵犀',
  '在天愿作比翼鸟',
  '愿我如星君如月',
  '死生契阔与子成说',
  '琴瑟在御莫不静好',
  '桃之夭夭灼灼其华',
  '青青子衿悠悠我心',
  '愿你们生活像蜜甜',
  '柴米油盐皆是爱',
  '一屋两人三餐四季',
  '有你便不平凡',
  '陪伴是最长情告白',
  '永远像热恋般甜蜜',
  '爱情最美是现在',
  '余生请多指教',
  '愿爱情经得起考验',
  '小日子越过越红火',
  '每天有说不完的话',
  '眼里永远有彼此',
  '笑容永远灿烂',
  '爱情像美酒越陈越香',
  '携手走过春夏秋冬',
  '家里充满欢声笑语',
  '未来比想象更美好',
  '爱情是最好避风港',
  '在对方眼里是初样',
  '婚姻是爱延续',
  '吵架也记得对方好',
  '信任永不被辜负',
  '包容化解不愉快',
  '理解是最深默契',
  '支持对方勇敢追梦',
  '鼓励是彼此力量',
  '携手让困难渺小',
  '同行让旅途惊喜',
  '相守让岁月温柔',
  '承诺比誓言坚定',
  '珍惜让平凡珍贵',
  '感恩让付出值得',
  '浪漫永不褪色',
  '惊喜永远新鲜',
  '仪式感让每天特别',
  '小确幸填满日子',
  '纪念日一年比一年甜',
  '周末有电影有奶茶',
  '旅行有风景有回忆',
  '睡前有好梦安全感',
  '清晨有阳光有期待',
  '节日有礼物有惊喜',
  '生日有蛋糕有愿望',
  '日常有吐槽有欢笑',
  '未来有房子有车子',
  '白头有摇椅有夕阳',
  '幸福就是在一起',
  '爱是相互的迁就',
  '愿你们永远幸福',
  '执子之手与子偕老',
  '新婚快乐永结同心',
  '愿爱如星辰永恒',
  '一生一世一双人',
  '爱情需要经营',
  '愿你们相知相守',
  '彼此是最好选择',
  '愿你们相濡以沫',
  '爱让世界更美好',
  '祝你们永远相爱',
  '愿幸福伴你们左右',
  '爱情是最好的礼物',
  '愿你们恩爱到白头',
  '执子之手白头偕老',
  '祝百年好合美满',
  '愿你们甜甜蜜蜜',
  '爱情万岁幸福永久',
  '祝新婚快乐幸福',
  '愿你们情比金坚',
  '爱是最美的语言',
  '愿你们永远快乐',
  '祝你们白头到老',
  '愿你们相爱一生',
  '幸福从此开始',
  '愿你们携手一生',
  '祝你们幸福美满',
  '愿你们永远甜蜜',
  '爱是永恒的承诺',
  '祝你们永浴爱河',
  '愿你们相爱永远'
]

async function seedQuotes() {
  const batch = 20
  const emojis = ['💒', '☺️', '😄', '🌹', '💕', '✨', '🎊', '🌸', '💫', '🌈', '💖', '🥂', '🍾', '💐', '🎉', '❤️', '🤍', '🧡']
  for (let i = 0; i < QUOTES.length; i += batch) {
    const chunk = QUOTES.slice(i, i + batch).map((text, idx) => {
      const emoji = emojis[(i + idx) % emojis.length]
      return { text: text + ' ' + emoji, createdAt: db.serverDate() }
    })
    await db.collection('blessingQuotes').add({ data: chunk })
  }
}

exports.main = async (event, context) => {
  try {
    let total = 0
    try {
      const res = await db.collection('blessingQuotes').count()
      total = res.total || 0
    } catch (countErr) {
      // 集合不存在时自动创建
      const msg = countErr.message || ''
      if (msg.includes('not found') || msg.includes('不存在') || msg.includes('Invalid collection')) {
        console.log('集合不存在，尝试创建...')
        await db.createCollection('blessingQuotes')
        console.log('集合创建成功')
      } else {
        throw countErr
      }
    }

    // 库为空时自动 seed
    if (total === 0) {
      await seedQuotes()
      const res = await db.collection('blessingQuotes').count()
      total = res.total || 0
    }

    const listRes = await db.collection('blessingQuotes').get()
    return { success: true, data: listRes.data || [], total: listRes.data.length }
  } catch (err) {
    console.error('getBlessingQuotes error:', err)
    return { success: false, data: [], message: err.message || '查询失败' }
  }
}
