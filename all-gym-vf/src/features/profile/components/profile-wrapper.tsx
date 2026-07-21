import ProfileViewPage from "./profile-view-page";
import { getCurrentUser } from "../actions/profile-actions";
import { redirect } from "next/navigation";

export default async function ProfileWrapper() {
  const { data: user, success, error } = await getCurrentUser();

  if (!success && error === "Usuario no autenticado") {
    redirect("/iniciar-sesion");
  }

  if (!success || !user) {
    throw new Error(error || "No fue posible cargar el perfil.");
  }

  return <ProfileViewPage user={user} />;
}
