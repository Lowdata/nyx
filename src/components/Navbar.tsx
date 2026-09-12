'use client';

interface NavbarProps {
  walletAddress: string | null;
  onConnectWallet: () => void;
}

export default function Navbar({ walletAddress, onConnectWallet }: NavbarProps) {
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
        <a href="#lore">The myth</a>
        <a href="#meter">Dream meter</a>
        <a href="#rituals">Rituals</a>
      </div>

      <button
        type="button"
        className={`btn ${walletAddress ? 'btn-gold' : 'btn-ghost'}`}
        onClick={onConnectWallet}
        disabled={!!walletAddress}
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
            <span>{walletAddress}</span>
          </>
        ) : (
          'Connect wallet'
        )}
      </button>
    </nav>
  );
}
