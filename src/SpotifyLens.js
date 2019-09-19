const _ = require('lodash')
const {
  distinctReduceBy,
  pruneTrack,
  errorHandler,
  readJsonFromFile,
  pruneArtist,
} = require('./utils')
const allSettled = require('promise.allsettled')
const path = require('path')

class SpotifyLens {
  constructor(spotifyApi, options) {
    this.spotifyApi = spotifyApi
    this.options = options
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
    let data = await getter(playlistId)({ offset: 0, limit })
    const {
      body: { total },
    } = data
    console.log(`Total: ${total} tracks found`)

    const batch = Math.ceil(total / limit)
    const requests = _.range(0, batch).map(i =>
      getter(playlistId)({
        offset: i * limit,
        limit,
      }),
    )

    // const dataReducer = (acc, cur, idx) => {
    //   if (typeof cur === 'number') {
    //     rejected.push(cur)
    //   } else {
    //     return acc.concat(cur)
    //   }
    // }

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

    console.log(`Failed requests: ${rejected.length}`)
    return _.compact(responses.map(responseHandler))
  }

  async getFavArtists(playlistId) {
    let trackList = await this.getAllTracks(playlistId)
    trackList = _.flatten(trackList)
    const dict = _.flatMap(trackList, el => {
      el.track.artists.forEach(el => {
        el.count = 1
      })
      return el.track.artists
    }).reduce(distinctReduceBy('id'), {})
    const finalList = _.flatMap(Object.values(dict))
    const ordered = _.orderBy(finalList, ['count', 'name'], ['desc', 'asc'])
    return ordered
  }

  async addCurrent() {
    let currentTrack
    try {
      currentTrack = await this.spotifyApi.getMyCurrentPlayingTrack()
    } catch (error) {
      errorHandler(error)('Failed to get data from Spotify')
    }
    const {
      body: {
        item: { id, name },
      },
    } = currentTrack
    console.log(`Now playing ${name}`)
    try {
      await this.spotifyApi.addToMySavedTracks([id])
    } catch (error) {
      errorHandler(error)('Failed to add to the library')
    }
  }

  async nextTrack() {
    console.log(process.cwd())
    try {
      await this.spotifyApi.skipToNext()
    } catch (error) {
      errorHandler(error)('Failed to do so....')
    }
  }

  async showPlaylists() {
    let data
    try {
      data = await this.spotifyApi.getUserPlaylists()
    } catch (error) {
      errorHandler(error)('Failed to do so....')
    }
    const {
      body: { items },
    } = data
    // items.forEach(el => {
    //   prunePlaylist(el)
    //   const { name, id } = el
    //   console.log()
    // })
    return items.map(el => {
      const { name, id } = el
      return `${name} : ${id}`
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
    // let artistIdList = await readJsonFromFile(
    //   path.join(process.cwd(), 'data', 'artists', 'fav_artists.json'),
    // )
    let artistIdList = await this.getFavArtists(playlistId)
    artistIdList = artistIdList.map(el => el.id)
    const getter = this.spotifyApi.getArtists.bind(this.spotifyApi)
    const tasks = _.chunk(artistIdList, 50).map(el => getter(el))
    const dataArr = await Promise.all(tasks)
    const genreList = _.flatMapDeep(dataArr, data =>
      data.body.artists.map(a => a.genres),
    )
    const genreDict = genreList.reduce((acc, cur) => {
      if (acc[cur]) {
        acc[cur]['count'] += 1
      } else {
        acc[cur] = {
          count: 1,
          name: cur,
        }
      }
      return acc
    }, {})
    const ordered = Object.values(genreDict)
    return _.orderBy(ordered, ['count', 'name'], ['desc', 'asc'])
  }

  async analyzeGenreTokenized(playlistId) {
    const genreList = await this.analyzeGenre(playlistId)
    let tokenDict = _.flatMapDeep(genreList, el => {
      const tokens = el.name.split(/\s+/)
      return tokens.map(t => ({
        token: t,
        count: 1,
      }))
    }).reduce((acc, cur) => {
      const { token } = cur
      if (acc[token]) {
        acc[token]['count'] += 1
      } else {
        acc[token] = {
          count: 1,
          token,
        }
      }
      return acc
    }, {})
    return _.orderBy(
      Object.values(tokenDict),
      ['count', 'token'],
      ['desc', 'asc'],
    )
  }
}

module.exports = SpotifyLens
