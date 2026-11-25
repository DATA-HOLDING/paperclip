import animatedHero from "../../../announcements/examples/animated/assets/78bafb6adbfd9da899cdbb5d934b4c0b9df5d419d6f0a5104a87a7b25dcc6bd8.html?raw";
import type { Announcement } from "@paperclipai/shared";
import { t } from "@/i18n";

/** Design guide / Storybook only. Never a runtime feed fallback. */
export const announcementPreview: Announcement = {
  id: "preview-work-together",
  eyebrow: t("libAnnouncementPreview.eyebrow"),
  title: t("libAnnouncementPreview.title"),
  description: t("libAnnouncementPreview.description"),
  image: { path: `assets/${"0".repeat(64)}.png`, alt: t("libAnnouncementPreview.imageAlt") },
  secondaryLink: { kind: "external", label: t("libAnnouncementPreview.learnMore"), url: "https://paperclip.ing" },
  primaryAction: { kind: "route", label: t("libAnnouncementPreview.exploreProjects"), path: "/projects" },
};

export const announcementAnimationPreview: Announcement = {
  ...announcementPreview,
  animation: { path: "assets/78bafb6adbfd9da899cdbb5d934b4c0b9df5d419d6f0a5104a87a7b25dcc6bd8.html", alt: t("libAnnouncementPreview.animationAlt") },
};
export const announcementAnimationPreviewSrc = `data:text/html;charset=utf-8,${encodeURIComponent(animatedHero)}`;
