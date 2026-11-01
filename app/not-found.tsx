import { IDontKnow } from "@/components/ui";
import { getLang } from "@/lib/lang-server";

export default async function NotFound() {
  const lang = await getLang();
  return <IDontKnow lang={lang} title="Page not found" body="That page does not exist. Try a search." />;
}
