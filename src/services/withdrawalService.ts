import { apiGet, apiPost, apiPut } from '@lib/api/client';

export interface WithdrawalRecord {
  id: string;
  user_id: string;
  user_name: string;
  method_type: 'bank' | 'ewallet';
  channel: string;
  account_number: string;
  account_name: string;
  amount: number;
  currency: string;
  status: 'pending' | 'under_review' | 'approved' | 'processing' | 'paid' | 'rejected' | 'cancelled';
  reference_no?: string;
  rejection_reason?: string;
  created_at: string;
};

function normalizeWithdrawal(row: any): WithdrawalRecord {
  let details: Record<string, string> = {};
  try { details = JSON.parse(row.payout_reference || '{}'); } catch { /* legacy values are displayed as a reference */ }
  return {
    id: row.id,
    user_id: row.owner_id,
    user_name: row.user_name || '',
    method_type: details.method_type === 'ewallet' ? 'ewallet' : 'bank',
    channel: details.channel || row.payout_method || '—',
    account_number: details.account_number || '',
    account_name: details.account_name || '',
    amount: Number(row.amount),
    currency: row.currency || 'USD',
    status: row.status,
    reference_no: row.reference_no || details.reference_no,
    rejection_reason: row.rejection_reason,
    created_at: row.created_at,
  };
}

export async function getWithdrawalRequests(_userId: string): Promise<{ data: WithdrawalRecord[]; error: Error | null }> {
  try {
    const response = await apiGet<any>('/api/withdrawals?limit=100');
    return { data: (response.data?.data || []).map(normalizeWithdrawal), error: null };
  } catch (error) {
    return { data: [], error: error instanceof Error ? error : new Error('Failed to fetch withdrawal requests') };
  }
}

export async function getAdminWithdrawalRequests(status?: string) {
  try {
    const params = new URLSearchParams({ limit: '100' });
    if (status && status !== 'all') params.set('status', status);
    const response = await apiGet<any>(`/api/admin/withdrawals?${params}`);
    return { data: (response.data?.data || []).map(normalizeWithdrawal), error: null };
  } catch (error) {
    return { data: [], error: error instanceof Error ? error : new Error('Failed to fetch withdrawal requests') };
  }
}

export async function updateAdminWithdrawal(id: string, status: 'approved' | 'paid' | 'rejected', reason?: string) {
  try {
    const response = await apiPut<any>(`/api/admin/withdrawals/${encodeURIComponent(id)}`, {
      status,
      rejection_reason: status === 'rejected' ? reason : undefined,
      reference_no: status === 'paid' ? reason : undefined,
    });
    if (!response.success) throw new Error(response.error || 'Failed to update withdrawal');
    return { data: response.data ? normalizeWithdrawal(response.data) : null, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('Failed to update withdrawal') };
  }
}

export async function getWalletInfo(userId: string) {
  try {
    const ledgerResult = await getWalletTransactions(userId, 500);
    if (ledgerResult.error) throw ledgerResult.error;
    const usdSummary = ledgerResult.summary?.find((item: any) => item.currency === 'USD');
    return { data: {
      balance: Number(usdSummary?.balance || 0),
      total_earned: Number(usdSummary?.total_earned || 0),
      total_withdrawn: Number(usdSummary?.total_withdrawn || 0),
    }, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('Failed to fetch wallet info') };
  }
}

export async function createWithdrawalRequest(
  _userId: string,
  input: { amount: number; currency?: 'USD'; payout_method: string; payout_reference: string },
) {
  try {
    if (!Number.isFinite(input.amount) || input.amount < 50) throw new Error('Minimum withdrawal is USD 50');
    const response = await apiPost<any>('/api/withdrawals', {
      amount: input.amount,
      currency: 'USD',
      payout_method: input.payout_method,
      payout_reference: input.payout_reference,
    });
    if (!response.success) throw new Error(response.error || 'Failed to create withdrawal request');
    return { data: response.data ? normalizeWithdrawal(response.data) : null, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('Failed to create withdrawal request') };
  }
}

export async function cancelWithdrawalRequest(_withdrawalId: string) {
  return { error: new Error('Withdrawal cancellation is not available yet.') };
}

export async function getWalletTransactions(userId: string, limit = 50) {
  void userId;
  try {
    const response = await apiGet<any>(`/api/financial-ledger?limit=${Math.min(Math.max(limit, 1), 500)}`);
    return { data: response.data?.data || [], summary: response.data?.summary || [], error: null };
  } catch (error) {
    return { data: [], summary: [], error: error instanceof Error ? error : new Error('Failed to fetch wallet ledger') };
  }
}
