export interface AskSivloCitation {
  sourceId: string;
  meetingId: string;
  meetingTitle: string;
  meetingDate?: string;
  sourceType: 'transcript' | 'summary' | 'note' | 'action_item' | 'decision';
  excerpt: string;
  timestampStart?: number;
  timestampEnd?: number;
}

export interface AskSivloMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: AskSivloCitation[];
  route?: 'meeting' | 'product';
  timestamp: number;
}

export interface AskSivloScope {
  kind: 'all' | 'meeting';
  meetingId?: string;
}

export interface AskSivloHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskSivloResponse {
  answer: string;
  route: 'meeting' | 'product';
  citations: AskSivloCitation[];
}

export interface AskSivloRequest {
  query: string;
  history: AskSivloHistoryMessage[];
  scope?: AskSivloScope;
}
