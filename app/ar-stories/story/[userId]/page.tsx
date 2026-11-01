import StoryViewer from "@/components/ar-stories/StoryViewer";

export default async function StoryPage({ params, searchParams }: PageProps<"/ar-stories/story/[userId]">) {
  const { userId } = await params;
  const { s } = await searchParams;
  return <StoryViewer userId={userId} startId={typeof s === "string" ? s : undefined} />;
}
