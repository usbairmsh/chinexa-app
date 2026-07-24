// Auto-generate descriptive, unique alt text for a product image when the admin
// leaves the Alt Text field blank. Good alt text helps both accessibility and
// image SEO (Google Images is a real discovery channel for beauty/fashion in
// Bangladesh). Manual alt text always wins — this only fills the gap.
//
// The generated text is specific per image: product name + brand + a
// position/variant qualifier so multiple images of the same product don't all
// share identical alt (which search engines discount).

interface AltInput {
  productName: string;
  brandName?: string | null;
  categoryName?: string | null;
  /** Zero-based position of this image among the product's images. */
  index: number;
  totalImages: number;
  /** Variant this image belongs to, if any (e.g. "Red", "50ml"). */
  variantName?: string | null;
}

export function generateImageAlt(input: AltInput): string {
  const { productName, brandName, categoryName, index, totalImages, variantName } = input;

  const name = (productName || "Product").trim();
  const brand = (brandName || "").trim();
  // Lead with brand only when it isn't already part of the product name, so we
  // don't produce "COSRX COSRX Toner".
  const brandPrefix = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ` : "";

  // A qualifier that differentiates each image of the same product.
  let qualifier = "";
  if (variantName && variantName.trim()) {
    qualifier = ` — ${variantName.trim()}`;
  } else if (totalImages > 1) {
    qualifier = index === 0 ? "" : ` — view ${index + 1}`;
  }

  const category = (categoryName || "").trim();
  // Only append category context on the primary image, and only when it adds
  // information not already in the name.
  const categorySuffix =
    index === 0 && category && !name.toLowerCase().includes(category.toLowerCase())
      ? ` ${category}`
      : "";

  // e.g. "COSRX Low pH Niacinamide Micellar Water 100ml Skincare — buy original in Bangladesh"
  const base = `${brandPrefix}${name}${categorySuffix}${qualifier}`.replace(/\s+/g, " ").trim();
  return `${base} — buy original in Bangladesh`.slice(0, 125);
}

/** Returns the manual alt if present/non-blank, otherwise the generated one. */
export function resolveImageAlt(manualAlt: string | null | undefined, input: AltInput): string {
  const manual = (manualAlt || "").trim();
  return manual || generateImageAlt(input);
}
