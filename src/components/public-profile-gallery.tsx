"use client";

import { useEffect, useMemo, useState } from "react";

import { Icon, SECONDARY_SURFACE } from "@/components/ui";
import type { AnalyticsEntity } from "@/domain/analytics";
import { trackAnalytics } from "@/lib/analytics/client";
import type { ProfileImage } from "@/types";

type GalleryImage = Pick<ProfileImage, "id" | "url" | "alt">;

/** Galería pública con resumen responsive y visor a pantalla completa. */
export function PublicProfileGallery({ images, analytics }: { images: GalleryImage[]; analytics?: AnalyticsEntity }) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const imageSetVersion = useMemo(() => `gallery_${images.length}_${images[0]?.id ?? "empty"}_${images.at(-1)?.id ?? "empty"}`.slice(0, 120), [images]);

  useEffect(() => {
    if (selected === null || !analytics) return;
    const image = images[selected];
    if (!image) return;
    trackAnalytics({ ...analytics, eventName: "gallery_item_viewed", observationKind: "interaction", surface: "public_gallery", properties: { imageId: image.id, position: selected + 1 } });
  }, [analytics, images, selected]);

  useEffect(() => {
    if (selected === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
      if (event.key === "ArrowLeft") {
        setSelected((current) =>
          current === null ? null : (current - 1 + images.length) % images.length,
        );
      }
      if (event.key === "ArrowRight") {
        setSelected((current) =>
          current === null ? null : (current + 1) % images.length,
        );
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [images.length, selected]);

  const hasMoreOnMobile = images.length > 4;
  const hasMoreOnDesktop = images.length > 7;
  const selectedImage = selected === null ? null : (images[selected] ?? null);

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {images.map((image, index) => {
          const collapsedVisibility =
            index >= 7 ? "hidden" : index >= 4 ? "hidden sm:block" : "";

          return (
            <button
              key={image.id}
              type="button"
              onClick={() => {
                if (analytics) trackAnalytics({ ...analytics, eventName: "gallery_opened", observationKind: "interaction", surface: "public_gallery", properties: { imageSetVersion, itemCount: images.length } });
                setSelected(index);
              }}
              aria-label={`Abrir imagen ${index + 1} de ${images.length}`}
              className={`group relative aspect-[4/3] overflow-hidden rounded-card border border-line bg-surface-muted ${
                expanded ? "" : collapsedVisibility
              } ${index === 0 ? "col-span-2" : ""} ${
                index === 0 && images.length > 2
                  ? "sm:row-span-2 sm:aspect-auto sm:min-h-[260px]"
                  : ""
              }`}
            >
              {/* `/media` ya entrega el archivo procesado desde R2. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={image.alt || `Trabajo realizado ${index + 1}`}
                loading={index === 0 ? "eager" : "lazy"}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <span className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/25 via-transparent to-transparent p-2.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-brand-800 shadow-card">
                  <Icon name="open_in_full" className="text-[17px]" />
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {hasMoreOnMobile ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className={`mt-4 flex h-10 items-center gap-1.5 rounded-input px-4 text-[14px] font-semibold ${SECONDARY_SURFACE} ${
            hasMoreOnDesktop ? "" : "sm:hidden"
          }`}
        >
          <Icon
            name={expanded ? "expand_less" : "photo_library"}
            className="text-[18px]"
          />
          {expanded ? "Mostrar menos" : `Ver las ${images.length} fotos`}
        </button>
      ) : null}

      {selected !== null && selectedImage ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Galería de trabajos"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0B1220]/95 p-3 sm:p-8"
          onClick={() => setSelected(null)}
        >
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Cerrar galería"
            className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-6 sm:top-6"
          >
            <Icon name="close" className="text-[24px]" />
          </button>

          {images.length > 1 ? (
            <>
              <GalleryControl
                label="Imagen anterior"
                icon="arrow_back"
                className="left-2 sm:left-5"
                onClick={() =>
                  setSelected((selected - 1 + images.length) % images.length)
                }
              />
              <GalleryControl
                label="Imagen siguiente"
                icon="arrow_forward"
                className="right-2 sm:right-5"
                onClick={() => setSelected((selected + 1) % images.length)}
              />
            </>
          ) : null}

          <figure
            className="flex max-h-full max-w-6xl flex-col items-center gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage.url}
              alt={selectedImage.alt || `Trabajo realizado ${selected + 1}`}
              className="max-h-[82dvh] max-w-full rounded-input object-contain shadow-pop"
            />
            <figcaption className="text-center text-[13.5px] text-white/75">
              {selectedImage.alt || "Trabajo realizado"} · {selected + 1} de{" "}
              {images.length}
            </figcaption>
          </figure>
        </div>
      ) : null}
    </>
  );
}

function GalleryControl({
  label,
  icon,
  className,
  onClick,
}: {
  label: string;
  icon: string;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 ${className}`}
    >
      <Icon name={icon} className="text-[23px]" />
    </button>
  );
}
