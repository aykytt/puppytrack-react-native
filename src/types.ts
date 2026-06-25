export interface Dog {
  id: string;
  name: string;
  breed: string;
  breed_size: 'small' | 'medium' | 'large' | 'giant';
  age_months: number;
  birth_date?: string;
  home: 'apartment' | 'garden';
  avatar: string;
  level: 1 | 2 | 3 | 4 | 5;
  water_offset: number;
  food_offset: number;
  water_pair_count: number;
  food_pair_count: number;
  user_id?: string;
}

export interface TrainingLog {
  id: string;
  dog_id: string;
  date: string;       // 'DD.MM.YYYY'
  type: 'success' | 'accident';
  sub: 'pee' | 'poop' | 'both';
  time: string;       // 'HH:MM'
  location: 'indoor' | 'outdoor';
  user_id?: string;
}

export type Lang = 'tr' | 'en';
export type Theme = 'light' | 'dark';
export type Tab = 'home' | 'analysis' | 'history' | 'profile';
export type Urgency = 'now' | 'soon' | 'normal';

export interface Prediction {
  remaining: number;
  urgency: Urgency;
}

export interface FeedingLog {
  id: string;
  dog_id: string;
  type: 'water' | 'food';
  timestamp: string; // ISO string
  source: 'manual' | 'scheduled';
  user_id?: string;
}

export interface DeleteTarget {
  id: string;
  label: string;
  kind?: 'training' | 'feeding';
}
