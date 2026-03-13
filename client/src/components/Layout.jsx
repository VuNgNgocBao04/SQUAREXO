import { Link, Outlet } from 'react-router-dom'

function Layout() {
  return (
    <main className="app-layout">
      <header className="app-header panel">
        <h1>SQUAREXO</h1>
        <nav>
          <Link to="/">Home</Link> | <Link to="/login">Login</Link>
        </nav>
      </header>
      <Outlet />
    </main>
  )
}

export default Layout
