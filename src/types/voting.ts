export type VotingType =
  | 'numericalValue'
  | 'categoricalValue'
  | 'category'
  | 'decimals'
  | 'membership'
  | 'membershipRevocation'
  | 'theme'
  | 'statement';

export type VotingTab = 'active' | 'past';

export interface VotingRow {
  id: string;
  author: string;
  startTime: number;
  endTime: number;
  typeKey: VotingType;
  finalized: boolean;
  finalizedSuccess?: boolean;
  proposedValue?: string;
}

export interface CreateVotingPrefill {
  x: bigint;
  y: bigint;
  isCategorical: boolean;
}

export interface VotingPayload {
  type: VotingType;
  organ: `0x${string}` | null;
  x: bigint;
  y: bigint;
  isCategorical: boolean;
  value: bigint;
  valueAuthor: string;
  category: bigint;
  categoryName: string;
  decimals: number;
  member: string;
  theme: string;
  statement: string;
  durationSeconds: bigint;
}
