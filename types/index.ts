export interface Group {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface Wordbook {
  id: string;
  name: string;
  total_words: number;
  created_at: string;
}

export interface Word {
  id: string;
  wordbook_id: string;
  number: number;
  word: string;
  meaning: string;
}

export interface UserProfile {
  id: string;
  name: string;
  group_id: string | null;
  wordbook_id: string | null;
  created_at: string;
  wordbooks?: Wordbook | null;
  groups?: Group | null;
}

export interface GroupMember {
  id: string;
  name: string;
  wordbook_id: string | null;
  wordbooks?: {
    name: string;
  } | null;
}
