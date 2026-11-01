import { TripLoader } from "./TripLoader";

export default async function TripPage({ params }: PageProps<"/trip/[token]">) {
  const { token } = await params;
  return <TripLoader token={token} />;
}
