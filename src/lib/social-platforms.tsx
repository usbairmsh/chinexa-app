import React from "react";

export interface SocialPlatform {
  id: string;
  name: string;
  color: string;
  placeholder: string;
  icon: React.ReactNode;
}

const iconClass = "h-4 w-4";

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    id: "facebook", name: "Facebook", color: "#1877F2", placeholder: "https://facebook.com/yourpage",
    icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="#1877F2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>,
  },
  {
    id: "instagram", name: "Instagram", color: "#E4405F", placeholder: "https://instagram.com/yourpage",
    icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="#E4405F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>,
  },
  {
    id: "whatsapp", name: "WhatsApp", color: "#25D366", placeholder: "+8801XXXXXXXXX",
    icon: <svg className={iconClass} viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>,
  },
  {
    id: "tiktok", name: "TikTok", color: "#010101", placeholder: "https://tiktok.com/@yourpage",
    icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="#010101" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>,
  },
  {
    id: "youtube", name: "YouTube", color: "#FF0000", placeholder: "https://youtube.com/@yourchannel",
    icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="#FF0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>,
  },
  {
    id: "twitter", name: "X (Twitter)", color: "#000000", placeholder: "https://x.com/yourpage",
    icon: <svg className={iconClass} viewBox="0 0 24 24" fill="#000000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  },
  {
    id: "linkedin", name: "LinkedIn", color: "#0A66C2", placeholder: "https://linkedin.com/company/yourpage",
    icon: <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="#0A66C2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>,
  },
  {
    id: "pinterest", name: "Pinterest", color: "#E60023", placeholder: "https://pinterest.com/yourpage",
    icon: <svg className={iconClass} viewBox="0 0 24 24" fill="#E60023"><path d="M12 0a12 12 0 0 0-4.373 23.178c-.01-.937-.002-2.063.235-3.082l1.715-7.261s-.426-.851-.426-2.109c0-1.975 1.145-3.45 2.571-3.45 1.213 0 1.799.91 1.799 2.002 0 1.22-.777 3.043-1.178 4.735-.335 1.416.71 2.57 2.105 2.57 2.526 0 4.22-3.244 4.22-7.091 0-2.924-1.97-5.114-5.555-5.114a6.34 6.34 0 0 0-6.608 6.399c0 1.164.344 1.985.881 2.62.247.292.282.41.192.745-.064.247-.212.843-.272 1.079-.088.341-.359.463-.661.337-1.845-.753-2.705-2.773-2.705-5.047 0-3.754 3.17-8.252 9.456-8.252 5.05 0 8.366 3.657 8.366 7.579 0 5.188-2.885 9.073-7.136 9.073-1.428 0-2.77-.773-3.229-1.649l-.912 3.627c-.327 1.181-.966 2.363-1.548 3.283A12 12 0 1 0 12 0z"/></svg>,
  },
  {
    id: "telegram", name: "Telegram", color: "#26A5E4", placeholder: "https://t.me/yourchannel",
    icon: <svg className={iconClass} viewBox="0 0 24 24" fill="#26A5E4"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.077 7.237-1.82 8.58c-.137.612-.5.762-.998.474l-2.775-2.044-1.34 1.288c-.148.148-.272.272-.558.272l.2-2.832 5.156-4.66c.224-.2-.049-.311-.348-.112l-6.376 4.014-2.746-.856c-.598-.187-.611-.598.124-.886l10.738-4.14c.498-.18.934.122.774.886z"/></svg>,
  },
  {
    id: "snapchat", name: "Snapchat", color: "#FFFC00", placeholder: "https://snapchat.com/add/yourname",
    icon: <svg className={iconClass} viewBox="0 0 24 24" fill="#FFFC00" stroke="#333" strokeWidth="0.5"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .299.063.386.103.133.065.288.16.327.313.039.154.021.393-.181.586-.275.263-.742.452-1.186.596-.272.09-.548.159-.76.217l-.087.026c-.12.037-.208.074-.236.137-.027.064-.025.143.018.317.39 1.59 1.042 2.367 1.042 2.367.15.18.166.363.133.489-.043.166-.211.334-.51.42-.35.1-.728.053-1.168.005-.227-.025-.468-.051-.715-.046-.218.002-.481.06-.76.122-.417.09-.895.193-1.422.073-.228-.052-.451-.158-.665-.265-.382-.192-.83-.418-1.503-.418-.06 0-.122.003-.184.008-.587.043-1.042.274-1.438.468a3.454 3.454 0 0 1-.618.24c-.5.121-.997.019-1.397-.068-.283-.062-.543-.12-.765-.122-.247-.005-.489.021-.715.046-.44.048-.817.095-1.168-.005-.298-.086-.467-.254-.51-.42-.033-.126-.016-.309.133-.489 0 0 .652-.778 1.042-2.367.043-.174.045-.253.018-.317-.028-.063-.116-.1-.236-.137l-.087-.026c-.212-.058-.488-.127-.76-.217-.444-.144-.911-.333-1.186-.596-.202-.193-.22-.432-.181-.586.039-.153.194-.248.327-.313.087-.04.204-.103.386-.103.12 0 .299.016.464.104.374.181.733.285 1.033.301.198 0 .326-.045.401-.09a12.98 12.98 0 0 1-.033-.57c-.104-1.628-.23-3.654.299-4.847C7.86 1.069 11.216.793 12.206.793z"/></svg>,
  },
  {
    id: "threads", name: "Threads", color: "#000000", placeholder: "https://threads.net/@yourpage",
    icon: <svg className={iconClass} viewBox="0 0 24 24" fill="#000000"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.18.408-2.285 1.33-3.11.88-.788 2.12-1.273 3.578-1.4.905-.078 1.778-.033 2.601.134.02-.69-.003-1.352-.07-1.971-.175-1.598-.622-2.304-1.778-2.562-.287-.064-.6-.098-.929-.098-1.196 0-2.235.382-2.853 1.05l-1.461-1.385C9.572 3.794 11.04 3.22 12.786 3.22c.507 0 1.003.048 1.467.143 1.992.41 3.072 1.64 3.336 3.81.09.72.122 1.51.098 2.348.47.209.9.458 1.278.752 1.03.8 1.755 1.863 2.147 3.158.554 1.832.276 4.386-1.67 6.296C17.63 21.506 15.397 22.378 12.186 24z"/></svg>,
  },
];

/** Get platform by ID */
export function getPlatform(id: string): SocialPlatform | undefined {
  return SOCIAL_PLATFORMS.find((p) => p.id === id);
}

/** Colored icon circle for footer/display */
export function SocialIconButton({ platform, href, size = 36 }: { platform: SocialPlatform; href: string; size?: number }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center justify-center rounded-full text-white hover:opacity-80 transition-opacity"
      style={{ width: size, height: size, backgroundColor: platform.color }}
      aria-label={platform.name}>
      {platform.icon}
    </a>
  );
}
