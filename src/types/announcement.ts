export type AnnouncementType = "text" | "countdown" | "free_shipping" | "social_proof";

interface AnnouncementBase {
  id: string;
  type: AnnouncementType;
  enabled: boolean;
  /** Link the whole bar navigates to when clicked (optional). */
  link?: string;
}

export interface TextAnnouncement extends AnnouncementBase {
  type: "text";
  message: string;
}

export interface CountdownAnnouncement extends AnnouncementBase {
  type: "countdown";
  label: string; // e.g. "SUMMER SALE ENDS IN"
  /** ISO datetime string the countdown counts down to. */
  endsAt: string;
  /** What to do once endsAt has passed. */
  onExpire: "hide" | "keep_showing_zero";
}

export interface FreeShippingAnnouncement extends AnnouncementBase {
  type: "free_shipping";
  /** e.g. "Free shipping on orders over {threshold}!" — {threshold} is substituted at render time. */
  messageTemplate: string;
}

export interface SocialProofAnnouncement extends AnnouncementBase {
  type: "social_proof";
  message: string; // e.g. "⭐ 4.9/5 from 2,000+ happy customers"
}

export type Announcement =
  | TextAnnouncement
  | CountdownAnnouncement
  | FreeShippingAnnouncement
  | SocialProofAnnouncement;

export interface AnnouncementConfig {
  /** Announcements are shown one at a time; if more than one is enabled, the
   * bar rotates between them on a timer. Order in this array is display order. */
  items: Announcement[];
  /** Seconds between rotations when more than one announcement is enabled. */
  rotateSeconds: number;
}

export const DEFAULT_ANNOUNCEMENT_CONFIG: AnnouncementConfig = {
  items: [],
  rotateSeconds: 6,
};
