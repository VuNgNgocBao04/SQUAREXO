import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import gameReducer from './slices/gameSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    game: gameReducer,
  },
})
