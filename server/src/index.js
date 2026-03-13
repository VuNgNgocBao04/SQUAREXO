const http = require('http')
const app = require('./app')
const { connectDatabase } = require('../config/db')
const { env } = require('../config/env')
const { initSocketServer } = require('./sockets')

async function bootstrap() {
  await connectDatabase()

  const server = http.createServer(app)
  initSocketServer(server)

  server.listen(env.port, () => {
    console.log(`Server listening on port ${env.port}`)
  })
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap server', error)
  process.exit(1)
})
