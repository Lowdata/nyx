'use client';

interface NavbarProps {
  walletAddress: string | null;
  isConnecting?: boolean;
  onConnectWallet: () => void;
}

export function formatAddress(addr: string): string {
  if (!addr) return '';
  if (addr.startsWith('0xdemo_')) {
    return `0xdemo...${addr.slice(-4)}`;
  }
  if (addr.length > 12) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }
  return addr;
}

export default function Navbar({ walletAddress, isConnecting, onConnectWallet }: NavbarProps) {
  return (
    <nav className="nav" aria-label="Main Navigation">
      <a href="#top" className="nav-brand">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z"
            fill="#f0d9a0"
          />
        </svg>
        <span>Nyx</span>
      </a>

      <div className="nav-links">
        <a href="#meter">Dream meter</a>
        <a href="#referrals">Referrals</a>
        <a href="#rituals">Rituals</a>
        <a href="#lore">The myth</a>
        <a href="#awaken">Mint</a>
      </div>

      <div className="nav-actions">
        <a
          href="https://twitter.com/intent/tweet?text=Nyx%20is%20dreaming...%20Wake%20the%20God%20of%20Sleep%20%F0%9F%8C%99"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-twitter-btn"
          aria-label="Share or follow on Twitter"
        >
          twitter
        </a>

        <button
          type="button"
          className={`btn ${walletAddress ? 'btn-gold' : 'btn-ghost'}`}
          onClick={onConnectWallet}
          disabled={!!walletAddress || isConnecting}
          id="nav-connect"
        >
          {walletAddress ? (
            <>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  boxShadow: '0 0 8px #10b981',
                  display: 'inline-block',
                }}
              />
              <span>{formatAddress(walletAddress)}</span>
            </>
          ) : isConnecting ? (
            <>
              <span className="live-dot" />
              <span>Signing...</span>
            </>
          ) : (
            'Connect wallet'
          )}
        </button>
      </div>
    </nav>
  );
}
