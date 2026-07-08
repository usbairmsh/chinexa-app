export type OurStoryIcon = "Sparkles" | "Heart" | "Globe" | "Users" | "Award" | "Star" | "Shield" | "Gem";

export interface OurStoryValue {
  icon: OurStoryIcon;
  title: string;
  description: string;
}

export interface OurStoryStat {
  value: string;
  label: string;
}

export interface OurStoryContent {
  eyebrow: string;
  heading: string;
  paragraphs: string[];
  image: string;
  values_heading: string;
  values_subheading: string;
  values: OurStoryValue[];
  stats: OurStoryStat[];
}

export const DEFAULT_OUR_STORY: OurStoryContent = {
  eyebrow: "Who We Are",
  heading: "Beauty that speaks to your soul",
  paragraphs: [
    "ChineXa was born in Dhaka, Bangladesh, from a simple but powerful belief: every woman deserves access to the world's finest beauty products without compromise on quality or authenticity.",
    "Founded in 2024, we started as a small curated collection of imported skincare and quickly grew into Bangladesh's most trusted destination for premium beauty, luxury bags, exquisite jewelry, fine fragrances, and designer shoes.",
    "Our team personally sources each product from authorized distributors across Korea, Japan, France, Italy, the UK, and the USA. When you shop with ChineXa, you're not just buying a product — you're investing in authenticity, quality, and a brand that truly cares about your beauty journey.",
  ],
  image: "https://picsum.photos/seed/about-hero/800/1000",
  values_heading: "Our Values",
  values_subheading: "What drives us every single day",
  values: [
    { icon: "Sparkles", title: "Authenticity", description: "Every product is 100% genuine — sourced directly from authorized distributors and brands worldwide." },
    { icon: "Heart", title: "Passion", description: "We are passionate about beauty and dedicated to helping every woman feel her most confident self." },
    { icon: "Globe", title: "Global Reach", description: "From Korea to France, we bring the world's finest beauty products to your doorstep in Bangladesh." },
    { icon: "Users", title: "Community", description: "We're building more than a store — we're creating a community of beauty lovers who inspire each other." },
  ],
  stats: [
    { value: "300+", label: "Products" },
    { value: "10K+", label: "Happy Customers" },
    { value: "7", label: "Categories" },
    { value: "6", label: "Countries Sourced" },
  ],
};
