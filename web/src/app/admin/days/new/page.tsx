import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCloneDayPrefill } from "@/actions/admin";
import { NewPlayingDayForm } from "@/components/NewPlayingDayForm";

export default async function NewPlayingDayPage({
  searchParams,
}: {
  searchParams: Promise<{ cloneFrom?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const { cloneFrom } = await searchParams;
  const clone =
    cloneFrom && cloneFrom.trim()
      ? await getCloneDayPrefill(cloneFrom.trim())
      : null;

  return <NewPlayingDayForm clone={clone} />;
}
