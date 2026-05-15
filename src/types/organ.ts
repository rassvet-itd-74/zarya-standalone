export interface OrganTag {
  code: string;
  organ?: string;
}

export type MembershipStatus = 'pending' | 'member' | 'unknown' | 'unresolved';
