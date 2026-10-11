import Image from "next/image";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/layout/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

type AuthSplitLayoutProps = {
  image: string;
  panelTitle: string;
  panelText: string;
  children: React.ReactNode;
};

/** Form on the start side, full-height photo panel on the end side (hidden on small screens). */
export function AuthSplitLayout({ image, panelTitle, panelText, children }: AuthSplitLayoutProps) {
  const t = useTranslations("auth.common");

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,42%)]">
      <section className="flex flex-col items-center justify-center gap-8 px-4 py-10 sm:px-6">
        <Logo className="text-xl" />
        <div className="w-full max-w-md">{children}</div>
        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-on-surface-variant">
          <a href="#" className="hover:text-primary">{t("support")}</a>
          <LocaleSwitcher />
          <a href="#" className="hover:text-primary">{t("privacy")}</a>
        </nav>
      </section>

      <aside className="relative hidden overflow-hidden lg:block">
        <Image src={image} alt="" fill priority sizes="42vw" className="object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(0,32,96,0.85)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-on-primary">
          <h2 className="text-4xl font-extrabold">{panelTitle}</h2>
          <p className="mt-2 text-lg text-on-primary/85">{panelText}</p>
        </div>
      </aside>
    </main>
  );
}
