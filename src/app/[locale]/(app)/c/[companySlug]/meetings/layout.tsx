import { RoomGuard } from "@/modules/permissions/components/room-guard";

/** Closed for members without the room's view permission (the Operations room's). */
export default async function RoomLayout({ children, params }: LayoutProps<"/[locale]/c/[companySlug]/meetings">) {
  const { companySlug } = await params;
  return (
    <RoomGuard companySlug={companySlug} room="meetings">
      {children}
    </RoomGuard>
  );
}
