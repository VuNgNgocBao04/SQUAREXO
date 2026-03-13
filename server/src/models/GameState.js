const mongoose = require('mongoose')

const gameStateSchema = new mongoose.Schema(
  {
    boardSize: {
      type: Number,
      default: 3,
    },
    cells: {
      type: [String],
      default: () => Array(9).fill(null),
    },
    edges: {
      type: [String],
      default: [],
    },
    squares: {
      type: [String],
      default: [],
    },
    currentTurn: {
      type: String,
      enum: ['X', 'O'],
      default: 'X',
    },
    status: {
      type: String,
      enum: ['waiting', 'playing', 'finished'],
      default: 'waiting',
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('GameState', gameStateSchema)
