// components/invitation-card/invitation-card.js
Component({
  properties: {
    invitation: { type: Object, value: {} },
    showActions: { type: Boolean, value: true }
  },

  methods: {
    onView() {
      this.triggerEvent('view', { id: this.properties.invitation._id })
    },
    onEdit() {
      this.triggerEvent('edit', { id: this.properties.invitation._id })
    },
    onShare() {
      this.triggerEvent('share', { id: this.properties.invitation._id })
    },
    onDelete() {
      this.triggerEvent('delete', { id: this.properties.invitation._id })
    },
    onTap() {
      // 整张卡片可点击 → 触发 view 事件
      this.triggerEvent('view', { id: this.properties.invitation._id })
    }
  }
})
