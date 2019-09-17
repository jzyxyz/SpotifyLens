const Worker = require('./Worker')
const SpotifyLens = require('./SpotifyLens')

module.exports = {
  Worker,
  SpotifyLens,
}

const w = new Worker()
w.start()
