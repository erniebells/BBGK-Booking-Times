import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateMemberDetails } from "@/actions/admin";
import MemberEditForm from "@/components/MemberEditForm";
import type { ActionResult } from "@/actions/auth";

export default async function AdminMemberEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");
  
  const { id } = await params;
  const member = await prisma.user.findUnique({
    where: { id, role: "MEMBER" },
  });

  if (!member) redirect("/admin/members");

  async function handleUpdate(
    memberId: string,
    _prev: ActionResult | null,
    formData: FormData,
  ): Promise<ActionResult> {
    "use server";
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const status = String(formData.get("status") || "ACTIVE") as AccountStatus;

    return updateMemberDetails(memberId, {
      name,
      email,
      status,
    });
  }

  return (
    <MemberEditForm
      member={{
        id: member.id,
        name: member.name,
        email: member.email,
        membershipNumber: member.membershipNumber,
        status: member.status,
      }}
      onUpdate={handleUpdate}
    />
  );
}
