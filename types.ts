
export interface BankSource {
  title: string;
  uri: string;
}

export interface Bank {
  id: string;
  name: string;
  ratePesos: number; // Annual percentage rate (e.g., 35 for 35%)
  rateUsd: number;   // Annual percentage rate (e.g., 2 for 2%)
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

export interface ChartDataPoint {
  month: number;
  monthName: string;
  value: number;
}
