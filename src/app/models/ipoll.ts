// Poll Models
export interface Poll {
  poll_id?: number;
  session_id: number;
  poll_title: string;
  poll_question: string;
  poll_anonymous: boolean;
  poll_status: string;
  selection_type: string;
  created_at?: string;
  options?: PollOption[];
}

export interface PollOption {
  option_id?: number;
  poll_id?: number;
  option_label: string;
  option_order?: number;
}

export interface PollVote {
  vote_id?: number;
  poll_id: number;
  option_id: number;
  participant_id: number;
  interaction_value: number;
  voted_at?: string;
}

export interface PollVoteSubmission {
  pollId: number;
  participantId: number;
  optionId: number;
  interactionValue: number;
}

export interface CreatePollRequest {
  session_id: number;
  poll_title: string;
  poll_question: string;
  poll_anonymous: boolean;
  selection_type: string;
  options: CreatePollOptionRequest[];
}

export interface CreatePollOptionRequest {
  option_label: string;
  option_order?: number;
}

// v2 API payloads (camelCase)
export interface CreatePollApiRequest {
  sessionId: number;
  pollTitle: string;
  pollQuestion: string;
  pollAnonymous: boolean;
  pollStatus?: string;
  selectionType?: string;
  options: CreatePollOptionApiRequest[];
}

export interface CreatePollOptionApiRequest {
  optionLabel: string;
  optionOrder?: number;
}

// v2 API responses (camelCase)
export interface PollOverview {
  pollId: number;
  sessionId: number;
  sessionCode?: string | null;
  pollTitle: string;
  pollQuestion: string;
  pollAnonymous: boolean;
  pollStatus: string;
  selectionType: string;
  startTime?: string | null;
  endTime?: string | null;
  options: PollOptionOverview[];
}

export interface PollOptionOverview {
  optionId: number;
  optionLabel: string;
  optionOrder?: number;
}

export interface CreatePollResponse {
  pollId: number;
  message: string;
  status: string;
}

export interface PollListResponse {
  count: number;
  polls: Poll[];
}

export interface PollResult {
  pollId: number;
  title: string;
  question: string;
  totalVotes: number;
  options: PollOptionResult[];
}

export interface PollOptionResult {
  optionId: number;
  optionLabel: string;
  voteCount: number;
  percentage: number;
}

export interface ClosePollResponse {
  message: string;
  pollId: number;
  finalResults: {
    totalVotes: number;
    winner: string;
  };
}

export interface PollVoteSubmission {
  pollId: number;
  participantId: number;
  selectedOptionIds: number[];
  interactionValue: number;
}

export interface PollVoteResponse {
  success: boolean;
  message: string;
  pollId: number;
  votedOptions: number[];
}

export interface PollResult {
  pollId: number;
  pollTitle: string;
  pollQuestion: string;
  totalVotes: number;
  options: {
    optionId: number;
    optionLabel: string;
    voteCount: number;
    percentage: number;
  }[];
}
