import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <section className="panel">
      <h2>404 - Not Found</h2>
      <Link to="/">Quay về trang chủ</Link>
    </section>
  )
}

export default NotFoundPage
