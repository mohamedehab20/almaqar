import { RoomGuard } from "@/modules/permissions/components/room-guard";

/** Closed for members without clients.view, and when the company turned the room off. */
export default async function RoomLayout({ children, params }: LayoutProps<"/[locale]/c/[companySlug]/clients">) {
  const { companySlug } = await params;
  return (
    <RoomGuard companySlug={companySlug} room="clients">
      {children}
    </RoomGuard>
  );
}
