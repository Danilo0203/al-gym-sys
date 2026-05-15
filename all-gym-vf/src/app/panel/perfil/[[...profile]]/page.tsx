import { Suspense } from "react";
import ProfileWrapper from "@/features/profile/components/profile-wrapper";
import { ProfileSkeleton } from "@/features/profile/components/profile-skeleton";

export const metadata = {
  title: "Panel: Perfil",
};

export default async function Page() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileWrapper />
    </Suspense>
  );
}
