# Nupcias 婚礼请柬 — 双角色技术架构方案

> 产品定位：创作者（新婚夫妇）制作管理请柬；访客通过分享链接查看请柬并互动。

---

## 一、整体架构概览

```
┌─────────────────────────────────────────────────────┐
│                    微信小程序客户端                     │
│  ┌───────────┐                  ┌───────────────┐   │
│  │  创作者端   │                  │   访客端       │   │
│  │ dashboard  │                  │ guest/view    │   │
│  │ editor     │                  │ guest/photos  │   │
│  │ template   │                  │ guest/venue   │   │
│  │ share      │                  │ guest/rsvp    │   │
│  │            │                  │ guest/bless   │   │
│  │            │                  │ guest/sched   │   │
│  └─────┬─────┘                  └───────┬───────┘   │
│        │           ┌────────┐           │           │
│        └───────────│ router │───────────┘           │
│                    └────────┘                       │
└─────────────────────────┬───────────────────────────┘
                          │ wx.cloud.callFunction
┌─────────────────────────┴───────────────────────────┐
│                    云开发后端                         │
│  ┌──────────┐ ┌────────────┐ ┌──────────────────┐ │
│  │  认证层    │ │  请柬CRUD   │ │  访客互动         │ │
│  │  login    │ │  create    │ │  submitRSVP      │ │
│  │           │ │  update    │ │  getRSVPList     │ │
│  │           │ │  delete    │ │  submitBlessing  │ │
│  │           │ │  get       │ │  getBlessings    │ │
│  │           │ │  list      │ │  getStats        │ │
│  │           │ │  publish   │ │                  │ │
│  └──────────┘ └────────────┘ └──────────────────┘ │
│  ┌──────────────────────────────────────────────┐   │
│  │              云数据库集合                     │   │
│  │  users  │  invitations  │  guests  │ blessings │ │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │              云存储                          │   │
│  │  photos/  │  music/  │  covers/  │  qrcodes/  │  │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

---

## 二、角色分流机制

### 入口路由页（pages/router）

小程序启动时的第一个页面（app.json pages 数组首位），它本身不显示任何内容，只负责判断角色并重定向：

```javascript
// pages/router/router.js
onLoad() {
  const { query, scene } = wx.getLaunchOptionsSync()

  // 场景1：通过分享链接打开（带 inv 参数）
  if (query && query.inv) {
    wx.reLaunch({ url: `/pages/guest/view/view?inv=${query.inv}` })
    return
  }

  // 场景2：通过扫二维码打开（scene 参数解析）
  if (scene) {
    const decoded = decodeURIComponent(scene)
    // 解析出 inv=xxx
    const match = decoded.match(/inv=(\w+)/)
    if (match) {
      wx.reLaunch({ url: `/pages/guest/view/view?inv=${match[1]}` })
      return
    }
  }

  // 场景3：直接打开 → 创作者首页
  wx.reLaunch({ url: '/pages/creator/dashboard/dashboard' })
}
```

**分流逻辑**：

| 打开方式 | 场景值 | 判定 | 目标页面 |
|---------|--------|------|---------|
| 分享卡片点击 | 1044 | query.inv 有值 | 访客查看页 |
| 扫描小程序码 | 1047/1048 | scene 解析出 inv | 访客查看页 |
| 直接打开/搜索 | 1001/1023 | 无 inv | 创作者首页 |

---

## 三、数据库集合设计

### 1. `users` — 创作者用户表（新增）

```javascript
{
  _id: "auto",           // 自动生成
  openid: "oXXXX",       // 微信 openid（主键）
  nickName: "张三",       // 昵称
  avatarUrl: "",          // 头像
  createdAt: Date,        // 注册时间
  lastLoginAt: Date       // 最后登录时间
}
```

### 2. `invitations` — 请柬核心表（新增，替代 globalData）

```javascript
{
  _id: "auto",
  creatorOpenid: "oXXXX",       // 创建者 openid
  status: "draft",               // 'draft' | 'published'
  template: "classic-rose",       // 模板 ID

  // 基本信息
  groomName: "张三",
  brideName: "李四",
  weddingDate: "2026-10-01",     // YYYY-MM-DD
  groomIntro: "",                // 新郎简介（可选）
  brideIntro: "",                // 新娘简介（可选）

  // 地点信息
  venueName: "北京婚礼酒店",
  venueAddress: "北京市朝阳区xx路xx号",
  venueHall: "宴会大厅3F",
  venueLat: 39.9042,
  venueLng: 116.4074,
  venuePhone: "010-12345678",

  // 媒体资源（云存储 fileID）
  photos: [
    { id: 1, fileID: "cloud://..." },
    { id: 2, fileID: "cloud://..." }
  ],
  musicUrl: "cloud://...",        // 背景音乐 fileID
  coverImage: "cloud://...",      // 分享封面图 fileID

  // 时间线
  timeline: [
    { time: "08:30", title: "迎宾", description: "宾客签到入场" },
    { time: "10:00", title: "仪式", description: "婚礼仪式正式开始" },
    { time: "11:30", title: "婚宴", description: "宾客用餐" }
  ],

  // 分享配置
  shareTitle: "张三&李四邀请您参加我们的婚礼",
  expiryDate: null,              // 过期时间（null = 永不过期）

  // 统计
  viewCount: 0,

  // 时间戳
  createdAt: Date,
  updatedAt: Date
}
```

### 3. `guests` — RSVP 回执表（改造：增加 invitationId）

```javascript
{
  _id: "auto",
  invitationId: "invXXXX",      // ★ 新增：关联请柬 ID
  openid: "oXXXX",
  name: "王五",
  phone: "13800138000",
  attending: "yes",               // 'yes' | 'no'
  guestCount: 2,
  dietary: "素食",
  message: "恭喜恭喜！",
  createdAt: Date
}
```

### 4. `blessings` — 祝福表（改造：增加 invitationId）

```javascript
{
  _id: "auto",
  invitationId: "invXXXX",      // ★ 新增：关联请柬 ID
  openid: "oXXXX",
  nickName: "赵六",
  avatarUrl: "",
  content: "祝你们白头偕老！",
  createdAt: Date
}
```

### 集合关系图

```
users (1) ──── (N) invitations (1) ── (N) guests
                            │
                            └──── (N) blessings
```

---

## 四、页面结构设计

### 完整页面树

```
pages/
├── router/              # 入口路由页（app.json 首位，轻量无 UI）
│
├── creator/             # ===== 创作者端 =====
│   ├── dashboard/       # 创作者首页（请柬列表 + 统计概览）
│   ├── editor/          # 请柬编辑器（分步骤表单）
│   ├── template/        # 模板选择页
│   └── share/           # 分享管理（二维码 + 数据看板）
│
├── guest/               # ===== 访客端 =====
│   ├── view/            # 请柬封面（原 pages/home，改造为读取云数据）
│   ├── photos/          # 婚纱照展示（原 pages/photos，改造）
│   ├── venue/           # 地点导航（原 pages/venue，改造）
│   ├── rsvp/            # RSVP 回执（原 pages/rsvp，改造）
│   ├── blessings/       # 祝福弹幕（原 pages/blessings，改造）
│   └── schedule/        # 时间表（原 pages/schedule，改造）
│
└── components/          # 复用组件（已有 + 新增）
    ├── danmaku/         # 已有：弹幕组件
    ├── invitation-card/ # 新增：请柬卡片（列表展示）
    ├── photo-uploader/  # 新增：照片上传器
    ├── countdown/       # 新增：倒计时（从 home 提取）
    └── cta-bar/         # 新增：底部行动号召条
```

### app.json pages 配置

```json
{
  "pages": [
    "pages/router/router",
    "pages/creator/dashboard/dashboard",
    "pages/creator/editor/editor",
    "pages/creator/template/template",
    "pages/creator/share/share",
    "pages/guest/view/view",
    "pages/guest/photos/photos",
    "pages/guest/venue/venue",
    "pages/guest/rsvp/rsvp",
    "pages/guest/blessings/blessings",
    "pages/guest/schedule/schedule"
  ]
}
```

---

## 五、创作者端页面详细设计

### 1. Dashboard — 创作者首页

**功能**：展示所有请柬列表，区分草稿/已发布状态，显示关键统计

**UI 布局**：
```
┌─────────────────────────┐
│  我的请柬          [+ 新建] │
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ 📷 封面缩略图         │ │
│ │ 张三 & 李四          │ │  ← 卡片组件 invitation-card
│ │ 2026-10-01 | 已发布   │ │
│ │ 👁 128  ✋ 12  💬 36   │ │  (浏览/RSVP/祝福)
│ │ [编辑] [分享管理] [删除]│ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ 📷 封面缩略图         │ │
│ │ 王五 & 赵六          │ │
│ │ 2026-12-25 | 草稿     │ │
│ │ [继续编辑] [删除]     │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

### 2. Editor — 请柬编辑器

**功能**：分步骤表单，支持草稿自动保存

**编辑流程**：
```
步骤1: 选择模板          → 步骤2: 基本信息
  (template 页)              ├── 新郎/新娘姓名
  classic-rose              ├── 婚礼日期
  elegant-gold              └── 简介（可选）
        ↓                       ↓
步骤3: 照片上传          → 步骤4: 地点信息
  ├── 上传婚纱照（1-9张）     ├── 酒店名称
  ├── 拖拽排序               ├── 地址
  └── 预览                   ├── 经纬度（地图选点）
        ↓                    ├── 厅名
步骤5: 时间线            │   └── 联系电话
  ├── 添加/删除流程          ↓
  ├── 时间 + 标题 + 描述   步骤6: 音乐 & 封面
  └── 拖拽排序              ├── 上传背景音乐
        ↓                    └── 选择分享封面图
步骤7: 预览 & 发布               ↓
  ├── 完整预览（访客视角）   [保存草稿] [发布]
  └── 确认信息无误
```

### 3. Template — 模板选择页

**功能**：选择请柬视觉风格

**初版模板**（3个）：

| 模板ID | 名称 | 主色调 | 字体 | 适用风格 |
|--------|------|--------|------|---------|
| classic-rose | 经典玫瑰 | #e8a0a0 粉 | serif | 浪漫温馨 |
| elegant-gold | 鎏金岁月 | #d4af37 金 | serif | 奢华大气 |
| minimal-white | 极简白 | #333333 黑 | sans-serif | 简约现代 |

模板数据结构：
```javascript
// templates/index.js
const templates = {
  'classic-rose': {
    id: 'classic-rose',
    name: '经典玫瑰',
    colors: {
      primary: '#e8a0a0',
      secondary: '#d4af37',
      background: '#fdf5f6',
      text: '#4a4a4a',
      accent: '#ff6b81'
    },
    font: 'serif',
    preview: '/images/templates/classic-rose.png'
  },
  // ... 其他模板
}
module.exports = templates
```

### 4. Share — 分享管理页

**功能**：生成分享内容、查看统计数据

```
┌─────────────────────────┐
│  分享管理                │
├─────────────────────────┤
│  📱 分享给微信好友        │  ← 触发 onShareAppMessage
│  📱 生成小程序码          │  ← 云函数 getUnlimitedQRCode
│  📋 复制邀请链接          │  ← 生成文字邀请
├─────────────────────────┤
│  数据看板                │
│  ┌─────┐ ┌─────┐ ┌─────┐│
│  │ 128 │ │ 12  │ │ 36  ││
│  │ 浏览 │ │RSVP│ │祝福 ││
│  └─────┘ └─────┘ └─────┘│
├─────────────────────────┤
│  最近访客                │
│  王五 - 出席(2人) - 2天前 │
│  赵六 - 待定 - 3天前     │
└─────────────────────────┘
```

---

## 六、访客端改造方案

### 改造原则
现有 6 个页面迁移到 `pages/guest/` 目录下，核心变化：

1. **数据来源**：从 `app.globalData`（硬编码）改为 `wx.cloud.callFunction` 动态获取
2. **参数传递**：每个页面 `onLoad(options)` 接收 `inv` 参数（请柬 ID）
3. **数据缓存**：首次进入时获取请柬完整数据，存入页面栈或全局缓存
4. **底部 CTA**：在最后一个页面（schedule）末尾添加"我也要制作请柬"入口

### 访客端数据流

```
访客点击分享链接
    ↓
router (inv=xxx)
    ↓
guest/view (onLoad: 调用 getInvitation(inv) → 获取完整请柬数据)
    ↓
全局缓存 invData = { groomName, brideName, photos, venue, ... }
    ↓
guest/photos  ← 读取 invData.photos
guest/venue   ← 读取 invData.venue
guest/rsvp    ← 提交时带 inv 参数
guest/blessings ← 获取/提交时带 inv 参数
guest/schedule ← 读取 invData.timeline
    ↓
底部 CTA: "制作我的婚礼请柬" → wx.reLaunch('/pages/creator/dashboard')
```

### 关键改造代码示例

```javascript
// pages/guest/view/view.js（改造后的封面页）
const app = getApp()

Page({
  data: {
    inv: '',
    groom: '',
    bride: '',
    weddingDateText: '',
    countdown: { days: 0, hours: 0, minutes: 0, seconds: 0, finished: false },
    musicPlaying: false,
    loading: true
  },

  onLoad(options) {
    const inv = options.inv
    if (!inv) {
      wx.showToast({ title: '请柬不存在', icon: 'error' })
      return
    }

    // 调用云函数获取请柬数据
    wx.cloud.callFunction({
      name: 'getInvitation',
      data: { invitationId: inv },
      success: res => {
        if (res.result.success) {
          const d = res.result.data
          // 缓存到全局，供其他页面使用
          app.globalData.currentInvitation = d
          app.globalData.currentInvId = inv

          this.setData({
            inv,
            groom: d.groomName,
            bride: d.brideName,
            weddingDateText: util.formatTime(d.weddingDate),
            loading: false
          })
          this.startCountdown(d.weddingDate)
          this.initAudio(d.musicUrl)
        } else {
          wx.showToast({ title: '请柬不存在', icon: 'error' })
        }
      }
    })
  },

  onShareAppMessage() {
    const d = app.globalData.currentInvitation || {}
    return {
      title: d.shareTitle || `${d.groomName}&${d.brideName}邀请您参加我们的婚礼`,
      path: `/pages/router/router?inv=${this.data.inv}`,
      imageUrl: d.coverImage || ''
    }
  }
})
```

---

## 七、云函数架构

### 新增云函数

```
cloudfunctions/
├── login/              # 用户登录（获取 openId + upsert users）
├── createInvitation/   # 创建请柬草稿
├── updateInvitation/   # 更新请柬内容
├── deleteInvitation/   # 删除请柬
├── getInvitation/      # 获取单个请柬（创作者 & 访客共用）
├── getMyInvitations/   # 获取创作者的请柬列表
├── publishInvitation/  # 发布请柬（draft → published）
├── submitRSVP/         # 已有 → 改造：增加 invitationId
├── getRSVPList/        # 已有 → 改造：按 invitationId 筛选
├── submitBlessing/     # 已有 → 改造：增加 invitationId
├── getBlessings/       # 已有 → 改造：按 invitationId 筛选
├── getStats/           # 已有 → 改造：按 invitationId 筛选
└── initDB/             # 已有 → 改造：创建新集合
```

### 云函数设计详情

#### `login` — 用户登录

```javascript
// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  // 查询用户是否存在
  const userCol = db.collection('users')
  const { data } = await userCol.where({ openid: OPENID }).get()

  if (data.length > 0) {
    // 更新最后登录时间
    await userCol.doc(data[0]._id).update({
      data: {
        lastLoginAt: db.serverDate(),
        nickName: event.nickName || data[0].nickName,
        avatarUrl: event.avatarUrl || data[0].avatarUrl
      }
    })
    return { success: true, user: { ...data[0], nickName: event.nickName || data[0].nickName } }
  } else {
    // 创建新用户
    const res = await userCol.add({
      data: {
        openid: OPENID,
        nickName: event.nickName || '',
        avatarUrl: event.avatarUrl || '',
        createdAt: db.serverDate(),
        lastLoginAt: db.serverDate()
      }
    })
    return { success: true, userId: res._id }
  }
}
```

#### `createInvitation` — 创建请柬

```javascript
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { template } = event

  const res = await db.collection('invitations').add({
    data: {
      creatorOpenid: OPENID,
      status: 'draft',
      template: template || 'classic-rose',
      groomName: '', brideName: '', weddingDate: '',
      venueName: '', venueAddress: '', venueHall: '',
      venueLat: 0, venueLng: 0, venuePhone: '',
      photos: [], musicUrl: '', coverImage: '',
      timeline: [], shareTitle: '', expiryDate: null,
      viewCount: 0,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  })
  return { success: true, _id: res._id }
}
```

#### `getInvitation` — 获取请柬（核心函数）

```javascript
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { invitationId } = event

  const res = await db.collection('invitations').doc(invitationId).get()

  if (!res.data) {
    return { success: false, message: '请柬不存在' }
  }

  const inv = res.data

  // 权限判断：
  // - 创作者可以看自己的草稿和已发布
  // - 访客只能看已发布的
  if (inv.status === 'draft' && inv.creatorOpenid !== OPENID) {
    return { success: false, message: '请柬尚未发布' }
  }

  // 访客访问时增加浏览量（非创建者）
  if (inv.creatorOpenid !== OPENID && inv.status === 'published') {
    await db.collection('invitations').doc(invitationId).update({
      data: { viewCount: db.command.inc(1) }
    })
  }

  return { success: true, data: inv }
}
```

#### `getMyInvitations` — 获取请柬列表

```javascript
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  const res = await db.collection('invitations')
    .where({ creatorOpenid: OPENID })
    .orderBy('updatedAt', 'desc')
    .get()

  return { success: true, data: res.data }
}
```

#### `updateInvitation` — 更新请柬

```javascript
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { invitationId, ...updates } = event

  // 权限校验：只有创建者可以更新
  const inv = await db.collection('invitations').doc(invitationId).get()
  if (inv.data.creatorOpenid !== OPENID) {
    return { success: false, message: '无权操作' }
  }

  // 白名单字段（防止注入非法字段）
  const allowed = [
    'groomName', 'brideName', 'weddingDate', 'groomIntro', 'brideIntro',
    'venueName', 'venueAddress', 'venueHall', 'venueLat', 'venueLng', 'venuePhone',
    'photos', 'musicUrl', 'coverImage', 'timeline', 'shareTitle', 'expiryDate',
    'template', 'status'
  ]
  const cleanData = {}
  for (const key of allowed) {
    if (updates[key] !== undefined) cleanData[key] = updates[key]
  }
  cleanData.updatedAt = db.serverDate()

  await db.collection('invitations').doc(invitationId).update({ data: cleanData })
  return { success: true }
}
```

#### `deleteInvitation` — 删除请柬

```javascript
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { invitationId } = event

  const inv = await db.collection('invitations').doc(invitationId).get()
  if (inv.data.creatorOpenid !== OPENID) {
    return { success: false, message: '无权操作' }
  }

  // 级联删除关联数据
  await db.collection('guests').where({ invitationId }).remove()
  await db.collection('blessings').where({ invitationId }).remove()
  await db.collection('invitations').doc(invitationId).remove()

  return { success: true }
}
```

#### `publishInvitation` — 发布请柬

```javascript
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { invitationId } = event

  const inv = await db.collection('invitations').doc(invitationId).get()
  if (inv.data.creatorOpenid !== OPENID) {
    return { success: false, message: '无权操作' }
  }

  // 校验必填字段
  const d = inv.data
  if (!d.groomName || !d.brideName || !d.weddingDate) {
    return { success: false, message: '请填写完整的基本信息' }
  }

  await db.collection('invitations').doc(invitationId).update({
    data: { status: 'published', updatedAt: db.serverDate() }
  })
  return { success: true }
}
```

### 改造现有云函数

#### `submitRSVP` 改造（增加 invitationId）

```javascript
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { invitationId, name, phone, attending, guestCount, dietary, message } = event

  // ★ 校验请柬存在且已发布
  const inv = await db.collection('invitations').doc(invitationId).get()
  if (!inv.data || inv.data.status !== 'published') {
    return { success: false, message: '请柬不存在或未发布' }
  }

  // ★ 防重复提交：同一 openid + 同一请柬只能提交一次
  const existing = await db.collection('guests').where({
    invitationId, openid: OPENID
  }).get()
  if (existing.data.length > 0) {
    // 更新已有记录
    await db.collection('guests').doc(existing.data[0]._id).update({
      data: { name, phone, attending, guestCount, dietary, message }
    })
    return { success: true, _id: existing.data[0]._id, updated: true }
  }

  const res = await db.collection('guests').add({
    data: {
      invitationId,  // ★ 新增
      openid: OPENID,
      name, phone, attending,
      guestCount: attending === 'yes' ? (guestCount || 1) : 0,
      dietary: dietary || '',
      message: message || '',
      createdAt: db.serverDate()
    }
  })
  return { success: true, _id: res._id }
}
```

#### `getBlessings` 改造（按 invitationId 筛选）

```javascript
exports.main = async (event, context) => {
  const { invitationId } = event  // ★ 新增参数

  const query = invitationId
    ? db.collection('blessings').where({ invitationId })
    : db.collection('blessings')

  const res = await query.orderBy('createdAt', 'desc').limit(50).get()
  return { success: true, data: res.data, total: res.data.length }
}
```

#### `initDB` 改造（增加新集合）

```javascript
exports.main = async (event, context) => {
  const results = {}
  const collections = ['guests', 'blessings', 'users', 'invitations']  // ★ 新增 users, invitations

  for (const name of collections) {
    try {
      await db.createCollection(name)
      results[name] = '创建成功'
    } catch (e) {
      results[name] = e.errCode === -502001 ? '已存在' : '失败: ' + e.message
    }
  }
  return { code: 0, data: results }
}
```

---

## 八、组件架构设计

### 新增组件

#### `invitation-card` — 请柬列表卡片

```
┌─────────────────────────────┐
│  ┌───────────┐  张三 & 李四   │
│  │  封面缩略图 │  2026-10-01  │
│  │           │  ✅ 已发布     │
│  └───────────┘  👁128 ✋12 💬36│
│  [编辑] [分享] [删除]        │
└─────────────────────────────┘
```

**Props**: `invitation` (Object), `showActions` (Boolean)
**Events**: `edit`, `share`, `delete`

#### `photo-uploader` — 照片上传器

**功能**：
- 调用 `wx.chooseMedia` 选择照片
- 调用 `wx.cloud.uploadFile` 上传到云存储
- 支持预览、删除、拖拽排序
- 显示上传进度

**Props**: `photos` (Array), `max` (Number, 默认 9)
**Events**: `change` (返回更新后的 photos 数组，含 fileID)

#### `countdown` — 倒计时组件

**功能**：从 home 页提取的倒计时逻辑，支持复用
**Props**: `targetDate` (String, YYYY-MM-DD)

#### `cta-bar` — 行动号召条

**功能**：访客端页面底部固定的 CTA 条
```
┌──────────────────────────┐
│  想要制作自己的婚礼请柬？ │
│      [立即创建 →]         │
└──────────────────────────┘
```
**Props**: `invitationId` (用于统计点击)
**Events**: `click` → `wx.reLaunch('/pages/creator/dashboard/dashboard')`

---

## 九、访客端 CTA 推流机制

在访客浏览请柬的最后设置行动号召，引导访客转化为创作者：

### CTA 出现位置
1. `guest/schedule` 页面底部（最后浏览的页面）
2. `guest/blessings` 提交祝福后的成功提示中
3. `guest/rsvp` 提交回执后的成功页中

### CTA 交互流程
```
访客完成浏览/互动
    ↓
显示 CTA: "想要制作自己的婚礼请柬？"
    ↓
点击 → wx.reLaunch('/pages/creator/dashboard/dashboard')
    ↓
进入创作者首页（此时用户已有 openid，自动登录）
    ↓
引导新建请柬
```

---

## 十、安全设计

### 数据权限模型

| 操作 | 创作者 | 访客 |
|------|--------|------|
| 创建请柬 | ✅ | ❌ |
| 编辑请柬 | ✅ 仅自己的 | ❌ |
| 删除请柬 | ✅ 仅自己的 | ❌ |
| 查看已发布请柬 | ✅ | ✅ |
| 查看草稿 | ✅ 仅自己的 | ❌ |
| 提交 RSVP | — | ✅ |
| 提交祝福 | — | ✅ |
| 查看统计数据 | ✅ 仅自己的 | ❌ |

### 云函数安全策略
- 所有写操作在云函数内校验 `OPENID`（前端传参不可信）
- `updateInvitation` / `deleteInvitation` 校验 `creatorOpenid === OPENID`
- `submitRSVP` / `submitBlessing` 校验请柬 status === 'published'
- 使用字段白名单防止注入非法字段

### 云数据库权限设置
- 所有集合权限设为 **仅创建者可读写**（云函数操作不受此限制）
- 所有数据访问通过云函数中转（不直接在前端操作数据库）

---

## 十一、实施路线图

### 阶段一：基础设施搭建（地基）
1. 创建新数据库集合（users, invitations）
2. 部署 login 云函数
3. 创建 router 路由页
4. 改造 app.js（移除 globalData 硬编码，改为运行时缓存）

### 阶段二：创作者端开发（核心）
5. 创建 creator/dashboard 页面（请柬列表）
6. 创建 creator/template 页面（模板选择）
7. 创建 creator/editor 页面（分步骤编辑器）
8. 创建 creator/share 页面（分享管理）
9. 部署 CRUD 云函数（create/update/delete/get/list/publish）
10. 开发 photo-uploader 组件

### 阶段三：访客端改造（迁移）
11. 将现有 6 个页面迁移到 pages/guest/ 目录
12. 改造为从云函数动态获取数据
13. 改造现有云函数（增加 invitationId 参数）
14. 添加 CTA 组件到访客端页面

### 阶段四：体验优化（增强）
15. 模板系统完善（3个模板的视觉差异实现）
16. 草稿自动保存机制
17. 订阅消息通知（RSVP/祝福提醒）
18. 内容安全检查（security.msgSecCheck）
19. 添加到日历功能
20. 访客名单导出

---

## 十二、文件结构总览（改造后）

```
wedding-invitation/
├── app.js                          # 改造：移除硬编码，增加登录逻辑
├── app.json                        # 改造：更新 pages 数组
├── app.wxss                        # 保留：全局样式
├── sitemap.json
├── project.config.json
├── templates/
│   └── index.js                    # 新增：模板配置
├── utils/
│   └── util.js                     # 保留
├── images/
│   └── templates/                  # 新增：模板预览图
├── components/
│   ├── danmaku/                    # 保留
│   ├── invitation-card/            # 新增
│   ├── photo-uploader/             # 新增
│   ├── countdown/                  # 新增
│   └── cta-bar/                    # 新增
├── pages/
│   ├── router/                     # 新增：入口路由
│   ├── creator/
│   │   ├── dashboard/             # 新增
│   │   ├── editor/                # 新增
│   │   ├── template/              # 新增
│   │   └── share/                 # 新增
│   └── guest/
│       ├── view/                  # 迁移自 pages/home
│       ├── photos/                # 迁移自 pages/photos
│       ├── venue/                 # 迁移自 pages/venue
│       ├── rsvp/                  # 迁移自 pages/rsvp
│       ├── blessings/             # 迁移自 pages/blessings
│       └── schedule/              # 迁移自 pages/schedule
└── cloudfunctions/
    ├── login/                      # 新增
    ├── createInvitation/          # 新增
    ├── updateInvitation/          # 新增
    ├── deleteInvitation/          # 新增
    ├── getInvitation/             # 新增
    ├── getMyInvitations/          # 新增
    ├── publishInvitation/         # 新增
    ├── submitRSVP/                # 改造
    ├── getRSVPList/               # 改造
    ├── submitBlessing/            # 改造
    ├── getBlessings/              # 改造
    ├── getStats/                  # 改造
    └── initDB/                    # 改造
```
