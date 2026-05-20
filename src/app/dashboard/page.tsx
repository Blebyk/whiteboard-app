import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import DashboardClient from '@/components/dashboard/DashboardClient';

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return <DashboardClient user={user} />;
}
