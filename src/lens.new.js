const SpotifyWebApi = require('spotify-web-api-node')
const _ = require('lodash')
const R = require('ramda')
const chalk = require('chalk')
const batchSize = 50

const info = (...msg) => console.info(chalk.blue(...msg))
const infoLength = prefix => list => {
  info(prefix, list.length)
  return list
}

const tasksTo = key => async tasks => {
  const responses = _.isArray(tasks)
    ? await Promise.all(tasks)
    : await Promise.all([tasks])
  return _.flatMap(responses, el => el.body[key])
}
const features = [
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

const taskToItem = tasksTo('item')
const tasksToItems = tasksTo('items')
const tasksToArtists = tasksTo('artists')
const tasksToAudioFeatures = tasksTo('audio_features')
const identity = el => el
const artistsFromTracks = list => _.flatMap(list, el => el.track.artists)
const headWithCount = list => {
  const head = list[0]
  return {
    // ...head,
    head,
    count: list.length,
  }
}
const countGroupBy = iteratee => list => {
  const copy = list.map(identity)
  return _.chain(copy)
    .groupBy(iteratee)
    .values()
    .map(headWithCount)
    .value()
}
const countGroupById = countGroupBy(el => el.id)
const orderByCountAndName = list =>
  _.orderBy(list, ['count', 'name'], ['desc', 'asc'])

const countByIdThenOrder = R.pipe(
  countGroupById,
  orderByCountAndName,
  infoLength('********** Target Length: '),
)

const averageReduceByKey = keys => (acc, cur) => {
  const obj = {}
  keys.forEach(key => {
    obj[key] = (acc[key] + cur[key]) / 2
  })
  return obj
}

module.exports = class extends SpotifyWebApi {
  constructor(credentials) {
    super(credentials)
    this.getAccessToken = this.getAccessToken.bind(this)
    this.refreshAccessToken = this.refreshAccessToken.bind(this)
    this.setAccessToken = this.setAccessToken.bind(this)
  }

  concatWrapper(getter) {
    return async function(id) {
      const data = id ? await getter(id) : await getter()
      const { total } = data.body
      const batch = Math.ceil(total / batchSize)
      info(`Total: ${total} objects found, getting in ${batch} batches`)
      return _.range(0, batch).map(i =>
        id
          ? getter(id, {
              offset: i * batchSize,
              limit: batchSize,
            })
          : getter({
              offset: i * batchSize,
              limit: batchSize,
            }),
      )
    }
  }

  async allTracks(playlistId) {
    const tasks = playlistId
      ? await this.concatWrapper(this.getPlaylistTracks.bind(this))(playlistId)
      : await this.concatWrapper(this.getMySavedTracks.bind(this))()
    return tasksToItems(tasks)
  }

  async rankArtists(playlistId) {
    const tracks = await this.allTracks(playlistId)
    const artistsList = artistsFromTracks(tracks)
    return countByIdThenOrder(artistsList)
  }

  async likeCurrentPlaying() {
    const { id, name } = await taskToItem(this.getMyCurrentPlayingTrack)
    info(`Now playing ${name}`)
    await this.addToMySavedTracks([id]).catch(e => {
      console.log(e)
    })
  }

  async allArtistsFullObject(playlistId) {
    const artistIdList = (await this.rankArtists(playlistId)).map(el => el.id)
    const tasks = _.chunk(artistIdList, batchSize).map(el =>
      this.getArtists.bind(this)(el),
    )
    return tasksToArtists(tasks)
  }

  rankGenresOffline(artistsObjectList, options) {
    const tokenize = _.get(options, 'tokenize', false)
    let genres = _.flatMapDeep(artistsObjectList, el => el.genres)
    if (tokenize === true) {
      genres = genres.map(R.split(/\s+/))
    }
    return R.pipe(
      R.map(el => ({
        id: el,
      })),
      countByIdThenOrder,
    )(genres)
  }

  async rankGenres(playlistId, options) {
    const artists = await this.allArtistsFullObject(playlistId)
    return this.rankGenresOffline(artists, options)
  }

  async audioFeatures(playlistId) {
    const trackIdList = (await this.allTracks(playlistId)).map(
      el => el.track.id,
    )
    const tasks = _.chunk(trackIdList, batchSize).map(el =>
      this.getAudioFeaturesForTracks.bind(this)(el),
    )
    const af = await tasksToAudioFeatures(tasks)
    info(features)
    return af.reduce(averageReduceByKey(features))
  }

  async refreshToken() {
    try {
      const {
        body: { access_token },
      } = await this.refreshAccessToken()
      this.setAccessToken(access_token)
    } catch (e) {
      throw Error(e)
    }
  }
}
