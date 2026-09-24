/**
 * Zod schemas for all data received from external servers.
 *
 * Every schema here mirrors an existing TypeScript interface/type so that
 * server responses are validated before the rest of the application trusts
 * them. Use `parseWith` (exported below) to validate and throw on failure.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitives / shared helpers
// ---------------------------------------------------------------------------

/** Non-empty string — rejects blank values sent by a malicious server. */
const nonEmptyString = z.string().min(1);

// ---------------------------------------------------------------------------
// Comment  (src/types/index.ts → Comment)
// ---------------------------------------------------------------------------

export const CommentSchema = z.object({
  id: nonEmptyString,
  campaignId: z.number().int(),
  content: z.string(),
  authorAddress: nonEmptyString,
  timestamp: z.number(),
  parentId: z.string().nullable(),
  signature: z.string(),
  isPinned: z.boolean(),
  isReported: z.boolean(),
});

export type Comment = z.infer<typeof CommentSchema>;

// ---------------------------------------------------------------------------
// CommentsPage  (src/hooks/useCampaignComments.ts → CommentsPage)
// ---------------------------------------------------------------------------

export const CommentsPageSchema = z.object({
  items: z.array(CommentSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  hasMore: z.boolean(),
});

export type CommentsPage = z.infer<typeof CommentsPageSchema>;

// ---------------------------------------------------------------------------
// CampaignUpdate  (src/types/index.ts → CampaignUpdate)
// ---------------------------------------------------------------------------

export const CampaignUpdateSchema = z.object({
  id: nonEmptyString,
  campaignId: z.number().int(),
  content: z.string(),
  authorAddress: nonEmptyString,
  timestamp: z.number(),
  signature: z.string(),
});

export type CampaignUpdate = z.infer<typeof CampaignUpdateSchema>;

// ---------------------------------------------------------------------------
// AppNotification  (src/lib/notifications.ts → AppNotification)
// ---------------------------------------------------------------------------

const NotificationEventTypeSchema = z.enum([
  "contribution_confirmed",
  "campaign_funded",
  "campaign_cancelled",
  "refund_available",
  "revenue_deposited",
  "revenue_claimed",
  "new_update",
  "campaign_verified",
]);

export const AppNotificationSchema = z.object({
  id: nonEmptyString,
  type: NotificationEventTypeSchema,
  campaignId: z.number().int(),
  campaignTitle: z.string(),
  message: z.string(),
  href: nonEmptyString,
  timestamp: z.number(),
  read: z.boolean(),
});

export type AppNotification = z.infer<typeof AppNotificationSchema>;

// ---------------------------------------------------------------------------
// NotificationFeedResponse  (src/lib/notifications.ts → NotificationFeedResponse)
// ---------------------------------------------------------------------------

export const NotificationFeedResponseSchema = z.object({
  notifications: z.array(AppNotificationSchema),
});

export type NotificationFeedResponse = z.infer<typeof NotificationFeedResponseSchema>;

// ---------------------------------------------------------------------------
// CampaignReport  (src/lib/campaignReports.ts → CampaignReport)
// ---------------------------------------------------------------------------

const ReportReasonSchema = z.enum([
  "scam",
  "inappropriate",
  "misleading",
  "duplicate",
  "other",
]);

export const CampaignReportSchema = z.object({
  id: nonEmptyString,
  campaignId: z.number().int(),
  campaignTitle: z.string(),
  reason: ReportReasonSchema,
  notes: z.string(),
  reporterAddress: z.string().nullable(),
  timestamp: z.number(),
  status: z.enum(["pending", "reviewed"]),
});

export type CampaignReport = z.infer<typeof CampaignReportSchema>;

// ---------------------------------------------------------------------------
// ObservabilityEvent  (src/lib/observability/types.ts → ObservabilityEvent)
// ---------------------------------------------------------------------------

const ObservabilityCategorySchema = z.enum(["contract", "transaction", "rpc"]);

const ObservabilityKindSchema = z.enum([
  "contract_error",
  "simulation_failure",
  "submission_failure",
  "confirmation_timeout",
  "confirmation_failed",
  "rpc_error",
  "rpc_timeout",
  "transaction_success",
]);

export const ObservabilityEventSchema = z.object({
  id: nonEmptyString,
  timestamp: nonEmptyString,
  category: ObservabilityCategorySchema,
  kind: ObservabilityKindSchema,
  operation: z.string().optional(),
  contractErrorCode: z.number().int().optional(),
  contractErrorKey: z.string().optional(),
  message: z.string().optional(),
  network: z.string().optional(),
  rpcStatus: z.string().optional(),
  txHash: z.string().optional(),
});

export type ObservabilityEvent = z.infer<typeof ObservabilityEventSchema>;

// ---------------------------------------------------------------------------
// API request body schemas (for Next.js route handlers)
// ---------------------------------------------------------------------------

/** POST /api/reports */
export const CreateReportBodySchema = z.object({
  campaignId: z.number({ required_error: "campaignId is required" }).int().positive(),
  campaignTitle: z.string({ required_error: "campaignTitle is required" }).min(1),
  reason: ReportReasonSchema,
  notes: z.string().max(1000).optional().default(""),
  reporterAddress: z.string().nullable().optional().default(null),
});

/** POST /api/campaigns/[campaignId]/comments */
export const CreateCommentBodySchema = z.object({
  content: z
    .string({ required_error: "Content is required" })
    .min(1, "Content is required")
    .max(2000, "Content must be at most 2000 characters"),
  authorAddress: z.string({ required_error: "Author address is required" }).min(1),
  timestamp: z.number().optional(),
  parentId: z.string().nullable().optional().default(null),
  signature: z.string({ required_error: "Signature is required" }).min(1),
});

/** POST /api/email-opt-in */
export const EmailOptInBodySchema = z.object({
  email: z
    .string({ required_error: "email is required" })
    .email("Invalid email format"),
  campaignTitle: z
    .string({ required_error: "campaignTitle is required" })
    .min(1, "campaignTitle is required"),
  timestamp: z.string().or(z.number()).optional(),
});

/** POST /api/observability/events */
export const ObservabilityEventBodySchema = ObservabilityEventSchema.extend({
  /** id is optional in the body — the route fills it in when absent. */
  id: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Parse helper
// ---------------------------------------------------------------------------

/**
 * Parse `data` against `schema`. On failure, logs a console warning with the
 * schema name and throws a `TypeError` so callers can surface a clear error.
 *
 * @example
 *   const comment = parseWith(CommentSchema, "CommentSchema", rawJson);
 */
export function parseWith<T>(
  schema: z.ZodType<T>,
  schemaName: string,
  data: unknown,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = `[schemas] Validation failed for ${schemaName}: ${result.error.message}`;
    console.warn(message, { issues: result.error.issues, data });
    throw new TypeError(message);
  }
  return result.data;
}

/**
 * Parse `data` against `schema`. Returns `null` instead of throwing when
 * validation fails — useful for optional/best-effort parsing.
 */
export function parseWithOrNull<T>(
  schema: z.ZodType<T>,
  schemaName: string,
  data: unknown,
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(
      `[schemas] Soft validation failed for ${schemaName}: ${result.error.message}`,
      { issues: result.error.issues, data },
    );
    return null;
  }
  return result.data;
}
