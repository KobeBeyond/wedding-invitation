// cloudfunctions/submitRSVP/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  const { invitationId, name, phone, attending, guestCount, dietary, message } = event

  // 验证必填字段
  if (!name || !name.trim()) {
    return { success: false, message: '姓名不能为空' }
  }
  if (!phone || phone.length !== 11) {
    return { success: false, message: '手机号格式不正确' }
  }
  if (!attending) {
    return { success: false, message: '请选择是否出席' }
  }

  try {
    // ★ 校验请柬存在且已发布
    if (invitationId) {
      const inv = await db.collection('invitations').doc(invitationId).get()
      if (!inv.data || inv.data.status !== 'published') {
        return { success: false, message: '请柬不存在或未发布' }
      }
    }

    // ★ 防重复提交：同一 openid + 同一请柬只能提交一次
    if (invitationId) {
      const existing = await db.collection('guests').where({
        invitationId, openid: OPENID
      }).get()
      if (existing.data.length > 0) {
        // 更新已有记录
        await db.collection('guests').doc(existing.data[0]._id).update({
          data: {
            name: name.trim(),
            phone: phone.trim(),
            attending,
            guestCount: attending === 'yes' ? (guestCount || 1) : 0,
            dietary: dietary || '',
            message: message || ''
          }
        })
        return { success: true, _id: existing.data[0]._id, updated: true }
      }
    }

    const res = await db.collection('guests').add({
      data: {
        invitationId: invitationId || '',  // ★ 新增
        openid: OPENID,
        name: name.trim(),
        phone: phone.trim(),
        attending,
        guestCount: attending === 'yes' ? (guestCount || 1) : 0,
        dietary: dietary || '',
        message: message || '',
        createdAt: db.serverDate()
      }
    })
    return { success: true, _id: res._id }
  } catch (err) {
    console.error('submitRSVP error:', err)
    return { success: false, message: '提交失败，请稍后重试' }
  }
}
