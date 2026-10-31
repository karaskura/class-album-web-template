import { redirect } from 'next/navigation';
import ActivityForm from '@/components/ActivityForm';
import { listParticipantOptions } from '@/lib/queries';
import { canPublishActivity, getViewer } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: '发布活动' };

/** 活动发布页（维护者的图6）：封面 / 标题 / 详细内容 / 勾选参加人员 / 发布者与时间自动 */
export default async function NewActivityPage() {
  const viewer = await getViewer();
  if (!viewer) return null;
  if (viewer.kind !== 'user' || !canPublishActivity(viewer.user)) redirect('/activities');

  const people = await listParticipantOptions();

  // 发布时间用北京时间（服务端算，发布者改不了）
  const today = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  return (
    <ActivityForm
      publisherName={viewer.user.name}
      today={today}
      people={people.map((person) => ({ id: person.id, name: person.name, studentNo: person.student_no }))}
      selfId={viewer.user.id}
    />
  );
}
