import StoryViewer from '@/components/StoryViewer';

export default async function StoryPage({ params, searchParams }) {
  const { userId } = await params;
  const { s } = await searchParams;
  return <StoryViewer userId={userId} startId={s} />;
}
