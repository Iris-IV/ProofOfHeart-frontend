import { Cause } from '../types';

export const mockCauses: Cause[] = [
  {
    id: '1',
    title: 'Clean Water for Rural Communities',
    description:
      'Providing clean water access to 500 families in rural areas affected by drought. This cause aims to install sustainable water filtration systems and educate communities on water conservation techniques.',
    creator: 'GABC123456789012345678901234567890123456789012345678901234567890',
    createdAt: new Date('2024-01-15'),
    upvotes: 45,
    downvotes: 12,
    totalVotes: 57,
    status: 'approved',
    category: 'environment',
    targetAmount: 10000,
    currentAmount: 6500,
  },
  {
    id: '2',
    title: 'Education Technology for Underprivileged Children',
    description:
      'Equipping schools in low-income areas with tablets and educational software to bridge the digital divide and provide equal learning opportunities to every child.',
    creator: 'GDEF123456789012345678901234567890123456789012345678901234567890',
    createdAt: new Date('2024-01-20'),
    upvotes: 23,
    downvotes: 8,
    totalVotes: 31,
    status: 'pending',
    category: 'education',
    targetAmount: 5000,
    currentAmount: 1200,
  },
  {
    id: '3',
    title: 'Medical Supplies for Remote Clinics',
    description:
      'Delivering essential medical supplies and equipment to clinics in remote areas with limited healthcare access, ensuring that every person can receive basic medical attention.',
    creator: 'GHIJ123456789012345678901234567890123456789012345678901234567890',
    createdAt: new Date('2024-01-25'),
    upvotes: 67,
    downvotes: 15,
    totalVotes: 82,
    status: 'approved',
    category: 'healthcare',
    targetAmount: 15000,
    currentAmount: 8900,
  },
  {
    id: '4',
    title: 'Reforestation of Degraded Lands',
    description:
      'Planting 100,000 trees across deforested regions to restore ecosystems, improve air quality, and provide sustainable livelihoods for local farming communities.',
    creator: 'GKLM123456789012345678901234567890123456789012345678901234567890',
    createdAt: new Date('2024-02-01'),
    upvotes: 38,
    downvotes: 5,
    totalVotes: 43,
    status: 'approved',
    category: 'environment',
    targetAmount: 8000,
    currentAmount: 3200,
  },
  {
    id: '5',
    title: 'Mental Health Support for Youth',
    description:
      'Building free counselling and mental health resource centers for teenagers and young adults in underserved urban neighborhoods.',
    creator: 'GNOP123456789012345678901234567890123456789012345678901234567890',
    createdAt: new Date('2024-02-10'),
    upvotes: 14,
    downvotes: 3,
    totalVotes: 17,
    status: 'pending',
    category: 'healthcare',
    targetAmount: 6000,
    currentAmount: 900,
  },
  {
    id: '6',
    title: 'Solar Energy for Off-Grid Villages',
    description:
      'Installing solar panels and battery storage in 20 villages currently without electricity, enabling access to light, communication, and refrigeration for food/medicine.',
    creator: 'GQRS123456789012345678901234567890123456789012345678901234567890',
    createdAt: new Date('2024-02-15'),
    upvotes: 91,
    downvotes: 7,
    totalVotes: 98,
    status: 'approved',
    category: 'environment',
    targetAmount: 20000,
    currentAmount: 17500,
  },
];

export const getCauseById = (id: string): Cause | undefined =>
  mockCauses.find((c) => c.id === id);

export const CATEGORIES = ['all', 'environment', 'education', 'healthcare'] as const;
export const STATUSES = ['all', 'pending', 'approved', 'rejected'] as const;
export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'most_voted', label: 'Most Voted' },
  { value: 'most_funded', label: 'Most Funded' },
  { value: 'approval_rate', label: 'Highest Approval' },
] as const;
