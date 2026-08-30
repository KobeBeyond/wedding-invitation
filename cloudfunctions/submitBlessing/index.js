// cloudfunctions/submitBlessing/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { invitationId, text, nickName, avatarUrl } = event

  // 验证
  if (!text || !text.trim()) {
    return { success: false, message: '祝福内容不能为空' }
  }
  if (text.length > 200) {
    return { success: false, message: '祝福内容不能超过200字' }
  }

  try {
    // ★ 校验请柬存在且已发布
    if (invitationId) {
      const inv = await db.collection('invitations').doc(invitationId).get()
      if (!inv.data || inv.data.status !== 'published') {
        return { success: false, message: '请柬不存在或未发布' }
      }
    }

    // ★ 去重（与客户端展示口径一致）：同一用户 + 相同祝福语 = 重复，幂等返回已有记录
    const trimmedText = text.trim()
    const existing = await db.collection('blessings')
      .where({
        openid: OPENID,
        invitationId: invitationId || '',
        text: trimmedText
      })
      .limit(1)
      .get()

    if (existing.data && existing.data.length > 0) {
      return { success: true, duplicated: true, _id: existing.data[0]._id }
    }

    const res = await db.collection('blessings').add({
      data: {
        invitationId: invitationId || '',
        openid: OPENID,
        nickName: nickName || '',
        avatarUrl: avatarUrl || '',
        text: trimmedText,
        createdAt: db.serverDate()
      }
    })
    return { success: true, duplicated: false, _id: res._id }
  } catch (err) {
    console.error('submitBlessing error:', err)
    return { success: false, message: '发送失败，请稍后重试' }
  }
}
