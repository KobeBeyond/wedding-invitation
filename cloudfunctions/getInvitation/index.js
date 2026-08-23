// cloudfunctions/getInvitation/index.js — 获取单个请柬
// 创作者可看自己草稿，访客只能看已发布的
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 浏览冷却期：同一 openid 在 N 分钟内重复访问只计 1 次
const COOLDOWN_MS = 5 * 60 * 1000

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

    // 权限判断：草稿只有创建者能看
    if (inv.status === 'draft' && inv.creatorOpenid !== OPENID) {
      return { success: false, message: '请柬尚未发布' }
    }

    // 已发布请柬：增加浏览量（含 5 分钟冷却防刷）
    if (inv.status === 'published') {
      const now = Date.now()
      const lastView = inv.lastViewBy || {}
      const lastTime = lastView.time ? new Date(lastView.time).getTime() : 0
      const shouldCount = lastView.openid !== OPENID || (now - lastTime) > COOLDOWN_MS

      if (shouldCount) {
        try {
          await db.collection('invitations').doc(invitationId).update({
            data: {
              viewCount: _.inc(1),
              lastViewBy: { openid: OPENID, time: new Date() }
            }
          })
          // 同步更新本地返回值，让前端立刻看到最新 viewCount
          inv.viewCount = (inv.viewCount || 0) + 1
        } catch (e) {
          console.warn('viewCount update failed:', e)
        }
      }
    }

    return { success: true, data: inv }
  } catch (err) {
    console.error('getInvitation error:', err)
    return { success: false, message: '获取失败: ' + err.message }
  }
}
