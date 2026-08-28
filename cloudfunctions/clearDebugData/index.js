// cloudfunctions/clearDebugData/index.js
// 清理 guests / blessings 集合，用于调试
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { type, invitationId } = event

  try {
    // 权限校验：仅允许 creator 清理自己的请柬数据
    if (!invitationId) {
      return { success: false, message: '请提供 invitationId' }
    }

    const invRes = await db.collection('invitations').doc(invitationId).get()
    const inv = invRes.data
    if (!inv) {
      return { success: false, message: '请柬不存在' }
    }
    if (inv.creatorOpenid !== OPENID) {
      return { success: false, message: '无权操作' }
    }

    let deletedCount = 0

    // 清理回执
    if (type === 'all' || type === 'rsvp' || type === 'guests') {
      const guestsRes = await db.collection('guests').where({ invitationId }).get()
      for (const doc of guestsRes.data) {
        await db.collection('guests').doc(doc._id).remove()
        deletedCount++
      }
    }

    // 清理祝福
    if (type === 'all' || type === 'blessings') {
      const blessingsRes = await db.collection('blessings').where({ invitationId }).get()
      for (const doc of blessingsRes.data) {
        await db.collection('blessings').doc(doc._id).remove()
        deletedCount++
      }
    }

    // 重置请柬统计计数
    if (type === 'all' || type === 'rsvp' || type === 'guests') {
      await db.collection('invitations').doc(invitationId).update({
        data: { viewCount: 0 }
      })
    }

    return {
      success: true,
      message: `已清理 ${deletedCount} 条记录`,
      deletedCount
    }
  } catch (err) {
    console.error('clearDebugData error:', err)
    return { success: false, message: '清理失败: ' + err.message }
  }
}
