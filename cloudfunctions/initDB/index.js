// initDB 云函数：自动创建所有数据库集合
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const results = {}
  // 需要创建的所有集合
  const collections = ['guests', 'blessings', 'users', 'invitations']

  for (const name of collections) {
    try {
      await db.createCollection(name)
      results[name] = '创建成功'
    } catch (e) {
      const msg = (e.message || JSON.stringify(e)).toLowerCase()
      if (
        e.errCode === -502001 ||
        msg.includes('already exist') ||
        msg.includes('table exist') ||
        msg.includes('resourceexist')
      ) {
        results[name] = '已存在'
      } else {
        results[name] = '失败: ' + (e.message || JSON.stringify(e))
      }
    }
  }

  return {
    code: 0,
    msg: '数据库初始化完成',
    data: results
  }
}
