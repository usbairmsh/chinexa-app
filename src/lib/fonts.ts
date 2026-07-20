import { Fraunces, Manrope } from "next/font/google";

// Fraunces — bold, high-contrast display serif for headings. Heavier and
// more attention-grabbing than the previous Playfair Display; 800 is loaded
// so headings can genuinely go bold/extrabold, not just semibold.
export const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
});

// Manrope — geometric sans for body/UI text. Reads bold and clean at every
// weight, replacing Inter for a more confident, higher-visibility feel
// across nav, buttons, and body copy.
export const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});
