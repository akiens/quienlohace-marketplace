"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/ui";
import { socialLinkSchema } from "@/lib/validation";
import type { SocialPlatform } from "@/types";
import type { SocialLinkDraft } from "./social-links-editor";

export function SocialLinksFields({
  platforms,
  value,
  onChange,
  error,
}: {
  platforms: Array<{ platform: SocialPlatform; label: string; icon: string }>;
  value: SocialLinkDraft[];
  onChange: (links: SocialLinkDraft[]) => void;
  error?: (platform: SocialPlatform) => string | undefined;
}) {
  const prefix = useId();
  const [touched, setTouched] = useState<string[]>([]);
  return (
    <div className="space-y-4">
      {platforms.map(({ platform, label, icon }) => {
        const url = value.find((link) => link.platform === platform)?.url ?? "";
        const parsed = url.trim()
          ? socialLinkSchema.safeParse({ platform, url })
          : null;
        const message =
          touched.includes(platform) && parsed && !parsed.success
            ? parsed.error.issues[0]?.message
            : error?.(platform);
        const id = `${prefix}-${platform}`;
        return (
          <div
            key={platform}
            className="grid min-w-0 gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start"
          >
            <label
              htmlFor={id}
              className="flex items-center gap-2 text-sm font-semibold text-ink sm:min-h-12"
            >
              <Icon name={icon} className="text-xl text-brand-800" />
              {label}
            </label>
            <div className="min-w-0">
              <input
                id={id}
                name={`social_${platform}`}
                type="url"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={url}
                placeholder="https://…"
                aria-invalid={Boolean(message)}
                aria-describedby={message ? `${id}-error` : undefined}
                onChange={(event) => {
                  const rest = value.filter(
                    (link) => link.platform !== platform,
                  );
                  onChange(
                    event.target.value.trim()
                      ? [...rest, { platform, url: event.target.value }]
                      : rest,
                  );
                }}
                onBlur={() =>
                  setTouched((current) =>
                    current.includes(platform)
                      ? current
                      : [...current, platform],
                  )
                }
                className={`h-12 w-full rounded-input border px-3 text-base outline-none focus:border-brand-800 ${message ? "border-[#D92D20]" : "border-line-strong"}`}
              />
              {message && (
                <p id={`${id}-error`} className="mt-1 text-sm text-[#B42318]">
                  {message}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
