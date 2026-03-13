const mongoose = require('mongoose')

const matchSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
    },
    players: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        symbol: {
          type: String,
          enum: ['X', 'O'],
          required: true,
        },
      },
    ],
    gameState: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameState',
      required: true,
    },
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['waiting', 'playing', 'finished'],
      default: 'waiting',
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Match', matchSchema)
