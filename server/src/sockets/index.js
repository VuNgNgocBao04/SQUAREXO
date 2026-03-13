const { Server } = require('socket.io')
const { env } = require('../../config/env')
const { joinRoom, leaveAllRooms } = require('./roomHandlers')

function initSocketServer(server) {
  const io = new Server(server, {
    cors: {
      origin: env.clientOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`)

    socket.on('room:join', (payload) => joinRoom(socket, payload))

    socket.on('disconnect', () => {
      leaveAllRooms(socket)
      console.log(`Socket disconnected: ${socket.id}`)
    })
  })

  return io
}

module.exports = {
  initSocketServer,
}
