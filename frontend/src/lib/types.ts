export type TradeMode = "free" | "pay_what_you_want" | "priced";
export type ItemStatus = "available" | "given_away";
export type FreshnessLevel = "fresh24" | "fresh72" | "old";

export interface User {
  id: number;
  name: string;
  room_no: string | null;
  avatar_emoji: string | null;
}

export interface Freshness {
  level: FreshnessLevel;
  label: string;
}

export interface Item {
  id: number;
  title: string;
  description: string;
  image_url: string | null;
  trade_mode: TradeMode;
  price: number | null;
  status: ItemStatus;
  owner: User;
  created_at: number;
  given_away_at: number | null;
  given_to_user_id: number | null;
  want_count: number;
  freshness: Freshness;
  is_mine: boolean;
  i_want: boolean;
}

export interface ItemListResponse {
  items: Item[];
  total: number;
}

export interface Message {
  id: number;
  item_id?: number;
  user: User;
  content: string;
  created_at: number;
  pending?: boolean;
}

export interface MessageListResponse {
  messages: Message[];
}

export interface WantUser {
  id: number;
  name: string;
  room_no?: string | null;
  avatar_emoji?: string | null;
}

export interface WantResponse {
  want_count: number;
  i_want: true;
}

export interface StatsResponse {
  this_month_published: number;
  this_month_completed: number;
  available_count: number;
  fastest: { item: Item; took_seconds: number } | null;
  most_wanted: { item: Item; want_count: number }[];
}

export interface PriceSuggestion {
  source: "llm" | "fallback";
  mode: "priced" | "free";
  min: number;
  max: number;
  reason: string;
}

export interface PolishSuggestion {
  source: "llm" | "fallback";
  title: string;
  description: string;
}

export interface FaqReply {
  source: "llm" | "fallback";
  reply: string;
}
