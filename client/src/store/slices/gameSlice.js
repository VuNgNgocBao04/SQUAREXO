import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  currentRoomId: null,
  board: null,
  turn: 'X',
  status: 'idle',
}

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    joinRoomSuccess: (state, action) => {
      state.currentRoomId = action.payload.roomId
      state.status = 'playing'
    },
    updateBoard: (state, action) => {
      state.board = action.payload.board
      state.turn = action.payload.turn
    },
    resetGame: () => initialState,
  },
})

export const { joinRoomSuccess, updateBoard, resetGame } = gameSlice.actions
export default gameSlice.reducer
