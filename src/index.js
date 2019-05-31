const axios = require('axios')
const { EventEmitter } = require('events')
const WebSocket = require('ws')

class HQTrivia extends EventEmitter {
  constructor (token = '', testSocket = false, apiURL = 'https://api-quiz.hype.space') {
    super()
    this.token = token
    this.testSocket = testSocket
    this.headers = {
      'x-hq-device': 'iPhone7,2',
      'x-hq-client': 'iOS/1.3.7 b90',
      ...this.token ? { 'authorization': `Bearer ${token}` } : {}
    }
    this.axios = axios.create({
      baseURL: apiURL,
      headers: this.headers,
      validateStatus: false
    })
    this.lastQuestion = {}
  }

  setToken (token) {
    this.headers = {
      'x-hq-device': 'iPhone7,2',
      'x-hq-client': 'iOS/1.3.7 b90',
      'authorization': `Bearer ${token}`
    }
    this.token = token
  }

  async sendCode (phone, method = 'sms') {
    const sendCodeRes = await this.axios.post('/verifications', {
      phone: phone,
      method: method
    })

    this.verificationId = sendCodeRes.data.verificationId
    return {
      success: !!sendCodeRes.data.verificationId,
      verificationId: sendCodeRes.data.verificationId
    }
  }

  async confirmCode (code, verificationId = this.verificationId) {
    const confirmCodeRes = await this.axios.post(`verifications/${verificationId}`, {
      code: code
    })

    if (confirmCodeRes.data.auth === null) {
      return {
        success: true,
        accountRegistred: false
      }
    } else if (confirmCodeRes.data.accessToken) {
      return {
        success: true,
        accountRegistred: true,
        token: confirmCodeRes.data.accessToken
      }
    } else if (confirmCodeRes.data.auth.accessToken) {
      return {
        success: true,
        accountRegistred: true,
        token: confirmCodeRes.data.auth.accessToken
      }
    } else {
      throw new Error('Unknown API error')
    }
  }

  async register (username, referral = null, verificationId = this.verificationId) {
    const registerRes = await this.axios.post('/users', {
      country: 'MQ==',
      language: 'us',
      referringUsername: referral,
      username: username,
      verificationId: verificationId
    })

    switch (registerRes.data.errorCode) {
      case 101:
        throw new Error('Username already registred')

      case 471:
        throw new Error('Username too long')
    }

    if (registerRes.data.accessToken) {
      return registerRes.data.accessToken
    } else {
      throw new Error('Unknown API Error')
    }
  }

  async getUserData () {
    if (!this.token) throw new Error('This method cannot be used without authorization')
    const userDataRes = await this.axios.get('/users/me')
    if (userDataRes.data.error) throw new Error(userDataRes.data.error)
    return userDataRes.data
  }

  async getShows () {
    const shows = await this.axios.get('shows/now')
    return shows.data
  }

  async getLeaderboard () {
    if (!this.token) throw new Error('This method cannot be used without authorization')
    const leaderboard = await this.axios.get('/users/leaderboard')
    return leaderboard.data
  }

  async getUserById (id) {
    if (!this.token) throw new Error('This method cannot be used without authorization')
    const userInfo = await this.axios.get(`/users/${id}`)
    return userInfo.data
  }

  async getPayoutsInfo () {
    if (!this.token) throw new Error('This method cannot be used without authorization')
    const payoutsInfo = await this.axios.get('/users/me/payouts')
    return payoutsInfo.data
  }

  async makePayout (email) {
    if (!this.token) throw new Error('This method cannot be used without authorization')
    const makePayout = await this.axios.post('/users/me/payouts', {
      email: email
    })
    return makePayout.data
  }

  async changeUsername (username) {
    if (!this.token) throw new Error('This method cannot be used without authorization')
    const changeUsernameResp = await this.axios.patch('/users/me', {
      username: username
    })
    return changeUsernameResp.data
  }

  async checkUsername (username) {
    if (!this.token) throw new Error('This method cannot be used without authorization')
    const checkUsernameResp = await this.axios.post('/usernames/available', {
      username: username
    })
    return checkUsernameResp.data
  }

  async easterEgg (type = 'makeItRain') {
    if (!this.token) throw new Error('This method cannot be used without authorization')
    const easterEggResp = await this.axios.post(`/easter-eggs/${type}`)
    return easterEggResp.data
  }

  async searchUsers (query) {
    if (!this.token) throw new Error('This method cannot be used without authorization')
    const searchUserRes = await this.axios.get(`/users?q=${encodeURIComponent(query)}`)
    const users = await Promise.all(searchUserRes.data.data.map(async userInfo => {
      const userRes = await this.getUserById(userInfo.userId)
      return userRes
    }))

    return users
  }

  async getFriends () {
    if (!this.token) throw new Error('This method cannot be used without authorization')
    const friendsResp = await this.axios.get('/friends')
    const friends = await Promise.all(friendsResp.data.data.map(async userInfo => {
      const userRes = await this.getUserById(userInfo.userId)
      return userRes
    }))
    return friends
  }

  async acceptFriendRequest (userId) {
    if (!this.token) throw new Error('This method cannot be used without authorization')
    const acceptFriendRes = await this.axios.put(`/friends/${userId}/status`, {
      status: 'ACCEPTED'
    })
    return acceptFriendRes.data.status === 'ACCEPTED'
  }

  async getUpcomingSchedule () {
    if (!this.token) throw new Error('This method cannot be used without authorization')
    const leaderboard = await this.axios.get('/shows/schedule')
    return leaderboard.data.shows
  }

  async addFriend (userId) {
    if (!this.token) throw new Error('This method cannot be used without authorization')
    const addFriendRes = await this.axios.post(`/friends/${userId}/requests`)
    return addFriendRes.data.status === 'PENDING'
  }

  async getIncomingFriendRequests () {
    if (!this.token) throw new Error('This method cannot be used without authorization')
    const friendsResp = await this.axios.get('/friends/requests/incoming')
    const friends = await Promise.all(friendsResp.data.data.map(async userInfo => {
      const userRes = await this.getUserById(userInfo.userId)
      return userRes
    }))
    return friends
  }

  sendAnswer (answerID, questionId) {
    if (!this.WSConn || this.WSConn.readyState !== WebSocket.OPEN) throw new Error('You are not connected to the game')
    if (this.gameType !== 'trivia') throw new Error('You can not send a letter because this game is not Trivia')
    this.WSConn.send(JSON.stringify({
      questionId: parseInt(questionId),
      type: 'answer',
      answerId: parseInt(answerID)
    }))
  }

  sendSurveyAnswer (answerID, questionId) {
    if (!this.WSConn || this.WSConn.readyState !== WebSocket.OPEN) throw new Error('You are not connected to the game')
    if (this.gameType !== 'trivia') throw new Error('You can not send a letter because this game is not Trivia')
    this.WSConn.send(JSON.stringify({
      surveyQuestionId: parseInt(questionId),
      type: 'surveyAnswer',
      surveyAnswerId: parseInt(answerID),
      broadcastId: this.broadcastId
    }))
  }

  sendEraser (questionId) {
    if (!this.WSConn || this.WSConn.readyState !== WebSocket.OPEN) throw new Error('You are not connected to the game')
    if (this.gameType !== 'trivia') throw new Error('You can not send a letter because this game is not Trivia')
    this.WSConn.send(JSON.stringify({
      type: 'erase1',
      broadcastId: this.broadcastId,
      questionId: parseInt(questionId)
    }))
  }

  checkpoint (winNow, checkpointId) {
    if (!this.WSConn || this.WSConn.readyState !== WebSocket.OPEN) throw new Error('You are not connected to the game')
    if (this.gameType !== 'trivia') throw new Error('You can not send a letter because this game is not Trivia')
    this.WSConn.send(JSON.stringify({
      type: 'checkpointResponse',
      broadcastId: this.broadcastId,
      winNow: winNow,
      checkpointId: parseInt(checkpointId)
    }))
  }

  useExtralive (questionId) {
    if (!this.WSConn || this.WSConn.readyState !== WebSocket.OPEN) throw new Error('You are not connected to the game')
    if (this.gameType !== 'trivia') throw new Error('You can not send a letter because this game is not Trivia')
    this.WSConn.send(JSON.stringify({
      type: 'useExtraLife',
      questionId: parseInt(questionId)
    }))
  }

  sendLetter (roundId, showId, letter) {
    if (!this.WSConn || this.WSConn.readyState !== WebSocket.OPEN) throw new Error('You are not connected to the game')
    if (this.gameType !== 'words') throw new Error('You can not send a letter because this game is not Words')
    this.WSConn.send(JSON.stringify({
      roundId: parseInt(roundId),
      type: 'guess',
      showId: parseInt(showId),
      letter: letter.toUpperCase()
    }))
  }

  sendWord (roundId, showId, word) {
    if (!this.WSConn || this.WSConn.readyState !== WebSocket.OPEN) throw new Error('You are not connected to the game')
    if (this.gameType !== 'words') throw new Error('You can not send a letter because this game is not Words')
    const letters = word.split('')
    letters.forEach((letter) => {
      this.sendLetter(roundId, showId, letter)
    })
  }

  getErasers (friendIds) {
    if (!this.WSConn || this.WSConn.readyState !== WebSocket.OPEN) throw new Error('You are not connected to the game')
    this.WSConn.send(JSON.stringify({
      type: 'erase1Earned',
      broadcastId: this.broadcastId,
      friendsIds: friendIds
    }))
  }

  chatVisibility (enable) {
    if (!this.WSConn || this.WSConn.readyState !== WebSocket.OPEN) throw new Error('You are not connected to the game')
    this.WSConn.send(JSON.stringify({
      type: 'chatVisibilityToggled',
      broadcastId: this.broadcastId,
      chatVisible: enable
    }))
  }

  async connectToGame () {
    if (!this.token) throw new Error('This method cannot be used without authorization')
    var shows = {}
    if (!this.testSocket) {
      shows = await this.getShows()
      if (!shows.active) throw new Error('Game is not active')
    } else {
      shows = {
        nextShowVertical: 'general',
        broadcast: {
          broadcastId: 1488,
          socketUrl: 'wss://hqecho.herokuapp.com/'
        }
      }
    }

    this.WSConn = new WebSocket(shows.broadcast.socketUrl, {
      headers: this.headers
    })
    var pingInterval

    this.WSConn.on('open', () => {
      pingInterval = setInterval(this.WSConn.ping, 10000)
      this.broadcastId = parseInt(shows.broadcast.broadcastId)
      if (shows.nextShowVertical === 'words') {
        this.gameType = 'words'
        this.WSConn.send(JSON.stringify({
          type: 'subscribe',
          broadcastId: shows.broadcast.broadcastId,
          gameType: 'words'
        }))
      } else {
        this.gameType = 'trivia'
      }
      this.emit('connected', {
        gameType: this.gameType
      })
    })

    this.WSConn.on('close', (code) => {
      this.emit('disconnected', code)
      clearInterval(pingInterval)
    })

    this.WSConn.on('message', (rawData) => {
      try {
        const data = JSON.parse(rawData)
        this.emit('message', data)
        this.emit(data.type, {
          ...data,
          lastQuestion: this.lastQuestion
        })
        if (data.type === 'question' || data.type === 'startRound') {
          this.lastQuestion = data
        }
      } catch (e) {
        this.emit('error', 'Failed parse WS Message')
      }
    })

    return this.WSConn
  }

  async disconnectFromGame () {
    if (!this.WSConn || this.WSConn.readyState !== WebSocket.OPEN) throw new Error('You are not connected to the game')
    this.WSConn.close()
  }
}

module.exports = HQTrivia
