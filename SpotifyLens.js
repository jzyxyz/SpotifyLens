const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const {
  distinctReduceBy,
  readJsonFromFile,
  pruneTrack,
  errorHandler,
} = require('./utils')
const { promisify } = require('util')
let mkdirp = require('mkdirp')
mkdirp = promisify(mkdirp)

const ALL_SAVED_TRACKS = `all_saved_tracks`
const ARTISTS = 'artists'

class SpotifyLens {
  constructor(spotifyApi, options) {
    this.spotifyApi = spotifyApi
    this.options = options
    this.outputDir = path.join(__dirname, process.env.OutputDir)
  }
  async getAllTracks() {
    let hasMore = true
    let offset = 0
    let limit = 50
    let data = {}
    while (hasMore) {
      try {
        data = await this.spotifyApi.getMySavedTracks({ offset, limit })
      } catch (error) {
        errorHandler(error)('Failed to fetch data from Spotify')
      }
      const {
        body: { items },
        body,
      } = data
      offset += items.length
      items.forEach(item => {
        pruneTrack(item.track)
      })
      const p = path.join(this.outputDir, ALL_SAVED_TRACKS)
      try {
        await mkdirp(p)
        await fs.promises.writeFile(
          path.join(p, `track_${offset}.json`),
          JSON.stringify(items),
        )
      } catch (error) {
        errorHandler(error)('Failed to write to file')
      }
      if (body.next === null) {
        hasMore = false
      }
    }
    console.log(`Fetched ${offset} tracks in total`)
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
}

module.exports = SpotifyLens
