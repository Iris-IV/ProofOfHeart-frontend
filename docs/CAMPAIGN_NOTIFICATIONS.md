# Campaign Expiry Notification System

## Overview

The campaign expiry notification system sends email notifications to campaign creators when their campaign is approaching its deadline (48 hours before expiration). This helps creators take action to extend their campaign or promote it before it expires.

## Architecture

### Components

1. **Notification Library** (`src/lib/campaignNotifications.ts`)
   - Core logic for detecting expiring campaigns
   - Helper functions for time calculations
   - Webhook integration for sending notifications

2. **API Endpoint** (`src/app/api/campaigns/notify-expiring/route.ts`)
   - HTTP endpoint for triggering notification checks
   - Authentication via `CRON_SECRET` header
   - In-memory tracking of notified campaigns (demo mode)

3. **Webhook Integration**
   - Uses existing `CREATOR_EMAIL_WEBHOOK_URL` environment variable
   - Sends structured payload with campaign details

## Configuration

### Environment Variables

```env
# Webhook URL for sending email notifications
CREATOR_EMAIL_WEBHOOK_URL=https://your-webhook-endpoint.com

# Secret for authenticating cron job requests
CRON_SECRET=your-secret-here
```

### Warning Window

The system checks for campaigns expiring within **48 hours** of the current time. This can be adjusted by modifying `HOURS_BEFORE_DEADLINE` in `src/lib/campaignNotifications.ts`.

## Usage

### Manual Testing

```bash
# Trigger notification check (requires authentication)
curl -X POST https://your-domain.com/api/campaigns/notify-expiring \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Health check
curl https://your-domain.com/api/campaigns/notify-expiring
```

### Cron Job Setup

Set up a cron job to run the notification check periodically (e.g., every hour):

```cron
# Run every hour
0 * * * * curl -X POST https://your-domain.com/api/campaigns/notify-expiring \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Notification Payload

The webhook receives the following payload:

```json
{
  "event": "campaign_expiry_warning",
  "campaignId": 1,
  "campaignTitle": "My Campaign",
  "creatorAddress": "GABC...",
  "hoursRemaining": 24,
  "amountRaised": "50000000",
  "fundingGoal": "100000000",
  "fundingPercentage": 50,
  "deadline": 1700000000,
  "source": "proof_of_heart_frontend",
  "timestamp": "2023-11-14T12:00:00.000Z"
}
```

## Deduplication

### Current Implementation (Demo Mode)

The current implementation uses an in-memory `Set` to track notified campaigns. This works for demo purposes but has limitations:

- **Not persistent**: Tracking is lost on server restart
- **Not scalable**: In-memory storage doesn't work across multiple instances
- **Not reliable**: No retry mechanism for failed notifications

### Production Recommendations

For production use, implement one of the following:

#### Option 1: Database Tracking

Store notification records in a database:

```sql
CREATE TABLE campaign_notifications (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL,
  notified_at TIMESTAMP DEFAULT NOW(),
  deadline_warning_hours INTEGER DEFAULT 48,
  UNIQUE(campaign_id, deadline_warning_hours)
);
```

#### Option 2: Redis

Use Redis for fast, scalable tracking:

```typescript
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

async function markAsNotified(campaignId: number): Promise<void> {
  await redis.setex(`campaign:${campaignId}:notified:48h`, 86400 * 3, "1");
}

async function wasNotified(campaignId: number): Promise<boolean> {
  return (await redis.exists(`campaign:${campaignId}:notified:48h`)) === 1;
}
```

#### Option 3: Message Queue

Use a message queue (e.g., RabbitMQ, SQS) for reliable delivery:

```typescript
// Queue notification instead of sending directly
await queue.add(
  "campaign-expiry-warning",
  {
    campaignId,
    webhookUrl,
    payload,
  },
  {
    attempts: 3,
    backoff: "exponential",
  },
);
```

## Campaign Selection Criteria

A campaign is selected for notification if:

1. **Within Warning Window**: Deadline is ≤ 48 hours away
2. **Not Funded**: `amount_raised < funding_goal`
3. **Not Already Notified**: Campaign ID not in tracking set
4. **Active**: Campaign is still active (not cancelled, funded, or failed)

## Error Handling

The system handles errors gracefully:

- **Individual campaign failures**: Continue processing other campaigns
- **Webhook failures**: Log error but don't crash the entire process
- **Null campaigns**: Skip campaigns that return null from contract
- **Network errors**: Return partial results with success/failure counts

## Testing

Run the test suite:

```bash
npm test -- campaignNotifications.test.ts
```

Tests cover:

- Time window calculations
- Funding percentage calculations
- Campaign filtering logic
- Webhook integration
- Error handling

## Monitoring

Monitor the notification system by:

1. Checking the health endpoint: `GET /api/campaigns/notify-expiring`
2. Reviewing logs for notification failures
3. Tracking notification counts in observability dashboard
4. Setting up alerts for high failure rates

## Future Enhancements

Potential improvements:

1. **Multiple Warning Windows**: Add 7-day, 3-day, and 24-hour warnings
2. **Push Notifications**: Integrate with push notification services
3. **Customizable Timing**: Allow creators to set their own warning preferences
4. **Analytics**: Track notification open rates and campaign extension rates
5. **Retry Logic**: Implement exponential backoff for failed webhooks
