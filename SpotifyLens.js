const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const {
  distinctReduceBy,
  readJsonFromFile,
  pruneTrack,
  errorHandler,
  writeToFile,
} = require('./utils')
const { promisify } = require('util')
let mkdirp = require('mkdirp')
mkdirp = promisify(mkdirp)
const allSettled = require('promise.allsettled')

const ALL_SAVED_TRACKS = `all_saved_tracks`
const ARTISTS = 'artists'

class SpotifyLens {
  constructor(spotifyApi, options) {
    this.spotifyApi = spotifyApi
    this.options = options
    this.outputDir = path.join(__dirname, process.env.OutputDir)
  }

  async getAllTracks(playlistId) {
    const limit = 50

    let data = {}
    data = await this.spotifyApi.getMySavedTracks({ offset: 0, limit })
    const {
      body: { total },
    } = data

    console.log(`Total: ${total} tracks found`)
    const batch = Math.ceil(total / limit)
    const requests = _.range(0, batch).map(i =>
      this.spotifyApi.getMySavedTracks({
        offset: i * limit,
        limit,
      }),
    )

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
        return idx
      }
    }

    // const dataReducer = (acc, cur, idx) => {
    //   if (typeof cur === 'number') {
    //     rejected.push(cur)
    //   } else {
    //     return acc.concat(cur)
    //   }
    // }

    const responses = await allSettled(requests)
    const rejected = []

    const results = responses.map(responseHandler)

    const tasks = results.map(async (el, idx) => {
      if (typeof el === 'number') {
        rejected.push(el)
      } else {
        await writeToFile(
          path.join(this.outputDir, ALL_SAVED_TRACKS),
          `tracks_${idx * limit}.json`,
          JSON.stringify(el),
        )
      }
    })

    await Promise.all(tasks)
    console.log(`Failed requests: ${rejected.length}`)
  }

  async getFavArtists() {
    let files = await fs.promises.readdir(
      path.join(this.outputDir, ALL_SAVED_TRACKS),
    )
    console.log(files)

    const processor = async uri => {
      const trackList = await readJsonFromFile(
        path.join(this.outputDir, ALL_SAVED_TRACKS, uri),
      )
      const artistsDict = _.flatMap(trackList, el => {
        el.track.artists.forEach(el => {
          el.count = 1
        })
        return el.track.artists
      }).reduce(distinctReduceBy('id'), {})

      const artistsList = _.flatMap(Object.values(artistsDict))
      return artistsList
    }

    const todo = _.flatMap(files, processor)
    let allLists = await Promise.all(todo)
    const flat = _.flatMap(allLists)
    const finalDict = flat.reduce(distinctReduceBy('id'), {})
    const finalList = _.flatMap(Object.values(finalDict))
    const ordered = _.orderBy(finalList, ['count', 'name'], ['desc', 'asc'])
    const p = path.join(this.outputDir, ARTISTS)
    try {
      await mkdirp(p)
      await fs.promises.writeFile(
        path.join(p, 'fav_artists.json'),
        JSON.stringify(ordered),
      )
    } catch (error) {
      errorHandler(error)('Failed to write to file')
    }
    console.log(`Found ${finalList.length} artists in total.`)
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
}

module.exports = SpotifyLens
