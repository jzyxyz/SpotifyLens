const fs = require('fs')
const { promisify } = require('util')
let mkdirp = require('mkdirp')
const path = require('path')
mkdirp = promisify(mkdirp)
const {
  PRUNE_PLAYLIST_KEYS,
  PRUNE_TRACK_KEYS,
  PRUNE_ARTIST_KEYS,
} = require('../config')

const prune = pruneKeys => obj => {
  pruneKeys.forEach(key => {
    delete obj[key]
  })
}

const distinctReduceBy = prop => (acc, cur) => {
  const key = cur[prop]
  if (acc[key] === undefined) {
    acc[key] = cur
  } else {
    acc[key].count += cur.count
  }
  return acc
}

const errorHandler = error => msg => {
  console.log(msg)
  console.error(error)
  throw new Error(error)
}

const writeToFile = async (dir, filename, string) => {
  try {
    await mkdirp(dir)
    await fs.promises.writeFile(path.join(dir, filename), string)
  } catch (error) {
    errorHandler(error)('Failed to write to file')
  }
}

const pruneTrack = prune(PRUNE_TRACK_KEYS)
const prunePlaylist = prune(PRUNE_PLAYLIST_KEYS)
const pruneArtist = prune(PRUNE_ARTIST_KEYS)

module.exports = {
  prunePlaylist,
  pruneTrack,
  errorHandler,
  distinctReduceBy,
  writeToFile,
  pruneArtist,
}
