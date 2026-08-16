// cloudfunctions/getMyInvitations/index.js — 获取创作者的请柬列表
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  try {
    const res = await db.collection('invitations')
      .where({ creatorOpenid: OPENID })
      .orderBy('updatedAt', 'desc')
      .get()

    return { success: true, data: res.data }
  } catch (err) {
    console.error('getMyInvitations error:', err)
    return { success: false, message: '获取失败: ' + err.message, data: [] }
  }
}
