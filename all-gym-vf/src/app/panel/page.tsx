import { getUserAccessContext } from "@/lib/auth/authorization";
import { resolvePostLoginRoute } from "@/lib/auth/role-utils";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const access = await getUserAccessContext();

  if (!access.isAuthenticated) {
    return redirect("/iniciar-sesion");
  }

  redirect(
    resolvePostLoginRoute({
      role: access.role,
      roleScope: access.roleScope,
    }),
  );
}
