import { getUsers } from "@/features/users/actions/user-actions";
import { UsersTable } from "./users-table";
import { searchParamsCache } from "@/lib/searchparams";

interface UserListingProps {
  canUpdateUsers: boolean;
  canDeleteUsers: boolean;
}

export default async function UserListing({ canUpdateUsers, canDeleteUsers }: UserListingProps) {
  const sort = searchParamsCache.get("sort");
  const role = searchParamsCache.get("role");
  const full_name = searchParamsCache.get("full_name");
  const { data: users, success, error, roleNameMap } = await getUsers({ sort, role, full_name });

  if (!success || !users) {
    return (
      <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-lg text-destructive">
        Error al cargar usuarios: {error || "Error desconocido"}
      </div>
    );
  }

  return (
    <UsersTable
      data={users}
      roleNameMap={roleNameMap ?? {}}
      canUpdateUsers={canUpdateUsers}
      canDeleteUsers={canDeleteUsers}
    />
  );
}
