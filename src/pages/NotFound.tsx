import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'

export function NotFound() {
  return (
    <div className="sb-container sb-notfound">
      <EmptyState
        title="Page not found"
        action={
          <div className="sb-cluster" style={{ justifyContent: 'center' }}>
            <Link to="/" className="sb-btn sb-btn--secondary">
              Back to home
            </Link>
            <Link to="/encrypt" className="sb-btn sb-btn--primary">
              Encrypt a file
            </Link>
          </div>
        }
      >
        The page you were looking for does not exist.
      </EmptyState>
    </div>
  )
}
