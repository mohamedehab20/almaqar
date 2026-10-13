import { redirect } from "@/i18n/navigation";

/** Clerk's default sign-up path: our own page is /signup. */
export default async function Page({ params }: PageProps<"/[locale]/sign-up/[[...sign-up]]">) {
  const { locale } = await params;
  redirect({ href: "/signup", locale });
}
