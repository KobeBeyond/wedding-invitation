// cloudfunctions/generateUrlLink/index.js — 生成小程序 URL Link（点击直接打开小程序）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { invitationId } = event

  if (!invitationId) {
    return { success: false, message: '缺少请柬ID' }
  }

  try {
    // 调用微信开放能力生成 URL Link
    const result = await cloud.openapi.urllink.generate({
      path: 'pages/router/router',
      query: `inv=${invitationId}`,
      isExpire: false // 永久有效
    })

    return {
      success: true,
      urlLink: result.urlLink
    }
  } catch (err) {
    console.error('generateUrlLink error:', err)
    return {
      success: false,
      message: '生成链接失败: ' + (err.message || err.errMsg || '')
    }
  }
}
