import { ImageResponse } from 'next/og';
import { getCampaign } from '@/lib/contractClient';
import { CATEGORY_LABELS, stroopsToXlm } from '@/types';

export const runtime = 'edge';
export const revalidate = 300; // Cache for 5 minutes
export const alt = 'Campaign Details';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const campaign = await getCampaign(Number(id));
    
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    const raised = stroopsToXlm(campaign.amount_raised);
    const goal = stroopsToXlm(campaign.funding_goal);
    const fundingPct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
    const categoryLabel = CATEGORY_LABELS[campaign.category] ?? 'Other';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            backgroundColor: '#fafafa',
            padding: '80px',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  backgroundColor: '#fbbf24',
                  color: '#78350f',
                  padding: '8px 20px',
                  borderRadius: '12px',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {categoryLabel}
              </div>
              {campaign.is_verified && (
                <div
                  style={{
                    backgroundColor: '#10b981',
                    color: 'white',
                    padding: '8px 20px',
                    borderRadius: '12px',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  ✓ Verified
                </div>
              )}
            </div>

            <h1
              style={{
                fontSize: '64px',
                fontWeight: 'bold',
                color: '#18181b',
                lineHeight: 1.2,
                margin: 0,
                maxWidth: '1000px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {campaign.title}
            </h1>
          </div>

          {/* Stats */}
          <div
            style={{
              display: 'flex',
              gap: '40px',
              width: '100%',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  fontSize: '28px',
                  color: '#71717a',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Raised
              </div>
              <div
                style={{
                  fontSize: '56px',
                  fontWeight: 'bold',
                  color: '#18181b',
                }}
              >
                {raised.toLocaleString()} XLM
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  fontSize: '28px',
                  color: '#71717a',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Goal
              </div>
              <div
                style={{
                  fontSize: '56px',
                  fontWeight: 'bold',
                  color: '#18181b',
                }}
              >
                {goal.toLocaleString()} XLM
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  fontSize: '28px',
                  color: '#71717a',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Progress
              </div>
              <div
                style={{
                  fontSize: '56px',
                  fontWeight: 'bold',
                  color: '#10b981',
                }}
              >
                {fundingPct}%
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              fontSize: '32px',
              fontWeight: 'bold',
              color: '#18181b',
            }}
          >
            <span style={{ fontSize: '48px' }}>💜</span>
            ProofOfHeart
          </div>
        </div>
      ),
      {
        ...size,
      }
    );
  } catch (error) {
    // Fallback image if campaign not found
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fafafa',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              color: '#18181b',
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
            }}
          >
            <span style={{ fontSize: '96px' }}>💜</span>
            ProofOfHeart
          </div>
          <div
            style={{
              fontSize: '36px',
              color: '#71717a',
              marginTop: '24px',
            }}
          >
            Blockchain-Powered Crowdfunding
          </div>
        </div>
      ),
      {
        ...size,
      }
    );
  }
}
