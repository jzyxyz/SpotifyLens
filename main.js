const SpotifyWebApi = require('spotify-web-api-node')
const cors = require('cors')
const express = require('express')
const cookieParser = require('cookie-parser')
const SpotifyLens = require('./SpotifyLens')

class Worker {
  constructor() {
    this.dotenv = this.loadEnv()
    this.spotifyApi = new SpotifyWebApi({
      clientId: process.env.ClientID,
      clientSecret: process.env.ClientSecret,
      redirectUri: process.env.LogInCallback,
    })
    this.app = express()
    this.app.use(cors()).use(cookieParser())
    this.authDoneCallback = this.authDoneCallback.bind(this)
  }

  async authDoneCallback() {
    console.log('authenticated successfully')
    // this.server.close()
    this.lens = new SpotifyLens(this.spotifyApi)
    await this.lens.getFavArtists()
    console.log('done')
  }

  loadEnv() {
    let dotenv = {}
    try {
      dotenv = require('dotenv').config()
    } catch (err) {
      console.error('Failed to load .env')
      process.exit(1)
    }
    return dotenv
  }

  authInit() {
    const state = 'some-state-of-my-choice'
    const scopes = [
      'user-read-private',
      'user-read-email',
      'user-library-read',
      'playlist-read-private',
      'user-top-read',
    ]
    const authUrl = this.spotifyApi.createAuthorizeURL(scopes, state)
    console.log(authUrl)
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
        console.error('Failed to get access token')
        res.status(500).json({
          error: {
            message: 'Failed to get access token',
          },
        })
      }
      res.json({
        ok: true,
        message: 'Authentication successful! Now go back to ther terminal.',
      })
    })
  }

  auth() {
    this.authServerHook(this.authDoneCallback)
    this.server = this.app.listen(3000)
    console.log('listening on 3000')
    this.authInit()
  }
}

let w = new Worker()
w.auth()
