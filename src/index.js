const axios = require('axios')
const { EventEmitter } = require('events')
const WebSocket = require('ws')

class HQTrivia extends EventEmitter {
  constructor (token, apiURL = 'https://api-quiz.hype.space') {
    super(token, apiURL)
    if (!token) throw new Error('No authentication token was provided.')
    this.token = token
    this.headers = {
      'x-hq-device': 'iPhone7,2',
      'x-hq-client': 'iOS/1.3.7 b90',
      'authorization': `Bearer ${token}`
    }
    this.axios = axios.create({
      baseURL: apiURL,
      headers: this.headers
    })
    this.lastQuestion = {}
  }

  async getUserData () {
    const userDataRes = await this.axios.get('/users/me')
    if (userDataRes.data.error) throw new Error(userDataRes.data.error)
    return userDataRes.data
  }

  async getShows () {
    const shows = await this.axios.get('shows/now')
    return shows.data
  }

  async getLeaderboard () {
    const leaderboard = await this.axios.get('/users/leaderboard')
    return leaderboard.data
  }

  async getUserById (id) {
    const userInfo = await this.axios.get(`/users/${id}`)
    return userInfo.data
  }

  async searchUsers (query) {
    const searchUserRes = await this.axios.get(`/users?q=${encodeURIComponent(query)}`)
    const users = await Promise.all(searchUserRes.data.data.map(async userInfo => {
      const userRes = await this.getUserById(userInfo.userId)
      return userRes
    }))

    return users
  }

  async getFriends () {
    const friendsResp = await this.axios.get('/friends')
    const friends = await Promise.all(friendsResp.data.data.map(async userInfo => {
      const userRes = await this.getUserById(userInfo.userId)
      return userRes
    }))
    return friends
  }

  async acceptFriendRequest (userId) {
    const acceptFriendRes = await this.axios.put(`/friends/${userId}/status`, {
      status: 'ACCEPTED'
    })
    return acceptFriendRes.data.status === 'ACCEPTED'
  }

  async getUpcomingSchedule() {
    const leaderboard = await this.axios.get('/shows/schedule')
    return leaderboard.data.shows
  }

  async addFriend (userId) {
    const addFriendRes = await this.axios.post(`/friends/${userId}/requests`)
    return addFriendRes.data.status === 'PENDING'
  }

  async getIncomingFriendRequests () {
    const friendsResp = await this.axios.get('/friends/requests/incoming')
    const friends = await Promise.all(friendsResp.data.data.map(async userInfo => {
      const userRes = await this.getUserById(userInfo.userId)
      return userRes
    }))
    return friends
  }

  async sendAnswer (answerID, questionId) {
    if (!this.WSConn || this.WSConn.readyState !== WebSocket.OPEN) throw new Error('You are not connected to the game')
    if (this.gameType !== 'trivia') throw new Error('You can not send a letter because this game is not Trivia')
    this.WSConn.send(JSON.stringify({
      questionId: parseInt(questionId),
      type: 'answer',
      answerId: parseInt(answerID)
    }))
  }

  async useExtralive (questionId) {
    if (!this.WSConn || this.WSConn.readyState !== WebSocket.OPEN) throw new Error('You are not connected to the game')
    if (this.gameType !== 'trivia') throw new Error('You can not send a letter because this game is not Trivia')
    this.WSConn.send(JSON.stringify({
      type: 'useExtraLife',
      questionId: parseInt(questionId)
    }))
  }

  async sendLetter (roundId, showId, letter) {
    if (!this.WSConn || this.WSConn.readyState !== WebSocket.OPEN) throw new Error('You are not connected to the game')
    if (this.gameType !== 'words') throw new Error('You can not send a letter because this game is not Words')
    this.WSConn.send(JSON.stringify({
      roundId: roundId,
      type: 'guess',
      showId: showId,
      letter: letter.toUpperCase()
    }))
  }

  async sendWord (roundId, showId, word) {
    if (!this.WSConn || this.WSConn.readyState !== WebSocket.OPEN) throw new Error('You are not connected to the game')
    if (this.gameType !== 'words') throw new Error('You can not send a letter because this game is not Words')
    const letters = word.split('')
    letters.forEach((letter) => {
      this.sendLetter(roundId, showId, letter)
    })
  }

  async connectToGame () {
    const shows = await this.getShows()
    if (!shows.active) throw new Error('Game is not active')

    this.WSConn = new WebSocket(shows.broadcast.socketUrl, {
      headers: this.headers
    })
    var pingInterval

    this.WSConn.on('open', () => {
      this.emit('connected')
      pingInterval = setInterval(this.WSConn.ping, 10000)
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
    })

    this.WSConn.on('close', (code) => {
      this.emit('disconnected', code)
      clearInterval(pingInterval)
    })

    this.WSConn.on('message', (rawData) => {
      try {
        const data = JSON.parse(rawData)
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
}

module.exports = HQTrivia
