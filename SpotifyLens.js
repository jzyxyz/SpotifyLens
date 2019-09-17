const _ = require('lodash')
const {
  distinctReduceBy,
  pruneTrack,
  errorHandler,
  prunePlaylist,
} = require('./utils')
const { promisify } = require('util')
let mkdirp = require('mkdirp')
mkdirp = promisify(mkdirp)
const allSettled = require('promise.allsettled')

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

  async getFavArtists() {
    let trackList = await this.getAllTracks()
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
    items.forEach(el => {
      prunePlaylist(el)
      const { name, id } = el
      console.log(`${name} : ${id}`)
    })
  }
}

module.exports = SpotifyLens
