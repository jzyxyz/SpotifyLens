const SpotifyWebApi = require('spotify-web-api-node')
const _ = require('lodash')
const {
  distinctReduceBy,
  pruneTrack,
  errorHandler,
  pruneArtist,
} = require('./utils')
const chalk = require('chalk')
const info = chalk.blue
const DEFAULT_LIMIT = 50
const FEATURE_KEYS = [
  'danceability',
  'energy',
  'key',
  'loudness',
  'mode',
  'speechiness',
  'acousticness',
  'instrumentalness',
  'liveness',
  'valence',
  'tempo',
]

module.exports = class extends SpotifyWebApi {
  constructor(config) {
    super(config)
    this.getAccessToken = this.getAccessToken.bind(this)
  }

  pageConcater(getter) {
    return async function(id) {
      const limit = DEFAULT_LIMIT
      let total
      if (id) {
        total = (await getter(id, { offset: 0, limit })).body.total
      } else {
        total = (await getter({ offset: 0, limit })).body.total
      }
      const batch = Math.ceil(total / limit)
      console.log(
        info(`Total: ${total} objects found, getting in ${batch} batches`),
      )
      return _.range(0, batch).map(i =>
        id
          ? getter(id, {
              offset: i * limit,
              limit,
            })
          : getter({
              offset: i * limit,
              limit,
            }),
      )
    }
  }

  timeRangeConcater(getter) {
    return function(opt) {
      return async function(pruneFn) {
        const TIME_RANGES = ['long_term', 'medium_term', 'short_term']
        const requests = TIME_RANGES.map(tr =>
          getter({
            time_range: tr,
            limit: (opt && opt.limit) || DEFAULT_LIMIT,
            offset: (opt && opt.offset) || 0,
          }),
        )
        const responses = await Promise.all(requests)
        const items = responses.map(r => r.body.items)
        if (pruneFn) {
          items.forEach(arr => arr.forEach(pruneFn))
        }
        return _.zipObject(TIME_RANGES, items)
      }
    }
  }

  async getAllTracks(playlistId) {
    const getter = playlistId
      ? this.getPlaylistTracks.bind(this)
      : this.getMySavedTracks.bind(this)

    const tasks = await this.pageConcater(getter)(playlistId)
    const responses = await Promise.all(tasks)
    const tracks = _.flatMap(responses, el => el.body.items)
    tracks.forEach(t => {
      const { track } = t
      pruneTrack(track)
    })
    return tracks
  }

  async getAllArtists(playlistId) {
    const trackList = await this.getAllTracks(playlistId)
    const dict = _.flatMap(trackList, el => {
      el.track.artists.forEach(el => {
        el.count = 1
      })
      return el.track.artists
    }).reduce(distinctReduceBy('id'), {})
    const finalList = _.flatMap(Object.values(dict))
    console.log(info(`Total: ${finalList.length} artists found`))
    return _.orderBy(finalList, ['count', 'name'], ['desc', 'asc'])
  }

  async addCurrent() {
    const {
      body: {
        item: { id, name },
      },
    } = await this.getMyCurrentPlayingTrack()
    console.log(info(`Now playing ${name}`))
    try {
      await this.addToMySavedTracks([id])
    } catch (error) {
      errorHandler(error)('Failed to add to the library')
    }
  }

  async getAllPlaylists() {
    const tasks = await this.pageConcater(this.getUserPlaylists.bind(this))()
    const data = await Promise.all(tasks)
    const items = _.flatMap(data, el => el.body.items)
    return items
  }

  getTopArtists(options) {
    return this.timeRangeConcater(this.getMyTopArtists.bind(this))(options)(
      pruneArtist,
    )
  }

  getTopTracks(options) {
    return this.timeRangeConcater(this.getMyTopTracks.bind(this))(options)(
      pruneTrack,
    )
  }

  async analyzeGenre(playlistId) {
    const artistIdList = (await this.getAllArtists(playlistId)).map(el => el.id)
    const tasks = _.chunk(artistIdList, DEFAULT_LIMIT).map(el =>
      this.getArtists.bind(this)(el),
    )
    const data = await Promise.all(tasks)
    const genreList = _.flatMapDeep(data, ({ body }) =>
      body.artists.map(a =>
        a.genres.map(g => ({
          name: g,
          count: 1,
        })),
      ),
    )
    const genreDict = genreList.reduce(distinctReduceBy('name'), {})
    const ordered = Object.values(genreDict)
    console.log(info(`Total: ${ordered.length} genres found`))
    return _.orderBy(ordered, ['count', 'name'], ['desc', 'asc'])
  }

  async analyzeGenreTokenized(playlistId) {
    const genreList = await this.analyzeGenre(playlistId)
    const tokenDict = _.flatMapDeep(genreList, el => {
      const tokens = el.name.split(/\s+/)
      return tokens.map(t => ({
        name: t,
        count: el.count,
      }))
    }).reduce(distinctReduceBy('name'), {})
    return _.orderBy(
      Object.values(tokenDict),
      ['count', 'name'],
      ['desc', 'asc'],
    )
  }

  async analyzeAudioFeatures(playlistId) {
    const trackIdArr = (await this.getAllTracks(playlistId)).map(
      el => el.track.id,
    )
    const chunks = _.chunk(trackIdArr, DEFAULT_LIMIT)
    const data = await Promise.all(
      chunks.map(ch => this.getAudioFeaturesForTracks.bind(this)(ch)),
    )
    const audioFeatures = _.flatMap(data, d => d.body.audio_features)
    const average = audioFeatures.reduce((acc, cur) => {
      const obj = {}
      FEATURE_KEYS.forEach(key => {
        obj[key] = (acc[key] + cur[key]) / 2
      })
      return obj
    })

    return _.toPairs(average).map(el => ({
      name: el[0],
      value: el[1],
    }))
  }
}
