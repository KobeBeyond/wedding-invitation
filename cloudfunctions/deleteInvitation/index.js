// cloudfunctions/deleteInvitation/index.js — 删除请柬（级联删除关联数据）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { invitationId } = event

  if (!invitationId) {
    return { success: false, message: '缺少请柬ID' }
  }

  try {
    // 权限校验
    const inv = await db.collection('invitations').doc(invitationId).get()
    if (!inv.data) {
      return { success: false, message: '请柬不存在' }
    }
    if (inv.data.creatorOpenid !== OPENID) {
      return { success: false, message: '无权操作' }
    }

    // 级联删除关联的 RSVP 和祝福
    await db.collection('guests').where({ invitationId }).remove()
    await db.collection('blessings').where({ invitationId }).remove()

    // 删除请柬本身
    await db.collection('invitations').doc(invitationId).remove()

    return { success: true }
  } catch (err) {
    console.error('deleteInvitation error:', err)
    return { success: false, message: '删除失败: ' + err.message }
  }
}
