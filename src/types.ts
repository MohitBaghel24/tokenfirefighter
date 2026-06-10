/**
 * Configuration for a specific API provider.
 */
export interface ProviderConfig {
  /** The API key for the provider */
  api_key: string;
  /** The base URL for the provider's API */
  base_url: string;
  /** Whether this provider is enabled */
  enabled: boolean;
  /** Optional pricing overrides for specific models */
  pricing_overrides?: Record<string, number>;
}

/**
 * Budget and spending limit settings
 */
export interface BudgetConfig {
  daily_max_usd: number;
  session_max_usd: number;
  hourly_alert_usd: number;
  per_request_max_usd: number;
}

/**
 * Loop detection heuristic settings
 */
export interface LoopDetectionConfig {
  enabled: boolean;
  exact_signature_repeat_threshold: number;
  exact_signature_window_seconds: number;
  token_growth_threshold: number;
  token_growth_consecutive_calls: number;
  content_similarity_threshold: number;
  content_similarity_consecutive_calls: number;
  tool_error_retry_threshold: number;
  tool_error_retry_window_seconds: number;
}

/**
 * Top-level configuration for TokenFirefighter.
 */
export interface Config {
  /** Server configuration settings */
  server: {
    port: number;
    host: string;
    request_timeout_ms: number;
  };
  /** Budget and spending limit settings */
  budget: BudgetConfig;
  /** Loop detection heuristic settings */
  loop_detection: LoopDetectionConfig;
  /** Notification preferences */
  notifications: {
    on_loop_detected: boolean;
    on_budget_80_percent: boolean;
    on_budget_100_percent: boolean;
    terminal_bell: boolean;
  };
  /** Configured providers mapped by name */
  providers: Record<string, ProviderConfig>;
  /** Logging and data retention settings */
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    db_path: string;
    max_history_days: number;
    print_to_stdout: boolean;
    export_format: 'json' | 'csv';
  };
  /** Pricing and rate refresh settings */
  pricing: {
    auto_refresh: boolean;
    refresh_interval_hours: number;
    custom_overrides: Record<string, number>;
  };
}

/**
 * Data associated with a single API request.
 */
export interface RequestData {
  /** Unique identifier for the request record */
  id: string;
  /** Timestamp of the request (Unix epoch or Unix milliseconds) */
  timestamp: number;
  /** Request ID, often provided by the client or generated */
  request_id: string;
  /** ID of the session this request belongs to */
  session_id: string;
  /** The name of the API provider (e.g., openai, anthropic) */
  provider: string;
  /** The model used for the request (e.g., gpt-4) */
  model: string;
  /** The API endpoint called (e.g., /v1/chat/completions) */
  endpoint: string;
  /** Number of tokens in the input/prompt */
  input_tokens: number;
  /** Number of tokens in the output/completion */
  output_tokens: number;
  /** Calculated cost of the request in USD */
  cost_usd: number;
  /** Status regarding loop detection */
  loop_status: 'ok' | 'warning' | 'blocked';
  /** Whether the request was blocked by TokenFirefighter */
  blocked: boolean;
  /** Reason for blocking the request, if blocked */
  block_reason?: string;
  /** Duration of the request in milliseconds */
  duration_ms: number;
  /** HTTP status code returned to the client */
  http_status: number;
}

/**
 * Represents the signature of a single API call used for exact match loop detection.
 */
export interface CallSignature {
  /** The endpoint of the call */
  endpoint: string;
  /** The HTTP method used */
  method: string;
  /** A hash of the request body to detect identical consecutive calls */
  bodyHash: string;
  /** The timestamp when the call was made */
  timestamp: number;
}

/**
 * Represents a signature of an error returned by a tool or API.
 */
export interface ErrorSignature {
  /** Name of the tool or service that errored */
  toolName: string;
  /** The error code returned */
  errorCode: number;
  /** The timestamp of the error */
  timestamp: number;
}

/**
 * State tracking for an active session to analyze spending and detect loops.
 */
export interface SessionState {
  /** Unique identifier for the session */
  id: string;
  /** When the session was created */
  createdAt: Date;
  /** When the last call in the session occurred */
  lastCallAt: Date;
  /** Total spend across all sessions today, or specific to this session's daily context */
  dailySpend: number;
  /** Total spend within this specific session */
  sessionSpend: number;
  /** Number of API calls made in this session */
  callCount: number;
  /** Recent call signatures for loop detection */
  recentSignatures: CallSignature[];
  /** Recent token counts to detect runaway token growth */
  recentTokenCounts: number[];
  /** Recent request bodies for content similarity analysis */
  recentBodies: string[];
  /** Recent errors encountered to detect retry loops */
  recentErrors: ErrorSignature[];
  /** The status of the last call evaluated */
  lastCallStatus: 'ok' | 'warning';
}

/**
 * Result of evaluating a request against loop detection heuristics.
 */
export interface LoopResult {
  /** Whether a loop was detected */
  detected: boolean;
  /** The heuristic layer that triggered the detection */
  layer?: number;
  /** Description of the reason for detection */
  reason?: string;
  /** Suggestion on how to resolve the loop */
  suggestion?: string;
  /** The action to take based on the detection */
  action?: 'block' | 'warn' | 'log';
  /** Estimated number of calls trapped in the loop */
  calls_in_loop?: number;
  /** Estimated savings in USD by stopping the loop */
  estimated_savings_usd?: number;
}

/**
 * Result of evaluating a request against budget limits.
 */
export interface BudgetResult {
  /** Whether the request is allowed within the budget */
  allowed: boolean;
  /** The reason if the request is denied or warned about */
  reason?: string;
  /** The current accumulated spend in USD */
  current_spend_usd: number;
  /** The limit being evaluated against in USD */
  limit_usd: number;
  /** Time remaining until the relevant budget resets */
  time_until_reset?: string;
}

/**
 * Defines where a request should be routed based on its target.
 */
export interface RouteResult {
  /** The name of the provider to route to */
  provider: string;
  /** The target URL for the provider's API */
  targetUrl: string;
  /** The API key to use for the provider */
  apiKey: string;
}

/**
 * Presentation data for a single row in the dashboard UI.
 */
export interface DashboardRow {
  /** The model used */
  model: string;
  /** Formatted input tokens string */
  inputTokens: string;
  /** Formatted output tokens string */
  outputTokens: string;
  /** Formatted cost string */
  cost: string;
  /** Status of the request */
  status: 'ok' | 'warning' | 'blocked';
}
