'use client';

import { useState, useEffect } from 'react';

interface TweetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitTweet: (url: string) => Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string };
  isClaimed: boolean;
}

export default function TweetModal({
  isOpen,
  onClose,
  onSubmitTweet,
  isClaimed,
}: TweetModalProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await onSubmitTweet(url);
      if (res.success) {
        setSuccess(true);
        setError('');
      } else {
        setError(res.error || 'Submission failed');
      }
    } catch {
      setError('Failed to submit tweet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const alreadyClaimed = isClaimed || success;

  return (
    <div
      className={`modal-backdrop ${isOpen ? 'open' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tweet-modal-title"
    >
      <div className="modal-panel">
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close modal"
        >
          ✕
        </button>

        <h3 id="tweet-modal-title">Tweet about Nyx</h3>
        <p className="desc">
          Post about Nyx on X, then paste your post link below. Valid status links earn +50 wake points.
        </p>

        {!alreadyClaimed && (
          <div style={{ marginBottom: '16px' }}>
            <a
              href="https://twitter.com/intent/tweet?text=Awakening%20with%20%40enternyx%20%F0%9F%8C%99%20Enter%20the%20dream%20circle%20and%20claim%20your%20wake%20points%3A%20https%3A%2F%2Fnyx.town"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.88rem', padding: '10px 16px' }}
            >
              <span>𝕏</span> Open Pre-made Tweet on X ↗
            </a>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="tweet-url">
            Your Tweet status URL
          </label>
          <input
            id="tweet-url"
            className="field-input"
            type="url"
            placeholder="https://x.com/yourname/status/1234567890"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            disabled={alreadyClaimed}
            autoComplete="off"
            required
          />

          {error && <div className="field-error">{error}</div>}

          <button
            type="submit"
            className="btn btn-gold"
            style={{ width: '100%' }}
            disabled={alreadyClaimed || loading}
          >
            {loading
              ? 'Verifying prophecy...'
              : alreadyClaimed
              ? 'Tweet submitted'
              : 'Submit tweet (+50 wake points)'}
          </button>

          {alreadyClaimed && (
            <p className="field-success">Prophecy recorded: +50 wake points added.</p>
          )}
        </form>
      </div>
    </div>
  );
}
