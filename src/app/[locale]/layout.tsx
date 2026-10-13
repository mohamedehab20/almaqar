import { ClerkProvider } from "@clerk/nextjs";
import { arSA, enUS } from "@clerk/localizations";
import type { Metadata } from "next";
import { Cairo, Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeDirection, routing } from "@/i18n/routing";
import { preconnect } from "react-dom";
import { clerkEnabled, clerkFrontendHost } from "@/lib/clerk";
import "@/styles/globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: { default: t("title"), template: `%s | ${t("brand")}` },
    description: t("description"),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // Open the connection to Clerk while the page is still loading (its scripts and the sign-in form come from there)
  const clerkHost = clerkFrontendHost();
  if (clerkHost) preconnect(`https://${clerkHost}`, { crossOrigin: "anonymous" });

  return (
    <html
      lang={locale}
      dir={localeDirection[locale]}
      className={`${cairo.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <NextIntlClientProvider>
          {clerkEnabled() ? (
            // Inside <body>, as Clerk requires. Sign-in/up live on our own pages (/login, /signup).
            <ClerkProvider
              localization={locale === "ar" ? arSA : enUS}
              signInUrl={locale === "ar" ? "/login" : "/en/login"}
              signUpUrl={locale === "ar" ? "/signup" : "/en/signup"}
              appearance={{ variables: { colorPrimary: "#004ac6", fontFamily: "var(--font-cairo), var(--font-inter), sans-serif", borderRadius: "12px" } }}
            >
              {children}
            </ClerkProvider>
          ) : (
            children
          )}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
