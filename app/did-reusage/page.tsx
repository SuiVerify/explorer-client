'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SettlementRecord, fetchExplorerDIDReusage } from '../lib/api';

// Mock data removed - using real API data only

// Format address to show first 6 and last 4 characters
const formatAddress = (address: string) => {
  if (!address) return '';
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Copy to clipboard function
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

export default function DidReusagePage() {
  const router = useRouter();
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReusage() {
      try {
        setLoading(true);
        const rows = await fetchExplorerDIDReusage(100);
        // Adapt verification-backend reusage shape to legacy SettlementRecord
        // shape so existing table render works without rewrite.
        const adapted: SettlementRecord[] = rows.map((r, i) => ({
          id: i,
          enclave_tx_digest: '',
          did_verified_id: r.nft_id,
          did_nft_name: null,
          protocol_uid: 0,
          protocol_name: r.partner_name ?? r.client_id,
          protocol_address: null,
          user_address: r.user_wallet,
          payment_tx_digest: '',
          settlement_amount: 0,
          timestamp: Date.parse(r.completed_at),
          created_at: r.completed_at,
          status: 'completed',
        }));
        setSettlements(adapted);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch reusage:', err);
        setError('Failed to load DID reusage data');
        setSettlements([]);
      } finally {
        setLoading(false);
      }
    }
    loadReusage();
  }, []);

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
      <header className="relative z-50 bg-white/90 backdrop-blur-md border-b border-secondary/20 sticky top-0 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/95 backdrop-blur-sm border-[3px] border-secondary/30 rounded-xl text-charcoal-text hover:text-secondary font-bold text-sm transition-all shadow-[0.1em_0.1em] hover:shadow-[0.15em_0.15em] hover:-translate-x-[0.05em] hover:-translate-y-[0.05em]"
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
          <h1 className="text-4xl font-bold text-charcoal-text mb-2">DID Reusage</h1>
          {!loading && !error && <p className="text-sm text-charcoal-text/70">Showing all {settlements.length} results</p>}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border-[3px] border-secondary/30 shadow-[0.1em_0.1em] p-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin"></div>
              </div>
              <p className="text-lg font-semibold text-charcoal-text">Loading settlement data...</p>
              <p className="text-sm text-charcoal-text/60">Please wait while we fetch DID reusage records</p>
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
                <h2 className="text-2xl font-bold text-charcoal-text mb-2">Failed to Load Settlements</h2>
                <p className="text-sm text-charcoal-text/70 mb-1">{error}</p>
                <p className="text-xs text-charcoal-text/50">Please check if the settlement API is running on http://localhost:3001</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-secondary hover:bg-secondary-dark text-white rounded-xl font-bold transition-all shadow-[0.1em_0.1em] hover:shadow-[0.15em_0.15em] hover:-translate-x-[0.05em] hover:-translate-y-[0.05em] border-[3px] border-secondary/30"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && settlements.length === 0 && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border-[3px] border-secondary/30 shadow-[0.1em_0.1em] p-12">
            <div className="flex flex-col items-center justify-center gap-6">
              <div className="p-4 rounded-full bg-secondary/10">
                <svg className="w-16 h-16 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-charcoal-text mb-2">No DID Reusage Records</h2>
                <p className="text-sm text-charcoal-text/70">There are currently no settlement records in the database.</p>
                <p className="text-xs text-charcoal-text/50 mt-1">Records will appear here when users reuse their DIDs with protocols.</p>
              </div>
            </div>
          </div>
        )}

        {/* Full Data Table - Only shown when data exists */}
        {!loading && !error && settlements.length > 0 && (
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl border-[3px] border-secondary/30 shadow-[0.1em_0.1em]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-secondary/5 border-b-2 border-secondary/20">
                  <th className="text-left py-4 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">DID Verified ID (NFT)</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">Protocol Involved</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">User Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary/10">
                {settlements.map((settlement) => (
                  <tr key={settlement.id} className="hover:bg-secondary/5 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-primary hover:text-primary-dark cursor-pointer font-semibold">
                          {formatAddress(settlement.did_verified_id)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(settlement.did_verified_id)}
                          className="text-charcoal-text/40 hover:text-secondary transition-colors"
                          title="Copy DID NFT"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary/15 text-secondary border border-secondary/30">
                        {settlement.protocol_name}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-primary hover:text-primary-dark cursor-pointer font-semibold">
                          {formatAddress(settlement.user_address)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(settlement.user_address)}
                          className="text-charcoal-text/40 hover:text-secondary transition-colors"
                          title="Copy User Address"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
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
