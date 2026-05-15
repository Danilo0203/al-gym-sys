import ProfileViewPage from "./profile-view-page";
import { getCurrentUser } from "../actions/profile-actions";
import { redirect } from "next/navigation";

export default async function ProfileWrapper() {
  const { data: user, success } = await getCurrentUser();

  if (!success || !user) {
    redirect("/iniciar-sesion");
  }

  return <ProfileViewPage user={user} />;
}
