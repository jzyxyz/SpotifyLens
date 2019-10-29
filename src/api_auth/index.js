const Router = require('koa-router')
const router = new Router()

const authScopes = [
  'user-read-private',
  'user-library-modify',
  'user-read-email',
  'user-library-read',
  'playlist-read-private',
  'user-top-read',
  'user-read-currently-playing',
  'user-modify-playback-state',
]

router.get('/api/auth', ctx => {
  const { lens } = ctx
  const state = 'ThisIsNotRandomAtAll'
  const authUrl = lens.createAuthorizeURL(authScopes, state)
  ctx.redirect(authUrl)
})

router.get('/api/callback', async ctx => {
  const { lens } = ctx
  const code = ctx.query.code || null
  //   console.log(code)
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
    message: 'Authenticated Successfully!',
  }
})

module.exports = router
