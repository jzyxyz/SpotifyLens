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
              path.join(this.outputDir, process.env.All_Saved_Tracks),
              filename(playlistId),
              JSON.stringify(el),
            )
          })
          await Promise.all(tasks)
          break
        case 3:
          const FavArtistsList = await this.lens.getFavArtists()
          await writeToFile(
            path.join(this.outputDir, process.env.Artists),
            `fav_artists.json`,
            JSON.stringify(FavArtistsList),
          )
          console.log(`Found ${list.length} artists in total.`)
          break
        case 4:
          await this.lens.showPlaylists()
          break
        case 5:
          const topArtistsList = await this.lens.getTopArtists({ limit: 5 })
          await writeToFile(
            path.join(this.outputDir, process.env.Artists),
            `top_by_spotify.json`,
            JSON.stringify(topArtistsList),
          )
          break
        default:
          loop = false
      }
      console.log('Done! ')
    }
    process.exit(0)
  }
}

module.exports = Worker
