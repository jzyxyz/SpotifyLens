const fs = require('fs')
const { promisify } = require('util')
let mkdirp = require('mkdirp')
const path = require('path')
mkdirp = promisify(mkdirp)

const prunePlaylist = obj => {
  const pruneProps = [
    'external_urls',
    'collaborative',
    'owner',
    'public',
    'snapshot_id',
  ]
  pruneProps.forEach(prop => {
    delete obj[prop]
  })
}

const pruneTrack = obj => {
  const pruneProps = [
    'album',
    'available_markets',
    'disc_number',
    'duration_ms',
    'explicit',
    'external_ids',
    'external_urls',
    'owner',
    'public',
    'is_playable',
    'linked_from',
    'restrictions',
    'popularity',
    'preview_url',
    'track_number',
    'is_local',
  ]
  pruneProps.forEach(prop => {
    delete obj[prop]
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

const readJsonFromFile = async absoPath => {
  let text
  try {
    text = await fs.promises.readFile(absoPath)
  } catch (error) {
    errorHandler(error)(`Failed to open file ${absoPath}`)
  }
  return JSON.parse(text)
}

const errorHandler = error => msg => {
  console.log(msg)
  // console.error(error)
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

module.exports = {
  prunePlaylist,
  errorHandler,
  pruneTrack,
  distinctReduceBy,
  readJsonFromFile,
  writeToFile,
}
