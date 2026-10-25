import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react'
import { LogoMark } from '../components/LogoMark'

type AuthMode = 'login' | 'signup'

interface AuthPageProps {
  mode: AuthMode
}

function getSafeNextPath(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/encrypt'
}

export function AuthPage({ mode }: AuthPageProps) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const nextPath = getSafeNextPath(searchParams.get('next'))
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isSignup = mode === 'signup'
  const otherMode = isSignup ? 'login' : 'signup'
  const otherLabel = isSignup ? 'Sign in' : 'Create an account'
  const otherUrl = `/${otherMode}?next=${encodeURIComponent(nextPath)}`

  useEffect(() => {
    document.title = `${isSignup ? 'Create an account' : 'Sign in'} — SealBox`
  }, [isSignup])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/auth/session', { signal: controller.signal })
      .then((response) => response.json())
      .then((session: { authenticated?: boolean }) => {
        if (session.authenticated) navigate(nextPath, { replace: true })
      })
      .catch(() => {})
    return () => controller.abort()
  }, [navigate, nextPath])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') || '')
    if (isSignup && password !== String(form.get('confirmPassword') || '')) {
      setFormError('The passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/auth/${isSignup ? 'signup' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          password,
        }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Could not sign in. Please try again.')
      navigate(nextPath, { replace: true })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The authentication service is unavailable.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="sb-auth">
      <header className="sb-auth__topbar">
        <Link to="/" className="sb-brand" aria-label="SealBox home">
          <span className="sb-brand__mark" aria-hidden="true"><LogoMark size={22} /></span>
          SealBox
        </Link>
        <Link to="/" className="sb-auth__back"><ArrowLeft size={16} /> Back to home</Link>
      </header>

      <div className="sb-auth__layout">
        <section className="sb-auth__intro" aria-label="SealBox security">
          <div className="sb-auth__intro-content">
            <span className="sb-auth__eyebrow"><ShieldCheck size={15} /> PRIVATE FILE ENCRYPTION</span>
            <h1>Your files stay yours.</h1>
            <p>Encrypt files for the people who should be able to open them. Everything happens right here in your browser.</p>
            <ul className="sb-auth__benefits">
              <li><Check size={17} /> Plaintext never leaves your device</li>
              <li><Check size={17} /> Only the recipient’s private key can decrypt</li>
              <li><Check size={17} /> No account required to use SealBox</li>
            </ul>
          </div>
          <div className="sb-auth__security-note">
            <LockKeyhole size={18} />
            <span><strong>Local by design</strong><br />Your keys remain in this browser’s vault.</span>
          </div>
        </section>

        <section className="sb-auth__form-wrap">
          <div className="sb-auth__form-card">
            <div className="sb-auth__mobile-brand" aria-hidden="true"><LogoMark size={24} /></div>
            <p className="sb-eyebrow">{isSignup ? 'WELCOME TO SEALBOX' : 'WELCOME BACK'}</p>
            <h2>{isSignup ? 'Create your account' : 'Sign in to SealBox'}</h2>
            <p className="sb-auth__subtitle">
              {isSignup ? 'Set up an account to get started.' : 'Enter your details to continue to SealBox.'}
            </p>

            <form className="sb-auth__form" onSubmit={handleSubmit}>
              {isSignup ? (
                <label className="sb-field">
                  <span className="sb-field__label">Your name</span>
                  <input className="sb-input" name="name" type="text" autoComplete="name" placeholder="Alex Morgan" required />
                </label>
              ) : null}
              <label className="sb-field">
                <span className="sb-field__label">Email address</span>
                <input className="sb-input" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
              </label>
              <label className="sb-field">
                <span className="sb-field__label">Password</span>
                <span className="sb-auth__password-wrap">
                  <input className="sb-input" name="password" type={showPassword ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder="At least 8 characters" minLength={8} required />
                  <button className="sb-auth__password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
              {isSignup ? (
                <>
                  <label className="sb-field">
                    <span className="sb-field__label">Confirm password</span>
                    <input className="sb-input" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Enter your password again" minLength={8} required />
                  </label>
                  <label className="sb-auth__consent">
                    <input type="checkbox" required />
                    <span>I understand that SealBox keeps encryption keys in this browser and cannot recover a lost private key.</span>
                  </label>
                </>
              ) : (
                <div className="sb-auth__form-meta"><span>Keep your private keys safe.</span><span>Local-first encryption</span></div>
              )}
              {formError ? <p className="sb-auth__notice" data-error="true" role="alert">{formError}</p> : null}
              <button className="sb-btn sb-btn--primary sb-btn--block sb-btn--lg" type="submit" disabled={submitting}>
                {submitting ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'} {!submitting && <ArrowRight size={17} />}
              </button>
            </form>

            <p className="sb-auth__switch">
              {isSignup ? 'Already have an account?' : 'New to SealBox?'} <Link to={otherUrl}>{otherLabel}</Link>
            </p>
            <div className="sb-auth__local-callout">
              <ShieldCheck size={18} />
              <p><strong>Stored locally, by design</strong><br />Account records and password hashes use SQLite on this computer. Encryption keys stay in your browser and are never sent to the account service.</p>
            </div>
            <Link className="sb-auth__continue" to={nextPath}>Continue without an account <ArrowRight size={16} /></Link>
          </div>
        </section>
      </div>
    </main>
  )
}
