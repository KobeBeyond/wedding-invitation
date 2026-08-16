// cloudfunctions/getInvitation/index.js — 获取单个请柬
// 创作者可看自己草稿，访客只能看已发布的
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
    const res = await db.collection('invitations').doc(invitationId).get()

    if (!res.data) {
      return { success: false, message: '请柬不存在' }
    }

    const inv = res.data

    // 权限判断
    if (inv.status === 'draft' && inv.creatorOpenid !== OPENID) {
      return { success: false, message: '请柬尚未发布' }
    }

    // 访客访问时增加浏览量
    if (inv.creatorOpenid !== OPENID && inv.status === 'published') {
      try {
        await db.collection('invitations').doc(invitationId).update({
          data: { viewCount: _.inc(1) }
        })
      } catch (e) {
        // 浏览量更新失败不影响主流程
        console.warn('viewCount update failed:', e)
      }
    }

    return { success: true, data: inv }
  } catch (err) {
    console.error('getInvitation error:', err)
    return { success: false, message: '获取失败: ' + err.message }
  }
}
