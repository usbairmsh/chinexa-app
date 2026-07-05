import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/breadcrumb";

interface PolicySection {
  heading: string;
  body: string[];
}

interface Policy {
  title: string;
  intro: string;
  sections: PolicySection[];
}

const POLICIES: Record<string, Policy> = {
  shipping: {
    title: "Shipping Policy",
    intro: "We deliver across Bangladesh through trusted courier partners. Here is everything you need to know about how your order reaches you.",
    sections: [
      {
        heading: "Delivery Coverage & Timelines",
        body: [
          "Dhaka City: 1-2 business days.",
          "Dhaka Suburbs (Gazipur, Narayanganj, Savar, Tongi, Keraniganj): 2-3 business days.",
          "Other divisions (Chittagong, Rajshahi, Khulna, Sylhet, Rangpur, Barisal, Mymensingh): 3-7 business days depending on area.",
        ],
      },
      {
        heading: "Delivery Charges",
        body: [
          "Charges are calculated at checkout based on your delivery address.",
          "Orders above ৳3,000 qualify for free standard delivery (threshold may vary during promotions — the exact amount is always shown at checkout).",
          "Express next-day delivery is available inside Dhaka City for an additional charge.",
        ],
      },
      {
        heading: "Order Processing",
        body: [
          "Orders are processed within 24 hours of confirmation. You will receive an SMS with your order number once your order is placed.",
          "Pre-order items ship on the timeline stated on the product page.",
          "You can track your order any time from the Track Order page using your order number or phone number.",
        ],
      },
    ],
  },
  returns: {
    title: "Returns & Refunds",
    intro: "If something isn't right with your order, we'll make it right. Please review our return terms below.",
    sections: [
      {
        heading: "Return Window",
        body: [
          "You may request a return within 7 days of receiving your order.",
          "Items must be unused, in their original packaging, with all tags and seals intact.",
          "For hygiene reasons, opened skincare and beauty products cannot be returned unless defective.",
        ],
      },
      {
        heading: "How to Request a Return",
        body: [
          "Contact us via the Contact page or phone with your order number and the reason for return.",
          "Our team will review your request and arrange a pickup or drop-off.",
          "Approved refunds are issued to your original payment method, or as store credit for cash-on-delivery orders, within 7-10 business days.",
        ],
      },
      {
        heading: "Damaged or Wrong Items",
        body: [
          "If you receive a damaged, defective, or incorrect item, report it within 48 hours of delivery with photos.",
          "We will replace the item or issue a full refund, including any delivery charges.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    intro: "Your privacy matters to us. This policy explains what information we collect and how we use it.",
    sections: [
      {
        heading: "Information We Collect",
        body: [
          "Account details you provide: name, phone number, email, and delivery addresses.",
          "Order history and preferences to serve you better.",
          "Technical data such as device type and pages visited, used to improve the site.",
        ],
      },
      {
        heading: "How We Use Your Information",
        body: [
          "To process and deliver your orders, and to notify you about order status via SMS or email.",
          "To provide customer support and handle returns.",
          "To send promotional offers only if you opt in — you can unsubscribe at any time.",
        ],
      },
      {
        heading: "Data Protection",
        body: [
          "We never sell your personal information to third parties.",
          "Your data is shared only with delivery partners and payment providers as required to fulfil your order.",
          "You may request deletion of your account and personal data at any time by contacting us.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    intro: "By using this website and placing an order, you agree to the following terms.",
    sections: [
      {
        heading: "Orders & Pricing",
        body: [
          "All prices are listed in Bangladeshi Taka (৳) and include applicable taxes unless stated otherwise.",
          "We reserve the right to cancel orders due to stock unavailability, pricing errors, or suspected fraudulent activity. Any payment made for a cancelled order is fully refunded.",
          "Promotional offers and coupons are subject to their stated conditions and may be withdrawn at any time.",
        ],
      },
      {
        heading: "Accounts",
        body: [
          "You are responsible for keeping your account credentials secure.",
          "Accounts used for fraudulent activity may be suspended.",
        ],
      },
      {
        heading: "Product Information",
        body: [
          "We make every effort to display product colors and details accurately, but slight variations may occur due to screen differences.",
          "Authenticity: all products are sourced from authorised suppliers.",
        ],
      },
      {
        heading: "Contact",
        body: [
          "For any questions about these terms, please reach out via the Contact page.",
        ],
      },
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) return { title: "Policy", robots: { index: false, follow: true } };
  return {
    title: `${policy.title} — ChineXa`,
    description: policy.intro,
    alternates: { canonical: `/policies/${slug}` },
  };
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) notFound();

  return (
    <div className="bg-white min-h-screen">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Breadcrumb items={[{ label: policy.title }]} className="mb-8" />
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-charcoal mb-3">{policy.title}</h1>
        <p className="text-charcoal-lighter mb-10">{policy.intro}</p>

        <div className="space-y-8">
          {policy.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-heading text-xl font-semibold text-charcoal mb-3">{section.heading}</h2>
              <ul className="space-y-2">
                {section.body.map((line, i) => (
                  <li key={i} className="text-sm leading-relaxed text-charcoal-light flex gap-2">
                    <span className="text-secondary mt-1.5 h-1 w-1 rounded-full bg-secondary shrink-0" />
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="text-xs text-charcoal-lighter mt-12 pt-6 border-t border-border/30">
          Last updated: July 2026. If you have questions about this policy, please contact us.
        </p>
      </div>
    </div>
  );
}
