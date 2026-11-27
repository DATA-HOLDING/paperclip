/**
 * Shared error classification and user-facing copy.
 *
 * Every surface that reacts to a failed request asks two questions: "is this a
 * blip that will fix itself?" and "what do I tell the user?". This module is
 * the single answer to both, so retry policy, the connectivity banner, toasts,
 * and inline errors agree with each other.
 *
 * Classification is structural on purpose: it reads `status`, `code`, `body`,
 * and `name` instead of importing `ApiError`/`ApiUnavailableError`, so the API
 * client can depend on this module without an import cycle, and errors thrown
 * by hand-rolled fetches (health, uploads) classify the same way.
 */

import { t } from "@/i18n";
import { CancelledError } from "@tanstack/react-query";

export type ErrorKind =
  | "transient"
  | "auth"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "invalid"
  | "aborted"
  | "unknown";

export interface ErrorDescription {
  title: string;
  body: string;
  /** True when trying the same request again later can succeed. */
  retryable: boolean;
}

export interface DescribeErrorOptions {
  /** What the user was doing, as a verb phrase: "save the comment". */
  action?: string;
}

/** HTTP statuses that mean "the server or a proxy will likely recover". */
const TRANSIENT_STATUSES = new Set([408, 425, 429, 502, 503, 504]);

/**
 * Error codes that mean "temporarily unavailable" regardless of the HTTP status
 * they arrive with. The Cloud gateway has sent `tenant_app_unavailable` with
 * non-5xx statuses, so these are matched by code, never by status alone.
 */
const TRANSIENT_CODES = new Set([
  "tenant_app_unavailable",
  "tenant_app_starting",
  // Plugin bridge (`PluginBridgeErrorCode`).
  "WORKER_UNAVAILABLE",
  "TIMEOUT",
]);

/** Transient errors that say "the whole server is unreachable", not one route. */
const CONNECTIVITY_STATUSES = new Set([502, 503, 504]);
const CONNECTIVITY_CODES = new Set(["tenant_app_unavailable", "tenant_app_starting"]);

// --- Copy table ---------------------------------------------------------------
//
// The only place user-facing error copy lives. Keys are server error codes (the
// raw `body.error`/`body.code`) or an `ErrorKind` fallback. Never return a raw
// code to the user: anything not in this table falls back to its kind's copy.

const UNAVAILABLE_BODY = t("apiErrors.unavailableBody");

const CODE_COPY: Record<string, { title: string; body: string }> = {
  tenant_app_unavailable: {
    title: t("apiErrors.codes.tenantAppUnavailable.title"),
    body: t("apiErrors.codes.tenantAppUnavailable.body"),
  },
  tenant_app_starting: {
    title: t("apiErrors.codes.tenantAppStarting.title"),
    body: t("apiErrors.codes.tenantAppStarting.body"),
  },
  WORKER_UNAVAILABLE: {
    title: t("apiErrors.codes.workerUnavailable.title"),
    body: t("apiErrors.codes.workerUnavailable.body"),
  },
  TIMEOUT: {
    title: t("apiErrors.codes.timeout.title"),
    body: t("apiErrors.codes.timeout.body"),
  },
  // Queued message edits. The editor keeps the person's text in every case.
  queued_comment_revision_conflict: {
    title: t("apiErrors.codes.queueChanged.title"),
    body: t("apiErrors.codes.queueChanged.body"),
  },
  queued_comment_stale_queue: {
    title: t("apiErrors.codes.queueChanged.title"),
    body: t("apiErrors.codes.queueChanged.body"),
  },
  queued_comment_stale_target: {
    title: t("apiErrors.codes.queuedMessageChanged.title"),
    body: t("apiErrors.codes.queuedMessageChanged.body"),
  },
  queued_comment_not_pending: {
    title: t("apiErrors.codes.queuedMessageChanged.title"),
    body: t("apiErrors.codes.queuedMessageChanged.body"),
  },
  // Issue-thread interaction resolution (moved from lib/interaction-resolution-error.ts).
  interaction_audience_denied: {
    title: t("apiErrors.codes.cannotRespond.title"),
    body: t("apiErrors.codes.audienceDenied.body"),
  },
  interaction_forbidden: {
    title: t("apiErrors.codes.cannotRespond.title"),
    body: t("apiErrors.codes.forbidden.body"),
  },
  interaction_settled: {
    title: t("apiErrors.codes.settled.title"),
    body: t("apiErrors.codes.settled.body"),
  },
  interaction_submit_failed: {
    title: t("apiErrors.codes.submitFailed.title"),
    body: t("apiErrors.codes.submitFailed.body"),
  },
};

const KIND_COPY: Record<ErrorKind, { title: string; body: string }> = {
  // Moved from `ApiUnavailableError` (api/response.ts).
  transient: { title: t("apiErrors.kinds.transient.title"), body: UNAVAILABLE_BODY },
  auth: { title: t("apiErrors.kinds.auth.title"), body: t("apiErrors.kinds.auth.body") },
  forbidden: { title: t("apiErrors.kinds.forbidden.title"), body: t("apiErrors.kinds.forbidden.body") },
  not_found: { title: t("apiErrors.kinds.notFound.title"), body: t("apiErrors.kinds.notFound.body") },
  conflict: { title: t("apiErrors.kinds.conflict.title"), body: t("apiErrors.kinds.conflict.body") },
  invalid: { title: t("apiErrors.kinds.invalid.title"), body: t("apiErrors.kinds.invalid.body") },
  aborted: { title: t("apiErrors.kinds.aborted.title"), body: t("apiErrors.kinds.aborted.body") },
  unknown: { title: t("apiErrors.kinds.unknown.title"), body: t("apiErrors.kinds.unknown.body") },
};

/** Copy for a specific code or kind, for callers that build their own messages. */
export function errorCopy(key: string): { title: string; body: string } {
  return CODE_COPY[key] ?? KIND_COPY[key as ErrorKind] ?? KIND_COPY.unknown;
}

// --- Field extraction -------------------------------------------------------------

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The HTTP status an error carries, if any. */
export function errorStatus(err: unknown): number | null {
  const status = record(err)?.status;
  return typeof status === "number" && Number.isFinite(status) ? status : null;
}

/**
 * Every server-provided code on an error: `ApiError.code` (the raw
 * `body.error`), `body.code`, and `body.details.code`. Plugin bridge errors put
 * their code on `body.code`; HttpErrors put a machine code on `details.code`.
 */
export function errorCodes(err: unknown): string[] {
  const error = record(err);
  if (!error) return [];
  const body = record(error.body);
  const codes = [
    stringField(error.code),
    stringField(body?.error),
    stringField(body?.code),
    stringField(record(body?.details)?.code),
  ];
  return [...new Set(codes.filter((code): code is string => code !== null))];
}

/**
 * True for a machine code (`tenant_app_unavailable`, `WORKER_UNAVAILABLE`,
 * `TIMEOUT`) rather than a sentence a person wrote. Single readable words such
 * as "Forbidden" are not codes.
 */
export function isRawErrorCode(value: string): boolean {
  const text = value.trim();
  if (!text || /\s/.test(text)) return false;
  return Object.hasOwn(KIND_COPY, text) || text === "unauthorized"
    || /^[A-Za-z0-9]+(?:[_.][A-Za-z0-9]+)+$/.test(text) || /^[A-Z][A-Z0-9_]{2,}$/.test(text);
}

/** A server message that is safe to show: not a raw code, not a generic status line. */
function readableServerMessage(err: unknown): string | null {
  const error = record(err);
  const body = record(error?.body);
  // OAuth endpoints (RFC 6749) put the readable sentence in `error_description`
  // and a machine code in `error`.
  const candidates = [stringField(body?.message), stringField(body?.error), stringField(body?.error_description)];
  if (err instanceof Error) candidates.push(stringField(err.message));
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (isRawErrorCode(candidate)) continue;
    if (/^Request failed: \d+$/.test(candidate)) continue;
    if (candidate === UNAVAILABLE_BODY) continue;
    return candidate;
  }
  return null;
}

// --- Classification ---------------------------------------------------------------

function isAbortError(err: unknown): boolean {
  // React Query's `CancelledError` keeps the default `name` ("Error"), so it
  // can only be recognized by class.
  return record(err)?.name === "AbortError" || err instanceof CancelledError;
}

function isNetworkTypeError(err: unknown): boolean {
  // Fetch uses different network-failure messages across browsers. Do not
  // classify arbitrary TypeErrors (programming bugs) as outages.
  return err instanceof TypeError && /fetch|network|load failed/i.test(err.message);
}

function isApiUnavailableError(err: unknown): boolean {
  return record(err)?.name === "ApiUnavailableError";
}

export function classifyError(err: unknown): ErrorKind {
  if (err === null || err === undefined) return "unknown";
  if (isAbortError(err)) return "aborted";
  if (isApiUnavailableError(err) || isNetworkTypeError(err)) return "transient";
  if (errorCodes(err).some((code) => TRANSIENT_CODES.has(code))) return "transient";

  const status = errorStatus(err);
  if (status === null) return "unknown";
  if (TRANSIENT_STATUSES.has(status)) return "transient";
  if (status === 401) return "auth";
  if (status === 403) return "forbidden";
  if (status === 404 || status === 410) return "not_found";
  if (status === 409 || status === 412) return "conflict";
  if (status >= 400 && status < 500) return "invalid";
  return "unknown";
}

export function isTransientError(err: unknown): boolean {
  return classifyError(err) === "transient";
}

/**
 * A transient error that means the server as a whole is unreachable (network
 * drop, proxy 5xx, gateway "app unavailable"), as opposed to one route being
 * busy (429, a plugin worker restarting). Only these move the app-wide
 * connectivity state; per-route blips are left to query retry.
 */
export function isConnectivityError(err: unknown): boolean {
  if (isApiUnavailableError(err) || isNetworkTypeError(err)) return true;
  if (errorCodes(err).some((code) => CONNECTIVITY_CODES.has(code))) return true;
  const status = errorStatus(err);
  if (status === null || !CONNECTIVITY_STATUSES.has(status)) return false;
  // A plugin worker 503 is one route, not the server.
  return !errorCodes(err).some((code) => TRANSIENT_CODES.has(code) && !CONNECTIVITY_CODES.has(code));
}

/** HTTP 4xx other than the transient ones; retrying the same request cannot help. */
export function isClientError(err: unknown): boolean {
  const kind = classifyError(err);
  return kind === "auth" || kind === "forbidden" || kind === "not_found" || kind === "conflict" || kind === "invalid";
}

// --- Retry-After --------------------------------------------------------------------

const MAX_RETRY_AFTER_MS = 5 * 60_000;

/** Parse an HTTP `Retry-After` value (delta-seconds or HTTP-date) into milliseconds. */
export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const text = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    return Math.min(Math.round(Number(text) * 1000), MAX_RETRY_AFTER_MS);
  }
  const date = Date.parse(text);
  if (Number.isNaN(date)) return null;
  return Math.min(Math.max(0, date - now), MAX_RETRY_AFTER_MS);
}

/** The server-requested delay carried by an error, if any. */
export function errorRetryAfterMs(err: unknown): number | null {
  const value = record(err)?.retryAfterMs;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

// --- Copy -----------------------------------------------------------------------------

/**
 * User-facing copy for any error. Never returns a raw `snake_case` code:
 * known codes use the table above, readable server messages pass through for
 * client errors, and everything else uses the copy for its kind.
 */
export function describeError(err: unknown, options: DescribeErrorOptions = {}): ErrorDescription {
  const kind = classifyError(err);
  const retryable = kind === "transient" || kind === "unknown";
  const coded = errorCodes(err).map((code) => CODE_COPY[code]).find(Boolean);
  const fallback = KIND_COPY[kind];

  let body: string;
  if (coded) body = coded.body;
  else if (kind === "transient" || kind === "aborted") body = fallback.body;
  else body = readableServerMessage(err) ?? fallback.body;

  const title = options.action && kind !== "transient"
    ? t("apiErrors.couldNot", { action: options.action })
    : (coded?.title ?? fallback.title);
  return { title, body, retryable };
}

/**
 * The `message` for an `ApiError` built from an HTTP response: the server's own
 * text when it is readable, otherwise copy from the table. Keeps raw codes out
 * of every `{error.message}` render and `toast(err.message)` call.
 */
export function apiErrorMessage(status: number, body: unknown): string {
  const raw = stringField(record(body)?.error);
  if (raw && !isRawErrorCode(raw)) return raw;
  return describeError({ status, body, code: raw }).body;
}
