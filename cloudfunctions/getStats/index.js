// cloudfunctions/getStats/index.js — 获取统计数据
// 支持按 invitationId 筛选（新架构）或不传（兼容旧版）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { invitationId } = event

  try {
    // 构建查询条件
    const guestQuery = invitationId
      ? db.collection('guests').where({ invitationId })
      : db.collection('guests')
    const blessingQuery = invitationId
      ? db.collection('blessings').where({ invitationId })
      : db.collection('blessings')

    // RSVP 总数
    const guestsRes = await guestQuery.count()
    const rsvpCount = guestsRes.total

    // 出席人数
    const attendingRes = await (invitationId
      ? db.collection('guests').where({ invitationId, attending: 'yes' }).count()
      : db.collection('guests').where({ attending: 'yes' }).count())
    const attendingGuests = attendingRes.total

    // 出席总人数（含随行）
    const attendingList = await (invitationId
      ? db.collection('guests').where({ invitationId, attending: 'yes' }).field({ guestCount: true }).get()
      : db.collection('guests').where({ attending: 'yes' }).field({ guestCount: true }).get())
    const totalAttendingPeople = attendingList.data.reduce(
      (sum, g) => sum + (g.guestCount || 1), 0
    )

    // 祝福总数
    const blessingsRes = await blessingQuery.count()
    const blessingCount = blessingsRes.total

    return {
      success: true,
      rsvpCount,
      attendingGuests,
      totalAttendingPeople,
      blessingCount
    }
  } catch (err) {
    console.error('getStats error:', err)
    return {
      success: false,
      rsvpCount: 0,
      attendingGuests: 0,
      totalAttendingPeople: 0,
      blessingCount: 0
    }
  }
}
