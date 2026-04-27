// API service for fetching DID claim events

export interface DIDClaimEvent {
    id: number;
    registry_id: string;
    user_address: string;
    did_type: string;
    user_did_id: string;
    nft_id: string;
    checkpoint_sequence_number: number;
    transaction_digest: string;
    timestamp_ms: number;
    event_index: number;
}

export interface APIResponse {
    success: boolean;
    data: DIDClaimEvent[];
    pagination: {
        limit: number;
        offset: number;
        total: number;
        has_more: boolean;
    };
}

export async function fetchDIDEvents(
    options: {
        limit?: number;
        offset?: number;
        did_type?: string;
    } = {}
): Promise<APIResponse> {
    const params = new URLSearchParams({
        limit: String(options.limit || 100),
        offset: String(options.offset || 0),
        ...(options.did_type && { did_type: options.did_type }),
    });

    // Route through the server-side proxy at /api/events so the API key
    // is injected server-side and never reaches the browser.
    const response = await fetch(`/api/events?${params}`);

    if (!response.ok) {
        throw new Error('Failed to fetch DID events');
    }

    return response.json();
}

// ============================================
// Settlement API (protocol-pay-microservice)
// ============================================

export interface SettlementRecord {
    id: number;
    enclave_tx_digest: string;
    did_verified_id: string;
    did_nft_name: string | null;
    protocol_uid: number;
    protocol_name: string;
    protocol_address: string | null;
    user_address: string;
    payment_tx_digest: string;
    settlement_amount: number;
    timestamp: number;
    created_at: string;
    status: string;
}

export interface SettlementsResponse {
    success: boolean;
    total: number;
    count: number;
    pagination: {
        limit: number;
        page: number;
        totalPages: number;
    };
    data: SettlementRecord[];
}

export async function fetchSettlements(
    options: {
        limit?: number;
        page?: number;
    } = {}
): Promise<SettlementsResponse> {
    const params = new URLSearchParams({
        limit: String(options.limit || 100),
        page: String(options.page || 1),
    });

    const settlementApiUrl = process.env.NEXT_PUBLIC_SETTLEMENT_API_URL || 'http://localhost:3001';
    const response = await fetch(`${settlementApiUrl}/api/settlement/all?${params}`);

    if (!response.ok) {
        throw new Error('Failed to fetch settlements');
    }

    return response.json();
}

// ============================================
// Explorer stats (verification-backend, public)
// ============================================

export interface ExplorerStats {
    total_users: number;
    total_dids_issued: number;
    total_dids_reused: number;
    total_sbt_claims: number;
    protocols_integrated: number;
}

export interface ExplorerTimePoint {
    date: string;
    count: number;
}

export interface ExplorerPartner {
    client_id: string;
    name: string;
    created_at: string;
}

const VERIFICATION_BACKEND_URL =
    process.env.NEXT_PUBLIC_VERIFICATION_BACKEND_URL || 'http://localhost:8000';

export async function fetchExplorerStats(): Promise<ExplorerStats> {
    const res = await fetch(`${VERIFICATION_BACKEND_URL}/api/explorer/stats`, {
        cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Failed to fetch explorer stats: ${res.status}`);
    return res.json();
}

export async function fetchDIDTimeseries(days = 30): Promise<ExplorerTimePoint[]> {
    const res = await fetch(`${VERIFICATION_BACKEND_URL}/api/explorer/dids/timeseries?days=${days}`, {
        cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Failed to fetch DID timeseries: ${res.status}`);
    return res.json();
}

export async function fetchReuseTimeseries(days = 30): Promise<ExplorerTimePoint[]> {
    const res = await fetch(`${VERIFICATION_BACKEND_URL}/api/explorer/reuses/timeseries?days=${days}`, {
        cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Failed to fetch reuse timeseries: ${res.status}`);
    return res.json();
}

export async function fetchExplorerPartners(): Promise<ExplorerPartner[]> {
    const res = await fetch(`${VERIFICATION_BACKEND_URL}/api/explorer/partners`, {
        cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Failed to fetch partners: ${res.status}`);
    return res.json();
}
