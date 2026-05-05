'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  fetchDIDEvents, DIDClaimEvent,
  fetchSettlements, SettlementRecord,
  fetchExplorerStats, fetchDIDTimeseries, fetchReuseTimeseries,
  fetchExplorerSBTClaims, fetchExplorerDIDReusage,
  ExplorerStats, ExplorerTimePoint,
} from './lib/api';

// Helper function to process DID events into chart data
const processDIDEventsByDate = (events: DIDClaimEvent[]) => {
  if (!events || events.length === 0) return [];

  // Group events by date
  const dateMap = new Map<string, number>();

  events.forEach(event => {
    const date = new Date(event.timestamp_ms);
    const dateKey = `${date.getMonth() + 1}/${date.getDate()}`;
    dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
  });

  // Convert to array and sort by date
  const sortedEntries = Array.from(dateMap.entries())
    .sort((a, b) => {
      const [aMonth, aDay] = a[0].split('/').map(Number);
      const [bMonth, bDay] = b[0].split('/').map(Number);
      return (aMonth * 100 + aDay) - (bMonth * 100 + bDay);
    });

  // Calculate cumulative totals
  let cumulative = 0;
  return sortedEntries.map(([date, count]) => {
    cumulative += count;
    return { date, value: cumulative };
  });
};

// Helper function to process settlements into reusage chart data
const processSettlementsByDate = (settlements: SettlementRecord[]) => {
  if (!settlements || settlements.length === 0) {
    console.log('No settlements to process');
    return [];
  }

  console.log('Processing settlements:', settlements);

  // Group settlements by date
  const dateMap = new Map<string, number>();

  settlements.forEach(settlement => {
    console.log('Settlement timestamp:', settlement.timestamp, typeof settlement.timestamp);

    // Convert string timestamp to number first
    const timestamp = typeof settlement.timestamp === 'string'
      ? parseInt(settlement.timestamp, 10)
      : settlement.timestamp;

    // Convert timestamp to milliseconds if it's in seconds (timestamp < 10000000000 means seconds)
    const timestampMs = timestamp < 10000000000
      ? timestamp * 1000
      : timestamp;

    const date = new Date(timestampMs);

    console.log('Parsed date:', date, 'isValid:', !isNaN(date.getTime()));

    // Skip invalid dates
    if (isNaN(date.getTime())) {
      console.log('Skipping invalid date');
      return;
    }

    const dateKey = `${date.getMonth() + 1}/${date.getDate()}`;
    console.log('Date key:', dateKey);
    dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
  });

  console.log('Date map:', Array.from(dateMap.entries()));

  // Convert to array and sort by date
  const sortedEntries = Array.from(dateMap.entries())
    .sort((a, b) => {
      const [aMonth, aDay] = a[0].split('/').map(Number);
      const [bMonth, bDay] = b[0].split('/').map(Number);
      return (aMonth * 100 + aDay) - (bMonth * 100 + bDay);
    });

  // Calculate cumulative totals
  let cumulative = 0;
  const result = sortedEntries.map(([date, count]) => {
    cumulative += count;
    return { date, value: cumulative };
  });

  // If we only have one data point, add a starting point to make the chart render properly
  if (result.length === 1) {
    // Get the date and create a previous date label
    const [month, day] = result[0].date.split('/').map(Number);
    const prevDay = day - 1 > 0 ? day - 1 : 1;
    result.unshift({ date: `${month}/${prevDay}`, value: 0 });
  }

  console.log('Processed settlement data:', result);
  return result;
};

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

// Format timestamp to relative time (e.g., "3 secs ago")
const formatTimeAgo = (timestamp: number) => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds} secs ago`;
  if (minutes < 60) return `${minutes} mins ago`;
  if (hours < 24) return `${hours} hrs ago`;
  return `${days} days ago`;
};

// Copy to clipboard function
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

// Custom tooltip for charts
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm border-[3px] border-primary/30 rounded-xl p-3 shadow-[0.1em_0.1em]">
        <p className="text-sm font-bold text-charcoal-text">{`${payload[0].value.toLocaleString()}`}</p>
      </div>
    );
  }
  return null;
};

export default function ExplorerPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [sbtClaims, setSbtClaims] = useState<DIDClaimEvent[]>([]);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [allEvents, setAllEvents] = useState<DIDClaimEvent[]>([]);
  const [allSettlements, setAllSettlements] = useState<SettlementRecord[]>([]);
  const [stats, setStats] = useState<ExplorerStats | null>(null);
  const [didTimeseries, setDidTimeseries] = useState<ExplorerTimePoint[]>([]);
  const [reuseTimeseries, setReuseTimeseries] = useState<ExplorerTimePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      // Recent rows come from verification-backend now (was did-explorer +
      // settlement API). Adapt to legacy types so table render is unchanged.
      try {
        const recentClaims = await fetchExplorerSBTClaims(4);
        const adapted: DIDClaimEvent[] = recentClaims.map((r, i) => ({
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
        setSbtClaims(adapted);
        setAllEvents(adapted);
      } catch (err) {
        console.error('Failed to fetch sbt claims:', err);
        setSbtClaims([]);
        setAllEvents([]);
      }

      try {
        const reuseRows = await fetchExplorerDIDReusage(4);
        const adaptedSettlements: SettlementRecord[] = reuseRows.map((r, i) => ({
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
        setSettlements(adaptedSettlements);
        setAllSettlements(adaptedSettlements);
      } catch (err) {
        console.error('Failed to fetch did reusage:', err);
        setSettlements([]);
        setAllSettlements([]);
      }

      // Aggregate stats from verification-backend (Postgres source of truth).
      // Independent of did-explorer event reads above so failure here does
      // not block the activity feed and vice versa.
      try {
        const [s, dts, rts] = await Promise.all([
          fetchExplorerStats(),
          fetchDIDTimeseries(30),
          fetchReuseTimeseries(30),
        ]);
        setStats(s);
        setDidTimeseries(dts);
        setReuseTimeseries(rts);
      } catch (err) {
        console.error('Failed to fetch explorer stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Charts: prefer verification-backend timeseries when available, fall back
  // to did-explorer event aggregation if the backend stats call failed.
  const didIssuedData = didTimeseries.length > 0
    ? didTimeseries.map(p => ({ date: p.date, value: p.count }))
    : processDIDEventsByDate(allEvents);
  const didReusedData = reuseTimeseries.length > 0
    ? reuseTimeseries.map(p => ({ date: p.date, value: p.count }))
    : processSettlementsByDate(allSettlements);

  // Stats: prefer backend aggregates, fall back to derived counts.
  const totalDIDIssued = stats?.total_dids_issued ?? allEvents.length;
  const totalReused = stats?.total_dids_reused ?? allSettlements.length;
  const uniqueUsers = stats?.total_users ?? new Set(allEvents.map(e => e.user_address)).size;
  const protocolsIntegrated = stats?.protocols_integrated ?? 0;
  const avgDailyReusage = didReusedData.length > 0
    ? Math.round(totalReused / didReusedData.length)
    : 0;

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
      <header className="relative z-50 bg-transparent backdrop-blur-md shadow-md top-0 ">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-6">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0">
              <Image
                src="/head_logo.png"
                alt="SuiVerify Explorer"
                width={140}
                height={45}
                className="h-10 w-auto"
                priority
              />
            </div>

            {/* Search Bar - Prominent and Professional */}
            <div className="flex-1 max-w-2xl mx-8">
              <input
                type="text"
                placeholder="Search by Txn Hash / Block / Address / DID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-white/95 backdrop-blur-sm border-[3px] border-primary/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm text-charcoal-text placeholder-charcoal-text/40 transition-all shadow-[0.1em_0.1em]"
              />
            </div>

            {/* Network/Info Section */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right">
                <div className="text-xs text-charcoal-text/60 uppercase tracking-wide font-semibold">Network</div>
                <div className="text-sm font-bold text-charcoal-text">Mainnet</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-[1920px] mx-auto px-6 py-8">
        {/* Stats Cards - Professional Design with SuiVerify Theme */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          {/* DID Issued */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border-[3px] border-primary/30 p-6 shadow-[0.1em_0.1em] hover:shadow-[0.15em_0.15em] transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/15">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-charcoal-text/60 uppercase tracking-wider">DID Issued</p>
                </div>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-charcoal-text">{totalDIDIssued.toLocaleString()}</p>
              {didIssuedData.length > 1 && (
                <span className="text-xs font-medium text-success">+{didIssuedData[didIssuedData.length - 1].value - didIssuedData[0].value}</span>
              )}
            </div>
            <p className="text-xs text-charcoal-text/60 mt-1">total claims recorded</p>
          </div>

          {/* Total Users */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border-[3px] border-secondary/30 p-6 shadow-[0.1em_0.1em] hover:shadow-[0.15em_0.15em] transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-secondary/15">
                  <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-charcoal-text/60 uppercase tracking-wider">Total Users</p>
                </div>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-charcoal-text">{uniqueUsers.toLocaleString()}</p>
              {uniqueUsers > 0 && (
                <span className="text-xs font-medium text-charcoal-text/60">unique</span>
              )}
            </div>
            <p className="text-xs text-charcoal-text/60 mt-1">verified addresses</p>
          </div>

          {/* Protocols Integrated */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border-[3px] border-warning/30 p-6 shadow-[0.1em_0.1em] hover:shadow-[0.15em_0.15em] transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-warning/15">
                  <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-charcoal-text/60 uppercase tracking-wider">Protocols Integrated</p>
                </div>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-charcoal-text">{protocolsIntegrated}</p>
              <span className="text-xs font-medium text-charcoal-text/60">active</span>
            </div>
            <p className="text-xs text-charcoal-text/60 mt-1">past 30 days</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {/* Total DID Issued - Bar Chart */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border-[3px] border-primary/30 p-6 shadow-[0.1em_0.1em]">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-charcoal-text mb-1">Total DID Issued</h3>
              <div className="flex items-baseline gap-2">
                <p className="text-xs text-charcoal-text/60">Shows cumulative DIDs issued over time</p>
              </div>
            </div>
            {didIssuedData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={didIssuedData.slice(-7)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#7C3AED" opacity={0.1} />
                  <XAxis
                    dataKey="date"
                    stroke="#212529"
                    strokeWidth={2}
                    tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }}
                  />
                  <YAxis
                    stroke="#212529"
                    strokeWidth={2}
                    tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {didIssuedData.slice(-7).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#7C3AED" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-sm text-charcoal-text/40">
                No data available
              </div>
            )}
          </div>

          {/* DID Reused - Area Chart */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border-[3px] border-secondary/30 p-6 shadow-[0.1em_0.1em]">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-charcoal-text mb-1">DID Reused</h3>
              <div className="flex items-baseline gap-2">
                <p className="text-xs text-charcoal-text/60">Total: {totalReused.toLocaleString()} | Avg: {avgDailyReusage} reuses/day</p>
              </div>
            </div>
            {didReusedData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={didReusedData.slice(-7)}>
                  <defs>
                    <linearGradient id="colorDidReused" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#14B8A6" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#14B8A6" opacity={0.1} />
                  <XAxis
                    dataKey="date"
                    stroke="#212529"
                    strokeWidth={2}
                    tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }}
                  />
                  <YAxis
                    stroke="#212529"
                    strokeWidth={2}
                    tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#14B8A6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorDidReused)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-sm text-charcoal-text/40">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Two Tables Side by Side - Professional Design with SuiVerify Theme */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SBT Claims Table */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border-[3px] border-primary/30 shadow-[0.1em_0.1em]">
            <div className="px-6 py-4 border-b-2 border-primary/20 flex items-center justify-between">
              <h2 className="text-lg font-bold text-charcoal-text">SBT Claims</h2>
              <Link href="/sbt-claims" className="text-primary hover:text-primary-dark text-sm font-bold flex items-center gap-1 transition-colors">
                View All
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-primary/5 border-b-2 border-primary/20">
                    <th className="text-left py-3 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">User Address</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">DID Type</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">SBT ID</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">Age</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {sbtClaims && sbtClaims.length > 0 ? (
                    sbtClaims.slice(0, 4).map((claim) => (
                      <tr key={claim.transaction_digest} className="hover:bg-primary/5 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-primary hover:text-primary-dark cursor-pointer font-semibold">
                              {formatAddress(claim.user_address)}
                            </span>
                            <button
                              onClick={() => copyToClipboard(claim.user_address)}
                              className="text-charcoal-text/40 hover:text-primary transition-colors"
                              title="Copy address"
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
                              title="Copy SBT ID"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-charcoal-text/70">{formatTimeAgo(claim.timestamp_ms)}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr key="empty-sbt-claims">
                      <td colSpan={4} className="py-8 text-center text-sm text-charcoal-text/60">
                        {loading ? 'Loading...' : 'No SBT claims available yet'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t-2 border-primary/20">
              <Link
                href="/sbt-claims"
                className="w-full flex items-center justify-center px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-sm font-bold transition-all shadow-[0.1em_0.1em] hover:shadow-[0.15em_0.15em] hover:-translate-x-[0.05em] hover:-translate-y-[0.05em] border-[3px] border-primary/30"
              >
                View All SBT Claims
              </Link>
            </div>
          </div>

          {/* DID Reusage Table */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border-[3px] border-secondary/30 shadow-[0.1em_0.1em]">
            <div className="px-6 py-4 border-b-2 border-secondary/20 flex items-center justify-between">
              <h2 className="text-lg font-bold text-charcoal-text">DID Reusage</h2>
              <Link href="/did-reusage" className="text-secondary hover:text-secondary-dark text-sm font-bold flex items-center gap-1 transition-colors">
                View All
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-secondary/5 border-b-2 border-secondary/20">
                    <th className="text-left py-3 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">Protocol</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">User Address</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">DID NFT</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-charcoal-text/70 uppercase tracking-wider">Enclave TX</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary/10">
                  {settlements && settlements.length > 0 ? (
                    settlements.slice(0, 4).map((settlement) => (
                      <tr key={settlement.id} className="hover:bg-secondary/5 transition-colors">
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
                              title="Copy address"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-charcoal-text font-medium">
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
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-charcoal-text font-medium">
                              {formatAddress(settlement.enclave_tx_digest)}
                            </span>
                            <button
                              onClick={() => copyToClipboard(settlement.enclave_tx_digest)}
                              className="text-charcoal-text/40 hover:text-secondary transition-colors"
                              title="Copy TX"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr key="empty-settlements">
                      <td colSpan={4} className="py-8 text-center text-sm text-charcoal-text/60">
                        {loading ? 'Loading...' : 'No DID reusage settlements yet'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t-2 border-secondary/20">
              <Link
                href="/did-reusage"
                className="w-full flex items-center justify-center px-4 py-2.5 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-xl text-sm font-bold transition-all shadow-[0.1em_0.1em] hover:shadow-[0.15em_0.15em] hover:-translate-x-[0.05em] hover:-translate-y-[0.05em] border-[3px] border-secondary/30"
              >
                View All DID Reusage
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
