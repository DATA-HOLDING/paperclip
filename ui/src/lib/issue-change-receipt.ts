import type { IssueChangeReceiptEntry } from "@paperclipai/shared";
import { formatReviewPolicyValue } from "./review-policy";
import { t } from "@/i18n";

/**
 * Read + format the field-level change receipts carried on an `issue.updated`
 * activity event (the open cross-task write design (audit), built on the field-change receipts the API already records).
 *
 * Every issue PATCH — agent and board alike — must leave an auditable record of
 * who changed what, when, and under which authorization. The server writes that
 * receipt; this module turns it into something a human can scan in the activity
 * stream without opening the audit log.
 *
 * The server already drops `updatedAt` and truncates long text (flagging it with
 * `updated: true`), so this module renders what it is given rather than
 * re-deciding what is interesting.
 */

/** Field names whose raw ids carry no meaning in a scannable summary. */
const FIELD_LABELS: Record<string, string> = {
  assigneeAgentId: t("libIssueChangeReceipt.fields.assigneeAgentId"),
  assigneeUserId: t("libIssueChangeReceipt.fields.assigneeUserId"),
  responsibleUserId: t("libIssueChangeReceipt.fields.responsibleUserId"),
  blockedByIssueIds: t("libIssueChangeReceipt.fields.blockedByIssueIds"),
  labelIds: t("libIssueChangeReceipt.fields.labelIds"),
  parentId: t("libIssueChangeReceipt.fields.parentId"),
  projectId: t("libIssueChangeReceipt.fields.projectId"),
  goalId: t("libIssueChangeReceipt.fields.goalId"),
  workMode: t("libIssueChangeReceipt.fields.workMode"),
  reviewPolicy: t("libIssueChangeReceipt.fields.reviewPolicy"),
  billingCode: t("libIssueChangeReceipt.fields.billingCode"),
  checkoutRunId: t("libIssueChangeReceipt.fields.checkoutRunId"),
  executionRunId: t("libIssueChangeReceipt.fields.executionRunId"),
  hiddenAt: t("libIssueChangeReceipt.fields.hiddenAt"),
  startedAt: t("libIssueChangeReceipt.fields.startedAt"),
  completedAt: t("libIssueChangeReceipt.fields.completedAt"),
  cancelledAt: t("libIssueChangeReceipt.fields.cancelledAt"),
  requestDepth: t("libIssueChangeReceipt.fields.requestDepth"),
  sourceTrust: t("libIssueChangeReceipt.fields.sourceTrust"),
  executionPolicy: t("libIssueChangeReceipt.fields.executionPolicy"),
  executionWorkspaceId: t("libIssueChangeReceipt.fields.executionWorkspaceId"),
  projectWorkspaceId: t("libIssueChangeReceipt.fields.projectWorkspaceId"),
};

/** Human label for a changed field, e.g. `assigneeAgentId` → "Assignee". */
export function issueChangeFieldLabel(field: string): string {
  const known = FIELD_LABELS[field];
  if (known) return known;
  // camelCase / snake_case → "Sentence case".
  const spaced = field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const VALUE_PREVIEW_BUDGET = 72;

/**
 * Render one side of a change for display. Never returns an empty string, so a
 * receipt row always reads as "from → to" rather than trailing into nothing.
 */
export function formatIssueChangeValue(
  value: unknown,
  options: { resolveAgentLabel?: (id: string) => string | null | undefined;
    resolveUserLabel?: (id: string) => string | null | undefined;
    field?: string } = {},
): string {
  // `reviewPolicy` is nullable-by-default: a cleared column means "anyone can
  // approve", not "no value" (PAP-16506), so it resolves before the null branch.
  if (options.field === "reviewPolicy") return formatReviewPolicyValue(value);
  if (value === null || value === undefined || value === "") return t("libIssueChangeReceipt.value.none");
  if (typeof value === "boolean") return value ? t("libIssueChangeReceipt.value.yes") : t("libIssueChangeReceipt.value.no");
  if (typeof value === "number") return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return t("libIssueChangeReceipt.value.none");
    const strings = value.filter((entry): entry is string => typeof entry === "string");
    if (strings.length !== value.length) return t("libIssueChangeReceipt.value.items", { count: value.length });
    return strings.length <= 3
      ? strings.map((id) => shortenId(id)).join(", ")
      : t("libIssueChangeReceipt.value.items", { count: strings.length });
  }

  if (value instanceof Date) return value.toLocaleString();

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return t("libIssueChangeReceipt.value.none");
    // Ids resolve to names when the directory is loaded; otherwise they shorten.
    const resolved = options.field?.toLowerCase().includes("agent")
      ? options.resolveAgentLabel?.(trimmed)
      : options.field?.toLowerCase().includes("user")
        ? options.resolveUserLabel?.(trimmed)
        : null;
    if (resolved) return resolved;
    if (isIsoTimestamp(trimmed)) return new Date(trimmed).toLocaleString();
    if (looksLikeId(trimmed)) return shortenId(trimmed);
    const humanized = trimmed.includes(" ") ? trimmed : trimmed.replace(/_/g, " ");
    return truncate(humanized);
  }

  // Objects (execution policy, workspace settings) are structural — the receipt
  // records that they moved, and the audit log holds the full value.
  return t("libIssueChangeReceipt.value.updated");
}

function truncate(value: string): string {
  const chars = Array.from(value);
  if (chars.length <= VALUE_PREVIEW_BUDGET) return value;
  return `${chars.slice(0, VALUE_PREVIEW_BUDGET).join("")}…`;
}

function isIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) && !Number.isNaN(Date.parse(value));
}

function looksLikeId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function shortenId(value: string): string {
  return looksLikeId(value) ? value.slice(0, 8) : truncate(value);
}

export interface IssueChangeReceiptRow {
  field: string;
  label: string;
  from: string;
  to: string;
  /** Server flagged the values as truncated previews of long text. */
  truncated: boolean;
}

function isChangeEntry(value: unknown): value is IssueChangeReceiptEntry {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && "from" in (value as object) && "to" in (value as object);
}

/**
 * Parse `details.changes` off an activity event into display rows. Returns an
 * empty array for events with no receipt (older rows, non-PATCH actions), so
 * callers can render nothing without special-casing.
 */
export function readIssueChangeReceipt(
  details: Record<string, unknown> | null | undefined,
  options: Parameters<typeof formatIssueChangeValue>[1] = {},
): IssueChangeReceiptRow[] {
  const changes = details?.changes;
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return [];

  const rows: IssueChangeReceiptRow[] = [];
  for (const [field, entry] of Object.entries(changes as Record<string, unknown>)) {
    if (!isChangeEntry(entry)) continue;
    rows.push({
      field,
      label: issueChangeFieldLabel(field),
      from: formatIssueChangeValue(entry.from, { ...options, field }),
      to: formatIssueChangeValue(entry.to, { ...options, field }),
      truncated: entry.updated === true,
    });
  }
  // Stable, scannable order regardless of JSON key order (jsonb reorders keys).
  return rows.sort((a, b) => a.label.localeCompare(b.label));
}

/** Authorization reasons, as recorded by the server's write-policy decision. */
const AUTHORIZATION_REASON_LABELS: Record<string, string> = {
  allow_visible_issue_write: t("libIssueChangeReceipt.authorizationReasons.allow_visible_issue_write"),
  allow_scoped_agent_write: t("libIssueChangeReceipt.authorizationReasons.allow_scoped_agent_write"),
  allow_board_actor: t("libIssueChangeReceipt.authorizationReasons.allow_board_actor"),
  allow_self: t("libIssueChangeReceipt.authorizationReasons.allow_self"),
  allow_issue_mention_grant: t("libIssueChangeReceipt.authorizationReasons.allow_issue_mention_grant"),
  allow_direct_parent_report: t("libIssueChangeReceipt.authorizationReasons.allow_direct_parent_report"),
  allow_low_trust_boundary: t("libIssueChangeReceipt.authorizationReasons.allow_low_trust_boundary"),
  allow_explicit_grant: t("libIssueChangeReceipt.authorizationReasons.allow_explicit_grant"),
  allow_instance_admin: t("libIssueChangeReceipt.authorizationReasons.allow_instance_admin"),
  allow_local_board: t("libIssueChangeReceipt.authorizationReasons.allow_local_board"),
  internal_agent_write: t("libIssueChangeReceipt.authorizationReasons.internal_agent_write"),
};

/**
 * Human phrasing for the authorization reason on a write receipt. Unknown
 * reasons degrade to their humanized code rather than disappearing — an
 * unexplained write is worse than an ugly one.
 */
export function issueAuthorizationReasonLabel(reason: string | null | undefined): string | null {
  const trimmed = reason?.trim();
  if (!trimmed) return null;
  return AUTHORIZATION_REASON_LABELS[trimmed] ?? trimmed.replace(/_/g, " ");
}
