"use client";

import { ArrowLeft, ArrowRight, BookOpen, Briefcase, Check, ChevronDown, Clock, Crown, GraduationCap, Handshake, PlayCircle, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { courseMinutes, courses, guides, type Course, type Level, type Track } from "../mock";

const trackIcons: Record<Track, LucideIcon> = { owner: Crown, employee: Briefcase, client: Handshake };

const levelStyle: Record<Level, string> = {
  beginner: "bg-success-container text-success",
  intermediate: "bg-primary-fixed text-primary",
  advanced: "bg-tertiary-fixed text-tertiary",
};

type Filter = Track | "all";

/** Al Maqr Academy — "your compass": learning tracks by role, courses with lessons, and hands-on guides. */
export function AcademyView() {
  const t = useTranslations("compass");
  const locale = useLocale() as "ar" | "en";
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;
  const [filter, setFilter] = useState<Filter>("all");
  const [openCourse, setOpenCourse] = useState<string | null>(null);
  // TODO(backend): persist lesson progress per user
  const [done, setDone] = useState<string[]>([]);

  const visible = filter === "all" ? courses : courses.filter((c) => c.track === filter);
  const lessonCount = courses.reduce((sum, c) => sum + c.lessons.length, 0);
  const totalMinutes = courses.reduce((sum, c) => sum + courseMinutes(c), 0);

  const toggleLesson = (id: string) => setDone((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="flex flex-col gap-16">
      {/* Stats */}
      <dl className="mx-auto grid w-full max-w-3xl grid-cols-3 gap-4">
        {[
          ["courses", courses.length],
          ["lessons", lessonCount],
          ["hours", Math.round(totalMinutes / 60)],
        ].map(([key, value]) => (
          <div key={key} className="rounded-lg bg-surface-container-lowest p-5 text-center shadow-ambient ghost-border">
            <dd className="text-3xl font-black text-primary">{value}</dd>
            <dt className="mt-1 text-sm text-on-surface-variant">{t(`stats.${key}`)}</dt>
          </div>
        ))}
      </dl>

      {/* Tracks */}
      <section className="flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold sm:text-3xl">{t("tracks.title")}</h2>
          <p className="mt-2 text-on-surface-variant">{t("tracks.subtitle")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {(["owner", "employee", "client"] as const).map((track) => {
            const Icon = trackIcons[track];
            const active = filter === track;
            const count = courses.filter((c) => c.track === track).length;
            return (
              <button
                key={track}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(active ? "all" : track)}
                className={cn(
                  "flex items-start gap-4 rounded-xl p-5 text-start shadow-ambient transition",
                  active ? "bg-inverse-surface text-inverse-on-surface ring-2 ring-secondary-container" : "bg-surface-container-lowest ghost-border hover:-translate-y-0.5",
                )}
              >
                <span className={cn("grid size-12 shrink-0 place-items-center rounded-md", active ? "bg-secondary-container text-on-secondary-container" : "bg-primary-fixed text-primary")}>
                  <Icon className="size-6" aria-hidden />
                </span>
                <span>
                  <span className={cn("block text-lg font-extrabold", active && "text-white")}>{t(`tracks.${track}.title`)}</span>
                  <span className={cn("mt-1 block text-sm", active ? "text-white/70" : "text-on-surface-variant")}>{t(`tracks.${track}.desc`)}</span>
                  <span className={cn("mt-2 block text-xs font-semibold", active ? "text-secondary-container" : "text-tertiary")}>{t("tracks.count", { count })}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Courses */}
      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-2xl font-extrabold">
            <GraduationCap className="size-6 text-tertiary" aria-hidden />
            {filter === "all" ? t("courses.all") : t("courses.forTrack", { track: t(`tracks.${filter}.title`) })}
          </h2>
          {filter !== "all" && (
            <button type="button" onClick={() => setFilter("all")} className="text-sm font-semibold text-primary hover:underline">
              {t("courses.showAll")}
            </button>
          )}
        </div>
        <ul className="grid items-start gap-4 lg:grid-cols-2">
          {visible.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              open={openCourse === course.id}
              onToggle={() => setOpenCourse((prev) => (prev === course.id ? null : course.id))}
              done={done}
              onToggleLesson={toggleLesson}
            />
          ))}
        </ul>
      </section>

      {/* Hands-on guides */}
      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-2xl font-extrabold">{t("guides.title")}</h2>
          <p className="mt-1 text-on-surface-variant">{t("guides.subtitle")}</p>
        </div>
        <ul className="grid gap-4 md:grid-cols-3">
          {guides.map((guide) => (
            <li key={guide.id}>
              <Link href={guide.href} className="group flex items-center gap-4 rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border hover:bg-primary-fixed/40">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-on-primary">
                  <PlayCircle className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{guide.title[locale]}</span>
                  <span className="block text-xs text-muted">{guide.description[locale]}</span>
                </span>
                <Arrow className="size-4 text-primary transition-transform group-hover:-translate-x-1 ltr:group-hover:translate-x-1" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="rounded-xl bg-brand-gradient px-6 py-10 text-center text-on-primary shadow-ambient-lg">
        <h2 className="text-2xl font-extrabold sm:text-3xl">{t("cta.title")}</h2>
        <p className="mt-2 text-on-primary/80">{t("cta.subtitle")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className={buttonVariants({ variant: "gold", size: "lg" })}>
            {t("cta.signup")}
          </Link>
          <Link href="/pricing" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20")}>
            {t("cta.pricing")}
          </Link>
        </div>
      </section>
    </div>
  );
}

function CourseCard({
  course,
  open,
  onToggle,
  done,
  onToggleLesson,
}: {
  course: Course;
  open: boolean;
  onToggle: () => void;
  done: string[];
  onToggleLesson: (id: string) => void;
}) {
  const t = useTranslations("compass");
  const locale = useLocale() as "ar" | "en";
  const finished = course.lessons.filter((l) => done.includes(l.id)).length;
  const progress = Math.round((finished / course.lessons.length) * 100);
  const listId = `lessons-${course.id}`;

  return (
    <li className="flex flex-col rounded-lg bg-surface-container-lowest p-5 shadow-ambient ghost-border">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={cn("rounded-full px-2.5 py-1 font-bold", levelStyle[course.level])}>{t(`levels.${course.level}`)}</span>
        <span className="rounded-full bg-surface-container-low px-2.5 py-1 text-on-surface-variant">{t(`tracks.${course.track}.title`)}</span>
      </div>
      <h3 className="mt-3 text-lg font-extrabold">{course.title[locale]}</h3>
      <p className="mt-1 text-sm leading-6 text-on-surface-variant">{course.description[locale]}</p>

      <div className="mt-4 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <BookOpen className="size-3.5" aria-hidden />
          {t("courses.lessons", { count: course.lessons.length })}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5" aria-hidden />
          {t("courses.minutes", { count: courseMinutes(course) })}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={t("courses.progress")}>
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs font-semibold text-on-surface-variant">{progress}%</span>
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={listId}
        className="mt-4 flex h-10 items-center justify-center gap-2 rounded-sm bg-primary text-sm font-bold text-on-primary hover:brightness-110"
      >
        {t(open ? "courses.hide" : finished > 0 ? "courses.continue" : "courses.start")}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <ol id={listId} className="mt-4 flex flex-col gap-1">
          {course.lessons.map((lesson, index) => {
            const checked = done.includes(lesson.id);
            return (
              <li key={lesson.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => onToggleLesson(lesson.id)}
                  className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-start transition-colors", checked ? "bg-success-container/60" : "hover:bg-surface-container-low")}
                >
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold", checked ? "bg-success text-white" : "bg-surface-container text-on-surface-variant")}>
                    {checked ? <Check className="size-4" aria-hidden /> : index + 1}
                  </span>
                  <span className={cn("flex-1 text-sm", checked && "text-on-surface-variant line-through decoration-success/40")}>{lesson.title[locale]}</span>
                  <span className="shrink-0 text-xs text-muted">{t("courses.minutes", { count: lesson.minutes })}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </li>
  );
}
