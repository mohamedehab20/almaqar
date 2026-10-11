"use client";

import { Link2, Link2Off, TriangleAlert, Users, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { accounts, budgets, campaigns, channels, clients, type CampaignStage } from "../sections-mock";

const fmt = (value: number) => value.toLocaleString("en-US");
const clientName = (id: string, locale: "ar" | "en") => clients.find((c) => c.id === id)?.name[locale] ?? "—";

function useLang() {
  return useLocale() as "ar" | "en";
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-lg bg-surface-container-lowest shadow-ambient ghost-border", className)}>{children}</section>;
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold", className)}>{children}</span>;
}

function Bar({ value, className = "bg-tertiary" }: { value: number; className?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-container">
      <div className={cn("h-full rounded-full", className)} style={{ width: `${Math.min(100, Math.round(value * 100))}%` }} />
    </div>
  );
}

function Money({ value }: { value: number }) {
  const t = useTranslations("marketing");
  return (
    <span className="whitespace-nowrap">
      <span dir="ltr" className="font-mono">{fmt(value)}</span> {t("currency")}
    </span>
  );
}

/* ── Clients ─────────────────────────────────────────────── */

const clientStatus = {
  active: "bg-success-container text-success",
  onboarding: "bg-primary-fixed text-primary",
  paused: "bg-surface-container text-on-surface-variant",
} as const;

export function ClientsSection() {
  const t = useTranslations("marketing.clients");
  const locale = useLang();
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface-container-low text-xs text-on-surface-variant">
            <tr>
              {(["name", "industry", "manager", "campaigns", "budget", "status"] as const).map((col) => (
                <th key={col} className="whitespace-nowrap px-5 py-3 text-start font-semibold">{t(`cols.${col}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="even:bg-surface-container-low/40 hover:bg-tertiary-fixed/40">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-tertiary-fixed font-bold text-tertiary">
                      {client.name[locale].charAt(0)}
                    </span>
                    <span className="font-semibold">{client.name[locale]}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-on-surface-variant">{client.industry[locale]}</td>
                <td className="px-5 py-4">{client.manager[locale]}</td>
                <td className="px-5 py-4 font-mono">{client.activeCampaigns}</td>
                <td className="px-5 py-4"><Money value={client.monthlyBudget} /></td>
                <td className="px-5 py-4"><Pill className={clientStatus[client.status]}>{t(`status.${client.status}`)}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ── Accounts ────────────────────────────────────────────── */

const accountStatus: Record<string, { className: string; icon: LucideIcon }> = {
  connected: { className: "bg-success-container text-success", icon: Link2 },
  attention: { className: "bg-tertiary-fixed text-tertiary", icon: TriangleAlert },
  disconnected: { className: "bg-danger-container text-danger", icon: Link2Off },
};

export function AccountsSection() {
  const t = useTranslations("marketing.accounts");
  const locale = useLang();
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {accounts.map((account) => {
        const status = accountStatus[account.status];
        const StatusIcon = status.icon;
        return (
          <li key={account.id}>
            <Card className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-tertiary" dir="ltr">{account.platform}</p>
                  <p className="mt-1 truncate font-bold" dir="ltr">{account.handle}</p>
                  <p className="mt-1 text-sm text-muted">{clientName(account.clientId, locale)}</p>
                </div>
                <Pill className={cn("items-center gap-1", status.className)}>
                  <StatusIcon className="size-3.5" aria-hidden />
                  {t(`status.${account.status}`)}
                </Pill>
              </div>
              <div className="mt-auto flex items-end justify-between border-t border-outline-variant/40 pt-3 text-sm">
                <span>
                  <span className="block text-xs text-muted">{t("followers")}</span>
                  <span className="font-mono font-semibold" dir="ltr">{account.followers ? fmt(account.followers) : "—"}</span>
                </span>
                <span className="text-end">
                  <span className="block text-xs text-muted">{t("lastActivity")}</span>
                  {account.lastPost[locale]}
                </span>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Marketing operations (campaigns) ────────────────────── */

const stageStyle: Record<CampaignStage, string> = {
  planning: "bg-surface-container text-on-surface-variant",
  running: "bg-primary-fixed text-primary",
  review: "bg-tertiary-fixed text-tertiary",
  done: "bg-success-container text-success",
};

export function CampaignsSection() {
  const t = useTranslations("marketing.campaigns");
  const locale = useLang();
  const stages: CampaignStage[] = ["planning", "running", "review", "done"];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stages.map((stage) => (
          <Card key={stage} className="p-4">
            <p className="text-sm text-on-surface-variant">{t(`stage.${stage}`)}</p>
            <p className="mt-1 text-3xl font-extrabold">{campaigns.filter((c) => c.stage === stage).length}</p>
          </Card>
        ))}
      </div>
      <ul className="flex flex-col gap-3">
        {campaigns.map((campaign) => (
          <li key={campaign.id}>
            <Card className="grid gap-4 p-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{campaign.name[locale]}</h3>
                  <Pill className={stageStyle[campaign.stage]}>{t(`stage.${campaign.stage}`)}</Pill>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {clientName(campaign.clientId, locale)} · <span dir="ltr">{campaign.channels.join(" · ")}</span>
                </p>
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-xs text-muted">
                  <span dir="ltr">{campaign.start} → {campaign.end}</span>
                  <span className="font-mono" dir="ltr">{Math.round(campaign.progress * 100)}%</span>
                </div>
                <Bar value={campaign.progress} className={campaign.stage === "done" ? "bg-success" : "bg-tertiary"} />
              </div>
              <div className="text-sm md:text-end">
                <span className="block text-xs text-muted">{t("spent")}</span>
                <Money value={campaign.spent} />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Budgets ─────────────────────────────────────────────── */

export function BudgetsSection() {
  const t = useTranslations("marketing.budgets");
  const locale = useLang();
  const allocated = budgets.reduce((sum, b) => sum + b.allocated, 0);
  const spent = budgets.reduce((sum, b) => sum + b.spent, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["allocated", allocated],
            ["spent", spent],
            ["remaining", allocated - spent],
          ] as const
        ).map(([key, value]) => (
          <Card key={key} className="p-5">
            <p className="text-sm text-on-surface-variant">{t(`summary.${key}`)}</p>
            <p className="mt-2 text-2xl font-extrabold"><Money value={value} /></p>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <h3 className="font-bold">{t("perClient")}</h3>
        <ul className="mt-4 flex flex-col gap-5">
          {budgets.map((budget) => {
            const ratio = budget.allocated ? budget.spent / budget.allocated : 0;
            const tone = ratio >= 0.9 ? "bg-danger" : ratio >= 0.7 ? "bg-secondary-container" : "bg-tertiary";
            return (
              <li key={budget.clientId}>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold">{clientName(budget.clientId, locale)}</span>
                  <span className="text-muted">
                    <Money value={budget.spent} /> / <Money value={budget.allocated} />
                    <span className="ms-2 font-mono" dir="ltr">({Math.round(ratio * 100)}%)</span>
                  </span>
                </div>
                <Bar value={ratio} className={tone} />
                {ratio >= 0.9 && <p className="mt-1 text-xs font-semibold text-danger">{t("nearLimit")}</p>}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

/* ── Channels ────────────────────────────────────────────── */

export function ChannelsSection() {
  const t = useTranslations("marketing.channels");
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {channels.map((channel) => (
        <li key={channel.platform}>
          <Card className="flex h-full flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold" dir="ltr">{channel.platform}</h3>
              <span className="flex items-center gap-1 text-xs text-muted">
                <Users className="size-3.5" aria-hidden />
                {t("campaigns", { count: channel.campaigns })}
              </span>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-xs">
              {(
                [
                  ["reach", fmt(channel.reach)],
                  ["costPerResult", channel.costPerResult.toFixed(1)],
                  ["conversion", `${channel.conversion}%`],
                ] as const
              ).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-muted">{t(key)}</dt>
                  <dd className="mt-1 font-mono text-sm font-semibold text-primary" dir="ltr">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-auto">
              <div className="mb-1.5 flex justify-between text-xs text-muted">
                <span>{t("spendShare")}</span>
                <span className="font-mono" dir="ltr">{Math.round(channel.spendShare * 100)}%</span>
              </div>
              <Bar value={channel.spendShare} />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
