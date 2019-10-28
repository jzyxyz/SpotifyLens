const result = require('dotenv').config()

if (result.error) {
  throw new Error(result.error)
}
const open = require('open')
const Koa = require('koa')
const app = new Koa()
const Router = require('koa-router')
const router = new Router()
const cors = require('koa2-cors')
const Lens = require('./lens.new')
const { SPOTIFY_SCOPES: scopes } = require('../config')

const lens = new Lens({
  clientId: process.env.ClientID,
  clientSecret: process.env.ClientSecret,
  redirectUri: `http://localhost:${process.env.Port}/callback/`,
})

router.get('/api/auth', ctx => {
  const state = 'ThisIsNotRandomAtAll'
  const authUrl = lens.createAuthorizeURL(scopes, state)
  ctx.redirect(authUrl)
})

const parsePlaylistId = async (ctx, next) => {
  ctx.playlistId = ctx.query.playlist || undefined
  console.log('p-id:', ctx.playlistId)
  await next()
}

router.get('/api/all-tracks', parsePlaylistId)
router.get('/api/all-tracks', async ctx => {
  let data
  try {
    data = await lens.allTracks(ctx.playlistId)
  } catch (e) {
    console.log(e)
    ctx.throw(500, e)
  }
  ctx.body = data
})

router.get('/api/rank-artists', parsePlaylistId)
router.get('/api/rank-artists', async ctx => {
  let data
  try {
    data = await lens.rankArtists(ctx.playlistId)
  } catch (e) {
    console.log(e)
    ctx.throw(500, e)
  }
  ctx.body = data
})

router.get('/api/rank-genres', parsePlaylistId)
router.get('/api/rank-genres', async ctx => {
  let data
  try {
    data = await lens.rankGenres(ctx.playlistId)
  } catch (e) {
    console.log(e)
    ctx.throw(500, e)
  }
  ctx.body = data
})

router.get('/api/audio-features', parsePlaylistId)
router.get('/api/audio-features', async ctx => {
  let data
  try {
    data = await lens.audioFeatures(ctx.playlistId)
  } catch (e) {
    console.log(e)
    ctx.throw(500, e)
  }
  ctx.body = data
})

router.get('/callback', async ctx => {
  const code = ctx.query.code || null
  console.log(code)
  let data = null
  try {
    data = await lens.authorizationCodeGrant(code)
    lens.setAccessToken(data.body['access_token'])
    lens.setRefreshToken(data.body['refresh_token'])
  } catch (error) {
    ctx.throw(500, 'fail to get token')
  }
  setInterval(lens.refreshToken, 3000000)
  ctx.body = {
    message: 'ok',
  }
})

app.use(cors())
app.use(router.routes())
app.listen(process.env.Port)
open('http://localhost:3000/api/auth')
