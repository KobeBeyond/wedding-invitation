// pages/venue/venue.js
Page({
  data: {
    venue: {},
    markers: []
  },

  onLoad() {
    const app = getApp()
    const gd = app.globalData
    const venue = {
      name: gd.venueName,
      address: gd.venueAddress,
      hall: gd.venueHall,
      lat: gd.venueLat,
      lng: gd.venueLng,
      phone: gd.venuePhone
    }
    const markers = [{
      id: 0,
      latitude: gd.venueLat,
      longitude: gd.venueLng,
      title: gd.venueName,
      iconPath: '/images/marker.png'
    }]
    this.setData({ venue, markers })
  },

  openNavigation() {
    const v = this.data.venue
    wx.openLocation({
      latitude: v.lat,
      longitude: v.lng,
      name: v.name,
      address: v.address,
      scale: 18
    })
  },

  callVenue() {
    wx.makePhoneCall({
      phoneNumber: this.data.venue.phone
    })
  },

  onShareAppMessage() {
    const app = getApp()
    return {
      title: `${app.globalData.groomName}&${app.globalData.brideName}的婚礼地点`,
      path: '/pages/venue/venue'
    }
  }
})
