'use client';

import { useEffect, useState } from 'react';

export default function IntegrationsCallbackPage() {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    // Notify the parent window immediately via postMessage
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          { type: 'PRISM_AUTH_COMPLETE', timestamp: Date.now() },
          window.location.origin
        );
      }
    } catch {
      // Ignored if cross-origin boundary prevents message
    }

    // Attempt automatic window closure after short visual confirmation
    const timer = setTimeout(() => {
      try {
        window.close();
        setClosed(true);
      } catch {
        setClosed(false);
      }
    }, 1400);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0B0D13',
        color: '#F4F4F5',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        padding: '24px',
        margin: 0,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          textAlign: 'center',
          backgroundColor: '#12151E',
          borderRadius: '16px',
          border: '1px solid #1E2330',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7)',
          padding: '40px 32px',
        }}
      >
        {/* Glowing Emerald Status Badge */}
        <div
          style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 20px',
            borderRadius: '50%',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 24px rgba(16, 185, 129, 0.25)',
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#10B981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1
          style={{
            fontSize: '19px',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: '0 0 8px',
            color: '#FFFFFF',
          }}
        >
          Prism Connected
        </h1>
        <p
          style={{
            fontSize: '13px',
            color: '#8E95A5',
            lineHeight: 1.5,
            margin: '0 0 24px',
          }}
        >
          Authorization was granted successfully. You can return to the Prism Operations Cockpit.
        </p>

        <button
          onClick={() => window.close()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 24px',
            fontSize: '13px',
            fontWeight: 500,
            borderRadius: '8px',
            backgroundColor: '#181B26',
            color: '#E4E4E7',
            border: '1px solid #272B38',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {closed ? 'Window Closing…' : 'Close Window'}
        </button>
      </div>
    </div>
  );
}
