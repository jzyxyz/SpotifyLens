const _ = require('lodash')
const { distinctReduceBy, pruneTrack, errorHandler } = require('./utils')
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

class SpotifyLens {
  constructor(spotifyApi) {
    this.spotifyApi = spotifyApi
    this.spotifyApi.getUserPlaylists = this.spotifyApi.getUserPlaylists.bind(
      this.spotifyApi,
    )
    this.spotifyApi.getPlaylistTracks = this.spotifyApi.getPlaylistTracks.bind(
      this.spotifyApi,
    )
    this.spotifyApi.getMySavedTracks = this.spotifyApi.getMySavedTracks.bind(
      this.spotifyApi,
    )
  }

  concatWrapper(getter) {
    return async function(id) {
      const limit = DEFAULT_LIMIT
      let total
      if (id) {
        total = (await getter(id, { offset: 0, limit })).body.total
      } else {
        total = (await getter({ offset: 0, limit })).body.total
      }
      console.log(info(`Total: ${total} objects found`))
      const batch = Math.ceil(total / limit)
      return _.range(0, batch).map(async i =>
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

  async getAllTracks(playlistId) {
    const getter = playlistId
      ? this.spotifyApi.getPlaylistTracks
      : this.spotifyApi.getMySavedTracks

    const tasks = await this.concatWrapper(getter)(playlistId)
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
    } = await this.spotifyApi.getMyCurrentPlayingTrack()
    console.log(info(`Now playing ${name}`))
    try {
      await this.spotifyApi.addToMySavedTracks([id])
    } catch (error) {
      errorHandler(error)('Failed to add to the library')
    }
  }

  async showPlaylists() {
    const tasks = await this.concatWrapper(this.spotifyApi.getUserPlaylists)()
    const data = await Promise.all(tasks)
    const items = _.flatMap(data, el => el.body.items)
    return items.map(({ name, id }) => ({
      name,
      id,
    }))
  }

  async getTopHandler(getter, { time_range, limit, offset }, pruneFn) {
    const TIME_RANGES = ['long_term', 'medium_term', 'short_term']
    if (time_range) {
      return await getter({
        time_range,
        limit: limit || DEFAULT_LIMIT,
        offset: offset || 0,
      })
    } else {
      const requests = TIME_RANGES.map(tr =>
        getter({
          time_range: tr,
          limit: limit || DEFAULT_LIMIT,
          offset: offset || 0,
        }),
      )
      const responses = await Promise.all(requests)
      const items = responses.map(r => r.body.items)
      if (pruneFn) {
        items.forEach(arr => arr.forEach(pruneTrack))
      }
      return _.zipObject(TIME_RANGES, items)
    }
  }

  getTopArtists(options) {
    let opt = !options ? {} : options
    const getter = this.spotifyApi.getMyTopArtists.bind(this.spotifyApi)
    return this.getTopHandler(getter, opt)
  }

  getTopTracks(options) {
    let opt = !options ? {} : options
    const getter = this.spotifyApi.getMyTopTracks.bind(this.spotifyApi)
    return this.getTopHandler(getter, opt, pruneTrack)
  }

  async analyzeGenre(playlistId) {
    const artistIdList = (await this.getAllArtists(playlistId)).map(el => el.id)
    const getter = this.spotifyApi.getArtists.bind(this.spotifyApi)
    const tasks = _.chunk(artistIdList, DEFAULT_LIMIT).map(el => getter(el))
    const dataArr = await Promise.all(tasks)
    const genreList = _.flatMapDeep(dataArr, data =>
      data.body.artists.map(a =>
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
    const ordered = _.orderBy(
      Object.values(tokenDict),
      ['count', 'name'],
      ['desc', 'asc'],
    )
    console.log(info(`Total: ${ordered.length} genre tokens found`))
    return ordered
  }

  async analyzeAudioFeatures(playlistId) {
    const trackIdArr = (await this.getAllTracks(playlistId)).map(
      el => el.track.id,
    )
    const chunks = _.chunk(trackIdArr, DEFAULT_LIMIT)
    const data = await Promise.all(
      chunks.map(ch => this.spotifyApi.getAudioFeaturesForTracks(ch)),
    )
    const audioFeatures = _.flatMap(data, d => d.body.audio_features)

    const average = audioFeatures.reduce((acc, cur) => {
      const obj = {}
      FEATURE_KEYS.forEach(key => {
        obj[key] = (acc[key] + cur[key]) / 2
      })
      return obj
    })
    return average
  }
}

module.exports = SpotifyLens
