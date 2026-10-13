import { redirect } from "@/i18n/navigation";

/** Clerk's default sign-in path: our own page is /login. */
export default async function Page({ params }: PageProps<"/[locale]/sign-in/[[...sign-in]]">) {
  const { locale } = await params;
  redirect({ href: "/login", locale });
}
