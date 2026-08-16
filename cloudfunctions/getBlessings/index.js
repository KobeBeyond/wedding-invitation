// cloudfunctions/getBlessings/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { invitationId } = event

  try {
    // ★ 按请柬 ID 筛选
    const query = invitationId
      ? db.collection('blessings').where({ invitationId })
      : db.collection('blessings')

    const res = await query
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()

    return {
      success: true,
      data: res.data,
      total: res.data.length
    }
  } catch (err) {
    console.error('getBlessings error:', err)
    return { success: false, data: [], message: '查询失败' }
  }
}
