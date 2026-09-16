'use client';

import { useState, useEffect, useRef } from 'react';

interface NavbarProps {
  walletAddress: string | null;
  isConnecting?: boolean;
  onConnectWallet: () => void;
  onDisconnectWallet?: () => void;
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

export default function Navbar({
  walletAddress,
  isConnecting,
  onConnectWallet,
  onDisconnectWallet,
}: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback
    }
  };

  const handleDisconnect = () => {
    setMenuOpen(false);
    setCopied(false);
    if (onDisconnectWallet) {
      onDisconnectWallet();
    }
  };

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
          href="https://x.com/enternyx"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-twitter-btn"
          aria-label="Follow @enternyx on X"
          title="Follow @enternyx on X"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>

        {/* Leaderboard (Coming Soon) */}
        <div className="nav-leaderboard-wrapper">
          <button
            type="button"
            className="nav-leaderboard-btn"
            disabled
            aria-disabled="true"
            aria-label="Leaderboard (Coming soon)"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
              <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-2.34" />
              <path d="M18 14.66V17c0 .55-.45 1-1 1h-2c-.55 0-1-.45-1-1v-2.34" />
              <path d="M6 2v7a6 6 0 0 0 12 0V2H6z" />
            </svg>
            <span className="nav-leaderboard-text">Leaderboard</span>
            <span className="nav-soon-pill">Soon</span>
          </button>
          <div className="nav-tooltip" role="tooltip">
            Leaderboard coming soon
          </div>
        </div>

        {/* Wallet Connection & Disconnect Dropdown */}
        <div className="nav-wallet-wrapper" ref={menuRef}>
          {walletAddress ? (
            <>
              <button
                type="button"
                className="btn btn-gold nav-wallet-btn"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-expanded={menuOpen}
                aria-haspopup="true"
                id="nav-connect"
                title="Wallet menu (Click to disconnect or copy address)"
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    boxShadow: '0 0 8px #10b981',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span>{formatAddress(walletAddress)}</span>
                <span className={`nav-wallet-chevron ${menuOpen ? 'open' : ''}`} aria-hidden="true">
                  ▾
                </span>
              </button>

              {/* Dropdown Menu */}
              {menuOpen && (
                <div className="nav-wallet-dropdown" role="menu" aria-label="Wallet options">
                  <div className="nav-wallet-header">
                    <div className="nav-wallet-status">
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: '#10b981',
                          display: 'inline-block',
                        }}
                      />
                      <span>Connected</span>
                    </div>
                    <div className="nav-wallet-addr-row">
                      <span className="nav-wallet-addr-text" title={walletAddress}>
                        {formatAddress(walletAddress)}
                      </span>
                      <button
                        type="button"
                        className="nav-wallet-copy-btn"
                        onClick={handleCopyAddress}
                        title="Copy full wallet address"
                      >
                        {copied ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div className="nav-wallet-divider" />

                  <button
                    type="button"
                    className="nav-wallet-disconnect-btn"
                    onClick={handleDisconnect}
                    role="menuitem"
                    id="nav-disconnect-btn"
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Disconnect wallet</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onConnectWallet}
              disabled={isConnecting}
              id="nav-connect"
            >
              {isConnecting ? (
                <>
                  <span className="live-dot" />
                  <span>Signing...</span>
                </>
              ) : (
                'Connect wallet'
              )}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
