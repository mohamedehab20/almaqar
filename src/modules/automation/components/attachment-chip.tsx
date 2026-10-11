"use client";

import { FileSpreadsheet, FileText, File as FileIcon, X } from "lucide-react";
import type { WorkflowAttachment } from "../workflows";

export const isImage = (type: string) => type.startsWith("image/");

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocIcon({ type, name }: { type: string; name: string }) {
  if (type === "application/pdf" || /\.(docx?|txt)$/i.test(name)) return <FileText className="size-6 text-danger" aria-hidden />;
  if (/\.(xlsx?|csv)$/i.test(name)) return <FileSpreadsheet className="size-6 text-success" aria-hidden />;
  return <FileIcon className="size-6 text-muted" aria-hidden />;
}

/** One attached file: image thumbnail or document icon, name and size. Opens the file in a new tab. */
export function AttachmentChip({
  attachment,
  onRemove,
  removeLabel,
}: {
  attachment: WorkflowAttachment;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <div className="relative flex w-48 items-center gap-3 rounded-md bg-surface-container-lowest p-2 ghost-border">
      <a href={attachment.url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-3 hover:text-primary">
        {isImage(attachment.type) ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview of a user-picked file
          <img src={attachment.url} alt="" className="size-12 shrink-0 rounded-sm object-cover" />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-sm bg-surface-container-low">
            <DocIcon type={attachment.type} name={attachment.name} />
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold" dir="auto" title={attachment.name}>
            {attachment.name}
          </span>
          <span className="block font-mono text-[10px] text-muted" dir="ltr">
            {formatSize(attachment.size)}
          </span>
        </span>
      </a>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          title={removeLabel}
          className="absolute -end-2 -top-2 grid size-6 place-items-center rounded-full bg-danger text-white shadow-ambient hover:brightness-110"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
