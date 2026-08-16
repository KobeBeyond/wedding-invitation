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

    const res = await db.collection('blessings').add({
      data: {
        invitationId: invitationId || '',  // ★ 新增
        openid: OPENID,
        nickName: nickName || '',
        avatarUrl: avatarUrl || '',
        text: text.trim(),
        createdAt: db.serverDate()
      }
    })
    return { success: true, _id: res._id }
  } catch (err) {
    console.error('submitBlessing error:', err)
    return { success: false, message: '发送失败，请稍后重试' }
  }
}
