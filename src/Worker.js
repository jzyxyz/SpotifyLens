const SpotifyWebApi = require('spotify-web-api-node')
const cors = require('cors')
const express = require('express')
const cookieParser = require('cookie-parser')
const SpotifyLens = require('./SpotifyLens')
const { errorHandler, writeToFile } = require('./utils')
const inquirer = require('inquirer')
const open = require('open')
const { SPOTIFY_SCOPES: scopes, PROMPT: prompt } = require('../config')
const path = require('path')
const chalk = require('chalk')

class Worker {
  constructor() {
    this.loadEnv()
    const REDIRECT_URL = `http://localhost:${process.env.Port}/callback/`
    this.spotifyApi = new SpotifyWebApi({
      clientId: process.env.ClientID,
      clientSecret: process.env.ClientSecret,
      redirectUri: REDIRECT_URL,
    })

    this.app = express()
    this.app.use(cors()).use(cookieParser())
    // necessary
    this.authDoneCallback = this.authDoneCallback.bind(this)
    this.spotifyApi.refreshAccessToken = this.spotifyApi.refreshAccessToken.bind(
      this.spotifyApi,
    )
    this.spotifyApi.setAccessToken = this.spotifyApi.setAccessToken.bind(
      this.spotifyApi,
    )
    this.authServerHook(this.authDoneCallback)
    this.outputDir = path.join(process.cwd(), process.env.OutputDir)
  }

  loadEnv() {
    try {
      require('dotenv').config()
    } catch (error) {
      errorHandler(error)('Failed to load .env')
      process.exit(1)
    }
  }

  authServerHook(callback) {
    this.app.get('/callback', async (req, res) => {
      const code = req.query.code || null
      let data = null
      try {
        data = await this.spotifyApi.authorizationCodeGrant(code)
        this.spotifyApi.setAccessToken(data.body['access_token'])
        this.spotifyApi.setRefreshToken(data.body['refresh_token'])
        callback()
      } catch (error) {
        res.status(500).json({
          message: 'Failed to get access token',
        })
        errorHandler(error)('Failed to get access token')
      }
      res.json({
        message: 'Authentication successful! Now go back to ther terminal.',
      })
    })
  }

  async start() {
    this.server = this.app.listen(process.env.Port)
    // console.log(`Getting access token on port ${process.env.Port}`)
    const state = 'ThisIsNotRandomAtAll'
    const authUrl = this.spotifyApi.createAuthorizeURL(scopes, state)
    // console.log(authUrl)
    await open(authUrl)
  }

  async authDoneCallback() {
    this.server.close()
    this.lens = new SpotifyLens(this.spotifyApi)
    const readInput = async () => {
      const { operations: op } = await inquirer.prompt([prompt])
      return op
    }

    this.refreshIntervalId = setInterval(async () => {
      try {
        const {
          body: { access_token },
        } = await this.spotifyApi.refreshAccessToken()
        this.spotifyApi.setAccessToken(access_token)
      } catch (error) {
        errorHandler(error)('Failed to refresh access token')
      }
    }, 3000000)

    let loop = true
    while (loop) {
      const op = await readInput()
      let choice = /(?<=#)\d{1}/.exec(op)[0]
      choice = parseInt(choice)
      switch (choice) {
        case 0:
          await this.lens.addCurrent()
          break
        case 1:
          await this.lens.nextTrack()
          break
        case 2:
          // const playlistId = '4ADFwns89Zo5O3ea13wFG3'
          const playlistId = undefined
          const pagedTracks = await this.lens.getAllTracks()
          const tasks = pagedTracks.map(async (el, idx) => {
            const filename = playlistId =>
              `${playlistId ? playlistId.slice(0, 7) : 'tracks'}_${idx}.json`
            await writeToFile(
              path.join(this.outputDir, process.env.Tracks),
              filename(playlistId),
              JSON.stringify(el),
            )
          })
          await Promise.all(tasks)
          break
        case 3:
          const favArtistsList = await this.lens.getFavArtists()
          await writeToFile(
            path.join(this.outputDir, process.env.Artists),
            `fav_artists.json`,
            JSON.stringify(favArtistsList),
          )
          break
        case 4:
          const playLists = await this.lens.showPlaylists()
          playLists.forEach(pl => {
            console.log(pl)
          })
          break
        case 5:
          const topArtistsList = await this.lens.getTopArtists()
          await writeToFile(
            path.join(this.outputDir, process.env.Artists),
            `top_artists_by_spotify.json`,
            JSON.stringify(topArtistsList),
          )
          break
        case 6:
          const topTracksList = await this.lens.getTopTracks()
          await writeToFile(
            path.join(this.outputDir, process.env.Tracks),
            `top_tracks_by_spotify.json`,
            JSON.stringify(topTracksList),
          )
          break
        case 7:
          const genreList = await this.lens.analyzeGenre()
          await writeToFile(
            path.join(this.outputDir, process.env.Genres),
            `top_genres.json`,
            JSON.stringify(genreList),
          )
          break
        case 8:
          const genreTokenizedList = await this.lens.analyzeGenreTokenized()
          await writeToFile(
            path.join(this.outputDir, process.env.Genres),
            `top_genres_tokenized.json`,
            JSON.stringify(genreTokenizedList),
          )
          break
        case 9:
          const audioFeatures = await this.lens.analyzeAudioFeatures()
          await writeToFile(
            path.join(this.outputDir, process.env.AudioFeatures),
            `default_tracks_audio_features.json`,
            JSON.stringify(audioFeatures),
          )
        default:
          loop = false
      }
      console.log(chalk.green.bold('Done!'))
    }
    clearInterval(this.refreshIntervalId)
    process.exit(0)
  }
}

module.exports = Worker
