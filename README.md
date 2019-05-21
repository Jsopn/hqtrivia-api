# HQ Trivia API
This is a Node.JS wrapper for HQ Trivia

## Installation
`npm i hqtrivia-api`

## API Methods
- `hq.getUserData()` - Get the authenticated user data
- `hq.getShows()` - Get the game schedule
- `hq.getLeaderboard()` - Get the game leaderboard
- `hq.getUserById()` - Get user by ID
- `hq.searchUsers()` - Search users
- `hq.getFriends()` - Get all friends
- `hq.acceptFriendRequest(userId)` - Accept friend request
- `hq.addFriend(userId)` - Add friend
- `hq.getIncomingFriendRequests()` - Get incoming friend requests
- `hq.connectToGame()` - Connect to game

## Trivia Game Methods
- `hq.sendAnswer(answerID, questionId)` - Send answer to HQ
- `hq.useExtralive(questionId)` - Use extra live

## Words Game Methods
- `hq.sendLetter(roundId, showId, letter)` - Send letter to HQ
- `hq.sendWord(roundId, showId, word)` - Send word to HQ

## Events
- `connected` - Called when successfully connected to the game (Words, Trivia)
- `disconnected` - Called when disconnected from the game (Words, Trivia)
- `question` - Called when a question is received from the server (Trivia)
- `questionClosed` - Called when a question is closed (Trivia)
- `questionSummary` - Called when the summary of a question is received from the server (Trivia)
- `questionFinished` - Called when question is finished (Trivia)
- `gameStatus` - Called when the game status is received from the server (Words, Trivia)
- `startRound` - Called when the round starts (Words)
- `letterReveal` - Called when letter reveal (Words)
- `endRound` - Called when round ends (Words)
- `showWheel` - Called when wheel shows (Words)
- `hideWheel` - Called when wheel hideens (Words)
- `guessResponse` - Called after sending a letter or word (Words)

## Trivia Example 1
```js
const HQTrvia = require('hqtrivia-api')
const hq = new HQTrivia('[token]')

hq.connectToGame()

hq.on('connected', () => {
    console.log('Connected to HQ WS')
})

hq.on('question', (data) => { 
    console.log(`Question #${data.questionNumber}/${data.questionCount}`) // Question #3/12
    console.log(data.question) // In a jazz band, which instrument would be in the rhythm section?
    console.log(data.answers.map(answer => answer.text).join(' | ')) // Trombone | Guitar | Violin | 

    hq.sendAnswer(data.answers[1].answerId, data.questionId) // Sends the answer "Guitar"
})

hq.on('disconnected', (code) => {
    console.log('Disconnected from HQ WS')
})
```

## Words Example 1
```js
const HQTrvia = require('hqtrivia-api')
const hq = new HQTrivia('[token]')

hq.connectToGame()

hq.on('connected', () => {
    console.log('Connected to HQ WS')
})

hq.on('startRound', (data) => { 
    console.log(`Round Number #${data.roundNumber}/${data.totalRounds}`) // Round Number #9/10
    console.log(`Hint: ${data.hint}`) // Hint: Circus Performance
    console.log(`Puzzle: `) // Puzzle: 
    console.log(data.puzzleState.join(' | ')) // ******** | ******** | C********

    hq.sendWord(data.roundId, data.showId, 'JUGGLING') // Send the letters "J", "U", "G", ...etc
    hq.sendWord(data.roundId, data.showId, 'MULTIPLE') // Send the letters "M", "U", "L", ...etc
    hq.sendWord(data.roundId, data.showId, 'CHAINSAWS') // Send the letters "C", "H", "I", ...etc
    
    // or
    
    hq.sendLetter(data.roundId, data.showId, 'J') // Send the letter "J"
    hq.sendLetter(data.roundId, data.showId, 'U') // Send the letter "U"
    hq.sendLetter(data.roundId, data.showId, 'G') // Send the letter "G"
}) 

hq.on('disconnected', (code) => {
    console.log('Disconnected from HQ WS')
})
```