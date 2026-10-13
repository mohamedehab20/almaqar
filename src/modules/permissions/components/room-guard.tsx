import { ShieldX } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getRoomAccess } from "../queries";

/** Shown instead of a room (or page) the member has no permission for. */
export function NoAccess({ companySlug }: { companySlug: string }) {
  const t = useTranslations("permissions.noAccess");
  return (
    <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto p-6">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-xl bg-surface-container-lowest p-8 text-center shadow-ambient">
        <span className="grid size-16 place-items-center rounded-full bg-danger/10 text-danger">
          <ShieldX className="size-8" aria-hidden />
        </span>
        <h2 className="text-2xl font-black">{t("title")}</h2>
        <p className="text-on-surface-variant">{t("body")}</p>
        <Link href={`/c/${companySlug}`} className="font-semibold text-primary hover:underline">
          {t("back")}
        </Link>
      </div>
    </div>
  );
}

/**
 * Wraps a room's pages: a signed-in member without the room's `.view` permission gets NoAccess.
 * The public demo stays open. The server still checks every action on its own.
 */
export async function RoomGuard({ companySlug, room, children }: { companySlug: string; room: string; children: React.ReactNode }) {
  const access = await getRoomAccess(companySlug);
  if (access && !access.rooms.includes(room)) return <NoAccess companySlug={companySlug} />;
  return children;
}
