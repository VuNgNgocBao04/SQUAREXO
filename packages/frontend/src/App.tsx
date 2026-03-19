import { useEffect } from 'react'
import GameCanvas from './components/GameCanvas'
import { useGameStore } from './store/gameStore'
import './App.css'

function App() {
  const initGame = useGameStore((state) => state.initGame)

  useEffect(() => {
    // Initialize game with 4x4 board
    initGame(4, 4)
  }, [initGame])

  return (
    <div className="app">
      <header className="app-header">
        <h1>SQUAREXO - Dots and Boxes</h1>
      </header>
      <main className="app-main">
        <GameCanvas />
      </main>
    </div>
  )
}

export default App
