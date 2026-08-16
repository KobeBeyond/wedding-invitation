// cloudfunctions/createInvitation/index.js — 创建请柬草稿
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { template } = event

  try {
    const res = await db.collection('invitations').add({
      data: {
        creatorOpenid: OPENID,
        status: 'draft',
        template: template || 'classic-rose',
        groomName: '',
        brideName: '',
        weddingDate: '',
        groomIntro: '',
        brideIntro: '',
        venueName: '',
        venueAddress: '',
        venueHall: '',
        venueLat: 0,
        venueLng: 0,
        venuePhone: '',
        photos: [],
        musicUrl: '',
        coverImage: '',
        timeline: [],
        shareTitle: '',
        expiryDate: null,
        viewCount: 0,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })
    return { success: true, _id: res._id }
  } catch (err) {
    console.error('createInvitation error:', err)
    return { success: false, message: '创建失败: ' + err.message }
  }
}
