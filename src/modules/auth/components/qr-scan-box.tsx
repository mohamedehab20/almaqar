"use client";

import { Camera, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Mode = "idle" | "camera" | "image";

/**
 * Lets a visitor pick a QR image or open the camera.
 * Decoding the QR is not wired yet (needs a decoder library + backend check).
 */
export function QrScanBox({ onMessage }: { onMessage: (message: string) => void }) {
  const t = useTranslations("auth.visitor");
  const [mode, setMode] = useState<Mode>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => stopCamera, []);
  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onMessage(t("cameraUnavailable"));
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setMode("camera");
      // The <video> is always mounted, so the ref is available here
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setMode("idle");
      onMessage(t("cameraFailed"));
    }
  };

  const pickImage = (file: File | undefined) => {
    if (!file) return;
    stopCamera();
    setImageUrl(URL.createObjectURL(file));
    setMode("image");
    onMessage(t("imageSelected"));
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-md border-2 border-dashed border-outline-variant/70 bg-surface-container-low p-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => pickImage(event.target.files?.[0])}
      />

      <div className="relative size-48 overflow-hidden rounded-md bg-surface-container-lowest shadow-ambient">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn("absolute inset-0 size-full object-cover", mode !== "camera" && "hidden")}
        />
        {mode === "image" && imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img src={imageUrl} alt={t("qrPreviewAlt")} className="absolute inset-0 size-full object-contain p-3" />
        )}
        {mode === "idle" && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label={t("chooseImage")}
            className="grid size-full place-items-center border-t-4 border-primary-container/40 text-primary-container/40 transition hover:text-primary-container/70"
          >
            <QrCode className="size-28" strokeWidth={1.5} aria-hidden />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm font-semibold">
        <button
          type="button"
          onClick={openCamera}
          aria-label={t("openCamera")}
          className="grid size-9 place-items-center rounded-full hover:bg-surface-container"
        >
          <Camera className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className="hover:text-primary">
          {t("scan")}
        </button>
      </div>
    </div>
  );
}
