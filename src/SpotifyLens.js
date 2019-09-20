const _ = require('lodash')
const { distinctReduceBy, pruneTrack, errorHandler } = require('./utils')
const allSettled = require('promise.allsettled')
const chalk = require('chalk')
const info = chalk.blue
const error = chalk.red

class SpotifyLens {
  constructor(spotifyApi) {
    this.spotifyApi = spotifyApi
  }

  async getAllTracks(playlistId) {
    const limit = 50

    const getter = playlistId => options => {
      if (playlistId) {
        return this.spotifyApi.getPlaylistTracks(playlistId, options)
      } else {
        return this.spotifyApi.getMySavedTracks(options)
      }
    }
    const {
      body: { total },
    } = await getter(playlistId)({ offset: 0, limit })
    console.log(info(`Total: ${total} tracks found`))

    const batch = Math.ceil(total / limit)
    const requests = _.range(0, batch).map(i =>
      getter(playlistId)({
        offset: i * limit,
        limit,
      }),
    )
    const responses = await allSettled(requests)
    //TO DO: fix rejected requests
    const rejected = []

    const responseHandler = (r, idx) => {
      if (r.status === 'fulfilled') {
        const {
          value: {
            body: { items },
          },
        } = r
        items.forEach(item => {
          pruneTrack(item.track)
        })
        return items
      } else {
        rejected.push(idx)
        return null
      }
    }
    if (rejected.length) {
      console.log(error(`Failed requests: ${rejected.length}`))
    }
    return _.compact(responses.map(responseHandler))
  }

  async getFavArtists(playlistId) {
    const trackList = _.flatten(await this.getAllTracks(playlistId))
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

  async nextTrack() {
    try {
      await this.spotifyApi.skipToNext()
    } catch (error) {
      errorHandler(error)('Failed to skip to the next one')
    }
  }

  async showPlaylists() {
    const {
      body: { items },
    } = await this.spotifyApi.getUserPlaylists()
    return items.map(el => {
      const { name, id } = el
      return { name, id }
    })
  }

  async getTopHandler(getter, { time_range, limit, offset }, pruneFn) {
    const TIME_RANGES = ['long_term', 'medium_term', 'short_term']
    if (time_range) {
      return await getter({
        time_range,
        limit: limit || 50,
        offset: offset || 0,
      })
    } else {
      const requests = TIME_RANGES.map(tr =>
        getter({
          time_range: tr,
          limit: limit || 50,
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
    const artistIdList = (await this.getFavArtists(playlistId)).map(el => el.id)
    const getter = this.spotifyApi.getArtists.bind(this.spotifyApi)
    const tasks = _.chunk(artistIdList, 50).map(el => getter(el))
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
    const trackIdArr = _.flatten(await this.getAllTracks(playlistId)).map(
      el => el.track.id,
    )
    const chunks = _.chunk(trackIdArr, 50)
    const data = await Promise.all(
      chunks.map(ch => this.spotifyApi.getAudioFeaturesForTracks(ch)),
    )
    const audioFeatures = _.flatMap(data, d => d.body.audio_features)
    // console.log(JSON.stringify(audioFeatures))
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
