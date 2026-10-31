import JoinForm from '@/components/JoinForm';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: '申请加入' };

export default async function JoinPage() {
  const user = await getCurrentUser();
  if (user) redirect('/');

  return <JoinForm />;
}
