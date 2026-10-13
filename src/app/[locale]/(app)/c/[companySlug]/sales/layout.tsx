import { RoomGuard } from "@/modules/permissions/components/room-guard";

/** Closed for members without the room's view permission. */
export default async function RoomLayout({ children, params }: LayoutProps<"/[locale]/c/[companySlug]/sales">) {
  const { companySlug } = await params;
  return (
    <RoomGuard companySlug={companySlug} room="sales">
      {children}
    </RoomGuard>
  );
}
