export interface DerivedAction {
  task: string;
  owner?: string;
  due?: string;
  reference?: string;
}

export interface DerivedDecision {
  decision: string;
  rationale?: string;
  timestamp?: string;
}

export interface ParseResult<T> {
  items: T[];
  foundSection: boolean;
}
