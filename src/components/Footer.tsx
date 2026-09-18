'use client';

export default function Footer() {
  return (
    <footer aria-label="Page footer">
      <div className="wrap foot-row">
        <span>© 2026 Nyx. All dreams reserved.</span>
        <div className="foot-links">
          <a
            href="https://x.com/enternyx"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit @enternyx on X"
          >
            X (@enternyx)
          </a>
          <a href="#lore">The myth</a>
        </div>
      </div>
    </footer>
  );
}
