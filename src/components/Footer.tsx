import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="sb-footer">
      <div className="sb-container sb-footer__inner">
        <div>
          <p className="sb-footer__title">SealBox — Encrypted File Transfer</p>
          <p className="sb-muted sb-text-sm" style={{ maxWidth: '42ch' }}>
            Encrypt files in your browser for a recipient&apos;s public key, then share the
            encrypted package. Decryption requires the matching private key.
          </p>
        </div>

        <nav aria-label="Product">
          <p className="sb-footer__title">Product</p>
          <div className="sb-footer__links">
            <Link to="/encrypt">Encrypt file</Link>
            <Link to="/decrypt">Decrypt file</Link>
            <Link to="/keys">Key management</Link>
          </div>
        </nav>

        <nav aria-label="Security">
          <p className="sb-footer__title">Security</p>
          <div className="sb-footer__links">
            <Link to="/#how-it-works">How encryption works</Link>
            <Link to="/#security">Security model</Link>
            <Link to="/keys">Manage your keys</Link>
          </div>
        </nav>
      </div>
      <div className="sb-footer__bottom">
        <div className="sb-container">
          <p>
            Files and keys are processed locally in your browser. Losing your private key means
            encrypted files cannot be recovered.
          </p>
        </div>
      </div>
    </footer>
  )
}
