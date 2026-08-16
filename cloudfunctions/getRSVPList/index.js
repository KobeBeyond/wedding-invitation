// cloudfunctions/getRSVPList/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { invitationId } = event

  try {
    // ★ 按请柬 ID 筛选
    const query = invitationId
      ? db.collection('guests').where({ invitationId })
      : db.collection('guests')

    const res = await query
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()

    return {
      success: true,
      data: res.data,
      total: res.data.length
    }
  } catch (err) {
    console.error('getRSVPList error:', err)
    return { success: false, data: [], message: '查询失败' }
  }
}
