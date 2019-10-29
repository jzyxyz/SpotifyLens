const result = require('dotenv').config()

if (result.error) {
  throw new Error(result.error)
}
const open = require('open')
const Koa = require('koa')
const app = new Koa()
const cors = require('koa2-cors')
const Lens = require('./lens.new')
const lens = new Lens({
  clientId: process.env.ClientID,
  clientSecret: process.env.ClientSecret,
  redirectUri: `http://localhost:${process.env.Port}/api/callback/`,
})

app.use(async (ctx, next) => {
  ctx.lens = lens
  ctx.playlistId = ctx.query.playlist || undefined
  console.log('playlist id:', ctx.playlistId)
  await next()
})

app.use(async (ctx, next) => {
  try {
    await next()
  } catch (err) {
    ctx.status = err.status || 500
    ctx.body = err.message
  }
})

app.use(cors())

const authRouter = require('./api_auth')
app.use(authRouter.routes())

const methodsRouter = require('./api_lens_methods')
app.use(methodsRouter.routes())

app.listen(process.env.Port)
open('http://localhost:3000/api/auth')
