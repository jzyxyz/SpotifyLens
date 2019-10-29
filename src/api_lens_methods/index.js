const Router = require('koa-router')
const router = new Router({ prefix: '/api/methods' })

router.get('/all-tracks', async ctx => {
  let data
  data = await ctx.lens.allTracks(ctx.playlistId)
  ctx.body = data
})

router.get('/rank-artists', async ctx => {
  let data
  data = await ctx.lens.rankArtists(ctx.playlistId)
  ctx.body = data
})

router.get('/rank-genres', async ctx => {
  let data
  data = await ctx.lens.rankGenres(ctx.playlistId)
  ctx.body = data
})

router.get('/audio-features', async ctx => {
  let data
  data = await ctx.lens.audioFeatures(ctx.playlistId)
  ctx.body = data
})

const { countryDataFn } = require('./functions')
router.get('/countries', countryDataFn)

module.exports = router
