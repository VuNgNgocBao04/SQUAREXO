import { useSelector } from 'react-redux'
import { getInitialBoard } from '../core/gameEngine'

function HomePage() {
  const auth = useSelector((state) => state.auth)
  const game = useSelector((state) => state.game)

  return (
    <section className="panel">
      <h2>Lobby</h2>
      <p className="muted">
        Trạng thái đăng nhập: {auth.isAuthenticated ? 'Đã đăng nhập' : 'Chưa đăng nhập'}
      </p>
      <p className="muted">Room hiện tại: {game.currentRoomId ?? 'Chưa tham gia'}</p>
      <p className="muted">Board mặc định: {JSON.stringify(getInitialBoard())}</p>
    </section>
  )
}

export default HomePage
