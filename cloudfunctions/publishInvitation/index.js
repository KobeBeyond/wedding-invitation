// cloudfunctions/publishInvitation/index.js — 发布请柬（draft → published）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { invitationId } = event

  if (!invitationId) {
    return { success: false, message: '缺少请柬ID' }
  }

  try {
    const inv = await db.collection('invitations').doc(invitationId).get()
    if (!inv.data) {
      return { success: false, message: '请柬不存在' }
    }
    if (inv.data.creatorOpenid !== OPENID) {
      return { success: false, message: '无权操作' }
    }

    // 校验必填字段
    const d = inv.data
    const missing = []
    if (!d.groomName) missing.push('新郎姓名')
    if (!d.brideName) missing.push('新娘姓名')
    if (!d.weddingDate) missing.push('婚礼日期')
    if (!d.venueName) missing.push('婚礼地点')
    if (missing.length > 0) {
      return { success: false, message: '请填写完整: ' + missing.join('、') }
    }

    await db.collection('invitations').doc(invitationId).update({
      data: {
        status: 'published',
        // 自动生成分享标题
        shareTitle: d.shareTitle || `${d.groomName}&${d.brideName}邀请您参加我们的婚礼`,
        updatedAt: db.serverDate()
      }
    })

    return { success: true, invitationId }
  } catch (err) {
    console.error('publishInvitation error:', err)
    return { success: false, message: '发布失败: ' + err.message }
  }
}
