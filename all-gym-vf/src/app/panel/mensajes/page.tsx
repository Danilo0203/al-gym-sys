import PageContainer from "@/components/layout/page-container";
import { Suspense } from "react";
import { DataTableSkeleton } from "@/components/ui/table/data-table-skeleton";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";
import { redirect } from "next/navigation";
import { MessagesListing } from "@/features/messages/components/messages-listing";
import { CreateMessageButton } from "@/features/messages/components/create-message-button";

export const metadata = {
  title: "Panel: Mensajes",
};

export default async function MessagesPage() {
  const access = await getUserAccessContext();
  if (!access.isAuthenticated) redirect("/iniciar-sesion");
  if (!hasPermission(access, "messages.view")) redirect("/panel");

  return (
    <PageContainer
      scrollable={false}
      pageTitle="Mensajes"
      pageDescription="Administración de plantillas de mensajes para WhatsApp"
      pageHeaderAction={hasPermission(access, "messages.create") ? <CreateMessageButton /> : null}
    >
      <Suspense fallback={<DataTableSkeleton columnCount={2} rowCount={5} />}>
        <MessagesListing />
      </Suspense>
    </PageContainer>
  );
}
