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
const _ = require('lodash')

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
    const id = undefined

    let loop = true
    while (loop) {
      const op = await readInput()
      let choice = /(?<=#)\d+/.exec(op)[0]
      choice = parseInt(choice)
      switch (choice) {
        case 0:
          await this.lens.addCurrent()
          break
        case 1:
          try {
            await this.spotifyApi.skipToNext()
          } catch (error) {
            errorHandler(error)('Failed to skip to the next one')
          }
          break
        case 2:
          const allTracks = await this.lens.getAllTracks(id)
          await writeToFile(
            path.join(this.outputDir, process.env.Tracks),
            `default_all_saved_tracks_${id ? id.slice(0, 6) : ''}.json`,
            JSON.stringify(allTracks),
          )
          break
        case 3:
          const allArtistsList = await this.lens.getAllArtists(id)
          await writeToFile(
            path.join(this.outputDir, process.env.Artists),
            `fav_artists_${id ? id.slice(0, 6) : ''}.json`,
            JSON.stringify(allArtistsList),
          )
          break
        case 4:
          const playLists = await this.lens.showPlaylists()
          await writeToFile(
            path.join(this.outputDir, process.env.Playlists),
            `user_playlists.json`,
            JSON.stringify(playLists),
          )
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
          const genreList = await this.lens.analyzeGenre(id)
          await writeToFile(
            path.join(this.outputDir, process.env.Genres),
            `top_genres_${id ? id.slice(0, 6) : ''}.json`,
            JSON.stringify(genreList),
          )
          break
        case 8:
          const genreTokenizedList = await this.lens.analyzeGenreTokenized(id)
          await writeToFile(
            path.join(this.outputDir, process.env.Genres),
            `top_genres_tokenized_${id ? id.slice(0, 6) : ''}.json`,
            JSON.stringify(genreTokenizedList),
          )
          break
        case 9:
          const audioFeatures = await this.lens.analyzeAudioFeatures(id)
          await writeToFile(
            path.join(this.outputDir, process.env.AudioFeatures),
            `default_tracks_audio_features_${id ? id.slice(0, 6) : ''}.json`,
            JSON.stringify(audioFeatures),
          )
          break
        case 10:
          const getGenre = async id => await this.lens.analyzeGenre(id)
          const getArtist = async id => await this.lens.getAllArtists(id)
          const getFeature = async id =>
            await this.lens.analyzeAudioFeatures(id)
          const countryList = require('../country_list')
          const failed = {}
          async function* dataGen(indexArray) {
            for (let i = 0; i < indexArray.length; i++) {
              const cur = indexArray[i]
              const el = countryList[cur]
              try {
                const [genres, artists, features] = await Promise.all([
                  getGenre(el.id),
                  getArtist(el.id),
                  getFeature(el.id),
                ])
                yield {
                  idx: cur,
                  ...el,
                  genres: genres.filter(d => d.count > 6),
                  artists: artists.filter(d => d.count > 1),
                  features,
                }
              } catch (error) {
                failed[cur] = true
                yield {
                  idx: cur,
                  failed: true,
                }
                console.log('bad', cur, el.name)
              }
            }
          }
          const loop = generator => async indexArray => {
            const gen = generator(indexArray)
            let data = await gen.next()
            while (data.done === false) {
              if (data.value.failed === true) {
                console.log('Still failing', Object.keys(failed))
              } else {
                console.log('ok', data.value.idx)
                // use aync write can improve performance
                await writeToFile(
                  path.join(this.outputDir, 'country'),
                  `${data.value.name}.json`,
                  JSON.stringify(data.value),
                )
                if (failed[data.value.idx]) {
                  delete failed[data.value.idx]
                }
              }
              data = await gen.next()
            }
          }
          await loop(dataGen)(_.range(countryList.length))

          while (Object.keys(failed).length) {
            await loop(dataGen)(Object.keys(failed))
          }
          console.log(failed)
          break
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
