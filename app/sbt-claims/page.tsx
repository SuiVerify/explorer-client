'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DIDClaimEvent, fetchExplorerSBTClaims } from '../lib/api';

// Format address to show first 6 and last 4 characters
const formatAddress = (address: string) => {
  if (!address) return '';
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Map DID Type to readable label
const getDIDTypeLabel = (type: number | string) => {
  const typeNum = Number(type);
  switch (typeNum) {
    case 1:
      return 'Age Verify';
    case 2:
      return 'Citizenship Verify';
    default:
      return `Type ${type}`;
  }
};

// Format timestamp to readable date
const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Copy to clipboard function
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

export default function SbtClaimsPage() {
  const router = useRouter();
  const [claims, setClaims] = useState<DIDClaimEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvents() {
      try {
        setLoading(true);
        const rows = await fetchExplorerSBTClaims(100);
        // Adapt verification-backend shape to legacy DIDClaimEvent shape so
        // the existing table render keeps working without a rewrite.
        const adapted: DIDClaimEvent[] = rows.map((r, i) => ({
          id: i,
          registry_id: '',
          user_address: r.user_address,
          did_type: r.did_type,
          user_did_id: '',
          nft_id: r.nft_id ?? '',
          checkpoint_sequence_number: 0,
          transaction_digest: r.transaction_hash,
          timestamp_ms: Date.parse(r.created_at),
          event_index: 0,
        }));
        setClaims(adapted);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch sbt claims:', err);
        setError('Failed to load claims from verification backend');
        setClaims([]);
      } finally {
        setLoading(false);
      }
    }

    loadEvents();
  }, []);

  // Only show database data, no fallback to mock data
  const displayClaims = claims || [];

  return (
    <div className="w-full bg-ghost-white outfit min-h-screen relative overflow-hidden">
      {/* Blob Animations Background */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* Subtle gradient overlay for depth */}
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none"></div>

      {/* Subtle pattern overlay */}
      <div
        className="fixed inset-0 z-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, var(--color-primary) 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      ></div>

      {/* Professional Header with SuiVerify Theme */}
      <header className="relative z-50 bg-white/90 backdrop-blur-md border-b border-primary/20 sticky top-0 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/95 backdrop-blur-sm border-[3px] border-primary/30 rounded-xl text-charcoal-text hover:text-primary font-bold text-sm transition-all shadow-[0.1em_0.1em] hover:shadow-[0.15em_0.15em] hover:-translate-x-[0.05em] hover:-translate-y-[0.05em]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Go Back</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-[1920px] mx-auto px-6 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-charcoal-text mb-2">SBT Claims</h1>
          {!loading && !error && <p className="text-sm text-charcoal-text/70">Showing all {displayClaims.length} results</p>}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border-[3px] border-primary/30 shadow-[0.1em_0.1em] p-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
              </div>
              <p className="text-lg font-semibold text-charcoal-text">Loading events from database...</p>
              <p className="text-sm text-charcoal-text/60">Please wait while we fetch the latest SBT claims</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border-[3px] border-red-500/30 shadow-[0.1em_0.1em] p-12">
            <div className="flex flex-col items-center justify-center gap-6">
              <div className="p-4 rounded-full bg-red-500/10">
                <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-charcoal-text mb-2">Failed to Load Events</h2>
                <p className="text-sm text-charcoal-text/70 mb-1">{error}</p>
                <p className="text-xs text-charcoal-text/50">Please check if the backend API is running on http://127.0.0.1:8080</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold transition-all shadow-[0.1em_0.1em] hover:shadow-[0.15em_0.15em] hover:-translate-x-[0.05em] hover:-translate-y-[0.05em] border-[3px] border-primary/30"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && displayClaims.length === 0 && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border-[3px] border-primary/30 shadow-[0.1em_0.1em] p-12">
            <div className="flex flex-col items-center justify-center gap-6">
              <div className="p-4 rounded-full bg-primary/10">
                <svg className="w-16 h-16 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-charcoal-text mb-2">No SBT Claims Found</h2>
                <p className="text-sm text-charcoal-text/70">There are currently no DID claims in the database.</p>
                <p className="text-xs text-charcoal-text/50 mt-1">Claims will appear here as users mint their DID NFTs.</p>
              </div>
            </div>
          </div>
        )}

        {/* Full Data Table - Only shown when data exists */}
        {!loading && !error && displayClaims.length > 0 && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border-[3px] border-primary/30 shadow-[0.1em_0.1em]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-primary/5 border-b-2 border-primary/20">
                    <th className="text-left py-4 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">ID</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">Registry ID</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">User Address</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">DID Type</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">NFT ID</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">Checkpoint</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">Transaction</th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {displayClaims.map((claim, index) => (
                    <tr key={claim.transaction_digest} className="hover:bg-primary/5 transition-colors">
                      <td className="py-4 px-6">
                        <span className="text-sm font-bold text-charcoal-text">{index + 1}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-primary hover:text-primary-dark cursor-pointer font-semibold">
                            {formatAddress(claim.registry_id)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(claim.registry_id)}
                            className="text-charcoal-text/40 hover:text-primary transition-colors"
                            title="Copy Registry ID"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-primary hover:text-primary-dark cursor-pointer font-semibold">
                            {formatAddress(claim.user_address)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(claim.user_address)}
                            className="text-charcoal-text/40 hover:text-primary transition-colors"
                            title="Copy User Address"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/15 text-primary border border-primary/30">
                          {getDIDTypeLabel(claim.did_type)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-charcoal-text font-medium">
                            {formatAddress(claim.nft_id)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(claim.nft_id)}
                            className="text-charcoal-text/40 hover:text-primary transition-colors"
                            title="Copy NFT ID"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-charcoal-text font-medium">{claim.checkpoint_sequence_number}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-primary hover:text-primary-dark cursor-pointer font-semibold">
                            {formatAddress(claim.transaction_digest)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(claim.transaction_digest)}
                            className="text-charcoal-text/40 hover:text-primary transition-colors"
                            title="Copy Transaction"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-charcoal-text/70">{formatDate(claim.timestamp_ms)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
