import { Metadata, ResolvingMetadata } from 'next';
import { getCampaign } from '../../../lib/contractClient';
import { stroopsToXlm } from '../../../types';
import CauseDetailClient from './CauseDetailClient';

interface PageProps {
  params: { id: string };
}

export default function CauseDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { campaign: fetchedCampaign, isLoading, error, notFound } = useCampaign(id);

  // Local copy for optimistic vote updates
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [userWalletAddress, setUserWalletAddress] = useState<string | null>(null);
  const [userVote, setUserVote] = useState<Vote | undefined>(undefined);
  const [isVoting, setIsVoting] = useState(false);
  const [voteCounts, setVoteCounts] = useState({ upvotes: 0, downvotes: 0, totalVotes: 0 });
  const { showError, showSuccess, showWarning } = useToast();

  useEffect(() => {
    if (fetchedCampaign) setCampaign(fetchedCampaign);
  }, [fetchedCampaign]);

  useEffect(() => {
    if (!userWalletAddress || !campaign) return;
    const existing = stellarVotingService.getUserVote(String(campaign.id), userWalletAddress);
    if (existing) {
      setUserVote({
        campaignId: String(campaign.id),
        voter: userWalletAddress,
        voteType: existing.voteType,
        timestamp: existing.timestamp,
        transactionHash: 'mock-hash',
      });
    }
  }, [userWalletAddress, campaign]);

  const handleWalletConnected = (publicKey: string) => setUserWalletAddress(publicKey);
  const handleWalletDisconnected = () => {
    setUserWalletAddress(null);
    setUserVote(undefined);
  };

  const handleVote = async (campaignId: number, voteType: 'upvote' | 'downvote') => {
    if (!userWalletAddress) {
      showWarning('Please connect your wallet first.');
      return;
    }
    const id = String(campaignId);
    if (stellarVotingService.hasUserVoted(id, userWalletAddress)) {
      showWarning('You have already voted on this cause.');
      return;
    }
    setIsVoting(true);
    try {
      const transactionHash = await stellarVotingService.castVote(id, voteType, userWalletAddress);
      const newVote: Vote = {
        campaignId: id,
        voter: userWalletAddress,
        voteType,
        timestamp: new Date(),
        transactionHash,
      };
      setUserVote(newVote);
      setVoteCounts((prev) => ({
        upvotes: voteType === 'upvote' ? prev.upvotes + 1 : prev.upvotes,
        downvotes: voteType === 'downvote' ? prev.downvotes + 1 : prev.downvotes,
        totalVotes: prev.totalVotes + 1,
      }));
      showSuccess('Your vote has been cast successfully.');
    } catch (error) {
      showError(parseContractError(error));
    } finally {
      setIsVoting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render states
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="animate-pulse space-y-6">
            <div className="h-5 bg-zinc-200 dark:bg-zinc-700 rounded w-48" />
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 space-y-4">
              <div className="h-8 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4" />
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-full" />
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-5/6" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 h-20" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
        <main className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
            Failed to load cause
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">{error}</p>
          <Link
            href="/causes"
            className="px-6 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors"
          >
            ← Back to Causes
          </Link>
        </main>
      </div>
    );
  }
}

export default function Page({ params }: PageProps) {
  return <CauseDetailClient id={params.id} />;
}
