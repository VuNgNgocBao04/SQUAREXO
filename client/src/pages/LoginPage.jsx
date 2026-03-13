import { useDispatch, useSelector } from 'react-redux'
import { useState } from 'react'
import { setAuth } from '../store/slices/authSlice'

function LoginPage() {
  const dispatch = useDispatch()
  const auth = useSelector((state) => state.auth)
  const [username, setUsername] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!username.trim()) return

    dispatch(
      setAuth({
        user: { username },
        token: 'dev-token',
      })
    )
  }

  return (
    <section className="panel">
      <h2>Login (Template)</h2>
      <form onSubmit={handleSubmit}>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Nhập username"
        />
        <button className="button" type="submit">
          Đăng nhập nhanh
        </button>
      </form>
      <p className="muted">User hiện tại: {auth.user?.username ?? 'N/A'}</p>
    </section>
  )
}

export default LoginPage
