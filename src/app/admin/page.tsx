import AdminDashboardClient from './AdminDashboardClient';
import { getAdmin, getPlatformFee } from '@/lib/contractClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  let initialAdminAddress: string | null = null;
  let initialPlatformFee: number | null = null;

  try {
    initialAdminAddress = await getAdmin();
  } catch {
    initialAdminAddress = null;
  }

  try {
    initialPlatformFee = await getPlatformFee();
  } catch {
    initialPlatformFee = null;
  }

  return (
    <AdminDashboardClient
      initialAdminAddress={initialAdminAddress}
      initialPlatformFee={initialPlatformFee}
    />
  );
}
