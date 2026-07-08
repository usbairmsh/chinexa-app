import { Playfair_Display, Inter } from "next/font/google";

export const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
  // 800/900 dropped — no font-extrabold/font-black usage anywhere in the app
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
