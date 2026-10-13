import { RoomGuard } from "@/modules/permissions/components/room-guard";

/** Closed for members without the room's view permission. */
export default async function RoomLayout({ children, params }: LayoutProps<"/[locale]/c/[companySlug]/marketing">) {
  const { companySlug } = await params;
  return (
    <RoomGuard companySlug={companySlug} room="marketing">
      {children}
    </RoomGuard>
  );
}
