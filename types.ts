
export interface BankSource {
  title: string;
  uri: string;
}

export interface BankPromotion {
  bankName: string;
  benefits: {
    category: string;
    description: string;
    discount: string;
  }[];
}

export interface Bank {
  id: string;
  name: string;
  ratePesos: number;
  rateUsd: number;
  source?: 'public' | 'local';
  lastUpdated?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  picture: string;
  accessToken?: string;
}

export type Currency = 'ARS' | 'USD';

export interface ChatSpace {
  name: string;
  displayName: string;
  type: string;
}

export interface BankEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body?: string;
}
