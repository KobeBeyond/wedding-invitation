// cloudfunctions/updateInvitation/index.js — 更新请柬内容
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 允许更新的字段白名单
const ALLOWED_FIELDS = [
  'groomName', 'brideName', 'groomAvatar', 'brideAvatar',
  'weddingDate', 'groomIntro', 'brideIntro',
  'venueName', 'venueAddress', 'venueHall', 'venueLat', 'venueLng', 'venuePhone',
  'photos', 'musicUrl', 'coverImage', 'shareImage', 'timeline', 'shareTitle', 'expiryDate',
  'template'
]

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { invitationId, ...updates } = event

  if (!invitationId) {
    return { success: false, message: '缺少请柬ID' }
  }

  try {
    // 权限校验：只有创建者可以更新
    const inv = await db.collection('invitations').doc(invitationId).get()
    if (!inv.data) {
      return { success: false, message: '请柬不存在' }
    }
    if (inv.data.creatorOpenid !== OPENID) {
      return { success: false, message: '无权操作' }
    }

    // 过滤字段，只更新白名单中的
    const cleanData = {}
    for (const key of ALLOWED_FIELDS) {
      if (updates[key] !== undefined) {
        cleanData[key] = updates[key]
      }
    }
    cleanData.updatedAt = db.serverDate()

    await db.collection('invitations').doc(invitationId).update({
      data: cleanData
    })
    return { success: true }
  } catch (err) {
    console.error('updateInvitation error:', err)
    return { success: false, message: '更新失败: ' + err.message }
  }
}
