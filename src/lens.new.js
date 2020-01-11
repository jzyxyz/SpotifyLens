const SpotifyWebApi = require('spotify-web-api-node')
const _ = require('lodash')
const R = require('ramda')
const chalk = require('chalk')
const batchSize = 50
const constants = require('./constants.json')
const { features } = constants

const { countBy_ThenOrder, nameKV, averageReduceByKey } = require('./functions')

const info = (...msg) => console.info(chalk.blue(...msg))
const tasksTo = key => async tasks => {
  const responses = _.isArray(tasks)
    ? await Promise.all(tasks)
    : await Promise.all([tasks])
  return _.flatMap(responses, el => el.body[key])
}

const taskToItem = tasksTo('item')
const tasksToItems = tasksTo('items')
const tasksToArtists = tasksTo('artists')
const tasksToAudioFeatures = tasksTo('audio_features')
const artistsFromTracks = list => _.flatMap(list, el => el.track.artists)

module.exports = class extends SpotifyWebApi {
  constructor(credentials) {
    super(credentials)
    this.getAccessToken = this.getAccessToken.bind(this)
    this.refreshAccessToken = this.refreshAccessToken.bind(this)
    this.setAccessToken = this.setAccessToken.bind(this)
    this.createAuthorizeURL = this.createAuthorizeURL.bind(this)
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
    return countBy_ThenOrder('id')(artistsList)
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

  rankGenresSync(artistsObjectList, options) {
    const tokenize = _.get(options, 'tokenize', false)
    let genres = _.flatMapDeep(artistsObjectList, el => el.genres)
    if (tokenize === true) {
      genres = genres.map(R.split(/\s+/))
    }
    return R.pipe(
      R.map(el => ({
        name: el,
      })),
      countBy_ThenOrder('name'),
    )(genres)
  }

  async rankGenres(playlistId, options) {
    const artists = await this.allArtistsFullObject(playlistId)
    return this.rankGenresSync(artists, options)
  }

  async audioFeatures(playlistId) {
    const trackIdList = (await this.allTracks(playlistId)).map(
      el => el.track.id,
    )
    return this.audioFeaturesFromTrackIdList(trackIdList)
  }

  async audioFeaturesFromTrackIdList(trackIdList) {
    const tasks = _.chunk(trackIdList, batchSize).map(el =>
      this.getAudioFeaturesForTracks.bind(this)(el),
    )
    const af = await tasksToAudioFeatures(tasks)
    const trusy = af.filter(el => el !== null)
    info(`af is available for ${trusy.length} of 50 in the list`)
    return trusy.reduce(averageReduceByKey(features))
  }

  async calcAll(playlistId) {
    const tracks = await this.allTracks(playlistId)
    const artists = countBy_ThenOrder('id')(artistsFromTracks(tracks))
    const artistIdList = artists.map(el => el.id)
    const tasks = _.chunk(artistIdList, batchSize).map(el =>
      this.getArtists.bind(this)(el),
    )
    const fullArtistsObjList = await tasksToArtists(tasks)
    const genres = this.rankGenresSync(fullArtistsObjList)
    const trackIdList = tracks.map(el => el.track.id)
    const features = await this.audioFeaturesFromTrackIdList(trackIdList)
    return {
      genres,
      artists,
      features: nameKV(features),
    }
  }

  async refreshToken() {
    const {
      body: { access_token },
    } = await this.refreshAccessToken()
    this.setAccessToken(access_token)
  }
}
