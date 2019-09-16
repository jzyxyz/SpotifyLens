const SpotifyWebApi = require('spotify-web-api-node')
const cors = require('cors')
const express = require('express')
const cookieParser = require('cookie-parser')
const SpotifyLens = require('./SpotifyLens')
const { errorHandler } = require('./utils')
const inquirer = require('inquirer')

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

  start() {
    this.server = this.app.listen(process.env.Port)
    console.log(`Getting access token on port ${process.env.Port}`)
    const state = 'ThisIsNotRandomAtAll'
    const scopes = [
      'user-read-private',
      'user-read-email',
      'user-library-read',
      'playlist-read-private',
      'user-top-read',
    ]
    const authUrl = this.spotifyApi.createAuthorizeURL(scopes, state)
    console.log('Follow the url to authenticate. ')
    console.log(authUrl)
  }

  async authDoneCallback() {
    this.lens = new SpotifyLens(this.spotifyApi)
    const readInput = async () => {
      const { operations: op } = await inquirer.prompt([
        {
          type: 'list',
          name: 'operations',
          message: 'What do you like me to do?',
          choices: [
            '#1 Export all tracks from my library.',
            '#2 Export an ordered & ranked artists list.',
            new inquirer.Separator(),
            '#3 All',
            new inquirer.Separator(),
            '#4 Exit',
          ],
        },
      ])
      return op
    }

    let loop = true
    while (loop) {
      const op = await readInput()
      let choice = /(?<=#)\d{1}/.exec(op)[0]
      choice = parseInt(choice)
      switch (choice) {
        case 1:
          await this.lens.getAllTracks()
          break
        case 2:
          await this.lens.getFavArtists()
          break
        case 3:
          await this.lens.getAllTracks()
          await this.lens.getFavArtists()
          break
        default:
          loop = false
          break
      }
      console.log('Done! ')
    }
    this.server.close()
    process.exit(0)
  }
}

module.exports = Worker
