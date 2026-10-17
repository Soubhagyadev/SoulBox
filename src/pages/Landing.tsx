import { Link } from 'react-router-dom'
import { FileLock2, KeyRound, Share2, ShieldCheck, Info } from 'lucide-react'
import { Card } from '../components/Card'

const STEPS = [
  {
    title: 'Choose a file and a recipient key',
    text: 'Select the file you want to protect and the public key of the person who should be able to open it.',
  },
  {
    title: 'Encrypt in your browser',
    text: 'The file is encrypted with a one-time key that only the recipient’s private key can unlock.',
  },
  {
    title: 'Share the encrypted package',
    text: 'Download the .sealbox package and send it through any channel. Only the matching private key can decrypt it.',
  },
]

const FACTS = [
  {
    icon: ShieldCheck,
    text: 'Encryption runs entirely in your browser using the Web Crypto API. The plaintext file is never uploaded.',
  },
  {
    icon: KeyRound,
    text: 'A public key can be shared freely. The private key must stay secret — it is the only way to decrypt files addressed to you.',
  },
  {
    icon: Info,
    text: 'The package contains visible metadata such as the original file name, size, and the recipient key fingerprint. File contents stay encrypted.',
  },
  {
    icon: Share2,
    text: 'Encryption protects confidentiality. It does not prove who sent a file, and it cannot replace a digital signature.',
  },
]

export function Landing() {
  return (
    <>
      <section className="sb-hero">
        <div className="sb-container sb-hero__inner">
          <div>
            <h1 className="sb-hero__title">Send files securely.</h1>
            <p className="sb-hero__copy">
              SealBox encrypts a file for a specific recipient using their public key. The recipient
              decrypts it with their private key — no accounts, and no plaintext leaving your
              device.
            </p>
            <div className="sb-hero__actions">
              <Link to="/encrypt" className="sb-btn sb-btn--primary sb-btn--lg">
                Encrypt a file
              </Link>
              <Link to="/decrypt" className="sb-btn sb-btn--secondary sb-btn--lg">
                Decrypt a file
              </Link>
            </div>
            <p className="sb-hero__note">
              Encryption happens locally in this browser before you download the package.
            </p>
          </div>

          <Card className="sb-hero__panel" aria-label="Encrypted package preview">
            <div className="sb-cluster" style={{ justifyContent: 'space-between' }}>
              <p className="sb-eyebrow">Encrypted package</p>
              <span className="sb-badge sb-badge--pair">.sealbox</span>
            </div>

            <div className="sb-preview__file" style={{ marginTop: 'var(--space-4)' }}>
              <span className="sb-preview__icon" aria-hidden="true">
                <FileLock2 size={20} strokeWidth={1.9} />
              </span>
              <div>
                <p className="sb-card-title" style={{ fontSize: 'var(--text-base)' }}>
                  quarterly-report.pdf
                </p>
                <p className="sb-muted sb-text-xs">2.4 MB · encrypted in this browser</p>
              </div>
            </div>

            <dl className="sb-preview__meta">
              <div className="sb-preview__row">
                <dt>Recipient fingerprint</dt>
                <dd>9C:41:6D:2E:88:B0…A3</dd>
              </div>
              <div className="sb-preview__row">
                <dt>File encryption</dt>
                <dd>AES-256-GCM</dd>
              </div>
              <div className="sb-preview__row">
                <dt>Key wrapping</dt>
                <dd>RSA-OAEP · SHA-256</dd>
              </div>
            </dl>

            <p className="sb-muted sb-text-xs" style={{ marginTop: 'var(--space-4)' }}>
              Metadata stays visible so the recipient knows what they received. The contents stay
              sealed until the matching private key opens them.
            </p>
          </Card>
        </div>
      </section>

      <section className="sb-section" id="how-it-works">
        <div className="sb-container">
          <h2 className="sb-section-title">How it works</h2>
          <p className="sb-lead" style={{ marginTop: 'var(--space-2)' }}>
            Three steps from a plain file to an encrypted package.
          </p>
          <div className="sb-steps" style={{ marginTop: 'var(--space-8)' }}>
            {STEPS.map((step, index) => (
              <article className="sb-step" key={step.title}>
                <span className="sb-step__index" aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="sb-step__title">{step.title}</h3>
                <p className="sb-step__text">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sb-section" id="security">
        <div className="sb-container sb-security-grid">
          <div>
            <h2 className="sb-section-title">What SealBox does — and does not do</h2>
            <div className="sb-prose sb-muted" style={{ marginTop: 'var(--space-4)' }}>
              <p>
                SealBox uses hybrid encryption. A random AES-256-GCM key encrypts the file, and the
                recipient’s RSA public key wraps that key. Only someone holding the matching
                private key can unwrap the file key and decrypt the contents.
              </p>
              <p>
                This is encryption for a recipient, not a digital signature. It protects the
                contents from being read, but it does not confirm who created the file. Verify key
                fingerprints through a trusted channel when that matters.
              </p>
              <p>
                If a private key is lost, files encrypted to it cannot be recovered — there is no
                recovery service or password reset.
              </p>
            </div>
          </div>

          <Card>
            <h3 className="sb-card-title" style={{ marginBottom: 'var(--space-4)' }}>
              Plain facts
            </h3>
            <ul className="sb-fact-list" role="list">
              {FACTS.map((fact) => {
                const Icon = fact.icon
                return (
                  <li className="sb-fact" key={fact.text}>
                    <span className="sb-fact__icon" aria-hidden="true">
                      <Icon size={20} strokeWidth={1.9} />
                    </span>
                    <p className="sb-text-sm sb-muted">{fact.text}</p>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      </section>

      <section className="sb-section">
        <div className="sb-container">
          <Card>
            <div className="sb-cluster" style={{ justifyContent: 'space-between' }}>
              <div>
                <h2 className="sb-section-title">Ready to encrypt a file?</h2>
                <p className="sb-muted" style={{ marginTop: 'var(--space-2)' }}>
                  Create or import a recipient’s public key, then encrypt your first file.
                </p>
              </div>
              <div className="sb-actions">
                <Link to="/keys" className="sb-btn sb-btn--secondary sb-btn--lg">
                  Manage keys
                </Link>
                <Link to="/encrypt" className="sb-btn sb-btn--primary sb-btn--lg">
                  <FileLock2 size={18} aria-hidden="true" />
                  Encrypt a file
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </>
  )
}
