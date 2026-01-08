import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = location.state?.from?.pathname || '/'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(username, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page bg-body-secondary d-flex align-items-center justify-content-center min-vh-100">
      <div className="login-box" style={{ width: '400px' }}>
        
        {/* Corporate Header */}
        <div className="card shadow-lg border-0">
          <div className="card-header bg-primary text-white text-center py-4 border-0">
            <h3 className="mb-1 fw-bold">
              <i className="bi bi-shield-lock me-2"></i>
              AdminLTE
            </h3>
            <small className="opacity-75">Enterprise Management System</small>
          </div>

          <div className="card-body p-4">
            <p className="text-muted text-center mb-4">Sign in to your account</p>

            {error && (
              <div className="alert alert-danger alert-dismissible py-2">
                <button type="button" className="btn-close" onClick={() => setError('')}></button>
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label small text-muted">Username or Email</label>
                <div className="input-group">
                  <span className="input-group-text bg-light">
                    <i className="bi bi-person"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small text-muted">Password</label>
                <div className="input-group">
                  <span className="input-group-text bg-light">
                    <i className="bi bi-lock"></i>
                  </span>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center mb-4">
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" id="remember" />
                  <label className="form-check-label small" htmlFor="remember">
                    Remember me
                  </label>
                </div>
                <a href="#" className="small text-decoration-none" onClick={(e) => e.preventDefault()}>
                  Forgot password?
                </a>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary w-100 py-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Signing in...
                  </>
                ) : (
                  <>
                    <i className="bi bi-box-arrow-in-right me-2"></i>
                    Sign In
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="card-footer bg-light text-center py-3 border-0">
            <small className="text-muted">
              <i className="bi bi-lock-fill me-1"></i>
              Secure connection · © {new Date().getFullYear()} Your Company
            </small>
          </div>
        </div>

      </div>
    </div>
  )
}

export default Login