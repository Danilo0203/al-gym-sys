"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import { getUsers, type UserData } from "@/features/users/actions/user-actions";
import { UsersTable } from "./users-table";
import { toast } from "sonner";
import { subscribeAdminRefresh } from "@/lib/admin-refresh";

interface UserListingProps {
  canUpdateUsers: boolean;
}

export default function UserListing({ canUpdateUsers }: UserListingProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [roleNameMap, setRoleNameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const result = await getUsers();

    if (!result.success || !result.data) {
      toast.error(result.error || "Error al cargar usuarios");
      setLoading(false);
      return;
    }

    setUsers(result.data);
    setRoleNameMap(result.roleNameMap ?? {});
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => subscribeAdminRefresh("users", () => void fetchUsers()), [fetchUsers]);

  if (loading) {
    return <DataTableSkeleton columnCount={5} rowCount={8} />;
  }

  return <UsersTable data={users} roleNameMap={roleNameMap} canUpdateUsers={canUpdateUsers} />;
}
