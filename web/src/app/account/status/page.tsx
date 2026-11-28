import { redirect } from "next/navigation";

/** Status page redirects to My Details (player path). */
export default function AccountStatusRedirect() {
  redirect("/account/details");
}
