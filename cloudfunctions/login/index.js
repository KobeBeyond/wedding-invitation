// cloudfunctions/login/index.js — 用户登录
// 获取 openId，创建或更新 users 记录
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  try {
    const userCol = db.collection('users')
    const { data } = await userCol.where({ openid: OPENID }).get()

    if (data.length > 0) {
      // 已有用户：更新登录时间和头像昵称
      const user = data[0]
      await userCol.doc(user._id).update({
        data: {
          lastLoginAt: db.serverDate(),
          nickName: event.nickName || user.nickName,
          avatarUrl: event.avatarUrl || user.avatarUrl
        }
      })
      return {
        success: true,
        openid: OPENID,
        user: {
          ...user,
          nickName: event.nickName || user.nickName,
          avatarUrl: event.avatarUrl || user.avatarUrl
        }
      }
    } else {
      // 新用户
      const res = await userCol.add({
        data: {
          openid: OPENID,
          nickName: event.nickName || '',
          avatarUrl: event.avatarUrl || '',
          createdAt: db.serverDate(),
          lastLoginAt: db.serverDate()
        }
      })
      return {
        success: true,
        openid: OPENID,
        userId: res._id
      }
    }
  } catch (err) {
    console.error('login error:', err)
    return { success: false, message: '登录失败: ' + err.message }
  }
}
