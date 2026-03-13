const activeRooms = new Map()

function joinRoom(socket, payload) {
  const roomId = payload?.roomId

  if (!roomId) {
    socket.emit('room:error', { message: 'roomId là bắt buộc' })
    return
  }

  const room = activeRooms.get(roomId) ?? { players: [] }

  if (!room.players.includes(socket.id)) {
    room.players.push(socket.id)
  }

  activeRooms.set(roomId, room)
  socket.join(roomId)

  socket.emit('room:joined', { roomId, players: room.players.length })
  socket.to(roomId).emit('room:player_joined', { socketId: socket.id })
}

function leaveAllRooms(socket) {
  activeRooms.forEach((room, roomId) => {
    if (!room.players.includes(socket.id)) {
      return
    }

    room.players = room.players.filter((playerId) => playerId !== socket.id)

    if (room.players.length === 0) {
      activeRooms.delete(roomId)
      return
    }

    activeRooms.set(roomId, room)
    socket.to(roomId).emit('room:player_left', { socketId: socket.id })
  })
}

module.exports = {
  joinRoom,
  leaveAllRooms,
}
