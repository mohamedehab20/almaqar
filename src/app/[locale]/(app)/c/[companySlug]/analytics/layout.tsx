import { RoomGuard } from "@/modules/permissions/components/room-guard";

/** Closed for members without analytics.view, and when the company turned the room off. */
export default async function RoomLayout({ children, params }: LayoutProps<"/[locale]/c/[companySlug]/analytics">) {
  const { companySlug } = await params;
  return (
    <RoomGuard companySlug={companySlug} room="analytics">
      {children}
    </RoomGuard>
  );
}
