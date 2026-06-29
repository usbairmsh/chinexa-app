import type { Product, ProductBadge } from "@/types/product";

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(42);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const pickN = <T>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => rand() - 0.5);
  return shuffled.slice(0, n);
};
const randBetween = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const roundTo50 = (n: number) => Math.round(n / 50) * 50;

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");

const months = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(2025, 6 + i, randBetween(1, 28));
  return d.toISOString();
});

const skincareBrands = ["CosRX", "SOME BY MI", "Innisfree", "Laneige", "Sulwhasoo", "Dr. Jart+", "Beauty of Joseon", "Torriden", "Anua", "SKIN1004"];
const skincareNames: Record<string, string[]> = {
  serums: ["Vitamin C Brightening Serum", "Hyaluronic Acid Hydra Serum", "Niacinamide Pore Refining Serum", "Retinol Anti-Aging Serum", "Snail Mucin Power Serum", "AHA BHA Clarifying Serum", "Centella Recovery Serum", "Propolis Glow Serum", "Rice Water Brightening Essence", "Peptide Firming Serum", "Green Tea Calming Serum", "Galactomyces Ferment Essence"],
  moisturizers: ["Deep Moisture Cream", "Water Sleeping Mask", "Intensive Moisture Barrier Cream", "Ceramide Repair Moisturizer", "Collagen Bounce Cream", "Aloe Vera Gel Cream", "Cica Soothing Cream", "Birch Juice Moisturizer", "Probiotics Cream", "Snail All-in-One Cream"],
  cleansers: ["Low pH Good Morning Cleanser", "Green Tea Foam Cleanser", "Rice Water Bright Cleansing Oil", "Centella Cleansing Gel", "Tea Tree Purifying Cleanser", "Hyaluronic Acid Gentle Cleanser", "Enzyme Powder Wash", "Micellar Cleansing Water", "Oil to Foam Cleanser", "Deep Pore Cleansing Foam"],
  masks: ["Honey Overnight Mask", "Volcanic Pore Clay Mask", "Centella Sheet Mask Pack", "Rice Sleeping Mask", "Mugwort Essence Sheet Mask", "Collagen Eye Patch Set", "Green Tea Hydrating Mask", "Propolis Nourishing Mask", "Tea Tree Blemish Mask", "Vitamin E Recovery Mask"],
  toners: ["AHA/BHA Clarifying Toner", "Green Tea Balancing Toner", "Rice Water Bright Toner", "Centella pH Balancing Toner", "Hyaluronic Acid Hydrating Toner", "Birch Juice Moisturizing Toner", "Niacinamide Brightening Toner", "Rose Water Refreshing Toner"],
  sunscreen: ["Watery Sun Cream SPF50+", "Aqua Sun Gel SPF50+", "Tone Up UV Essence", "Birch Juice Sunscreen SPF50+", "Centella Air Fit Sun Cream", "Daily Moisture Sunscreen", "Aloe Sun Gel", "Rice SPF50+ Sun Cream", "Cica Clear Sun Cream", "UV Defense Mist SPF45"],
};

const bagNames = ["Aria Leather Tote", "Belle Crossbody", "Celine Mini Clutch", "Diana Chain Bag", "Elena Bucket Bag", "Florence Satchel", "Grace Kelly Bag", "Harper Shoulder Bag", "Iris Woven Tote", "Jade Envelope Clutch", "Luna Saddle Bag", "Mia Camera Bag", "Nora Baguette", "Olive Canvas Tote", "Petra Box Bag", "Quinn Pouch", "Rosa Mini Bag", "Stella Hobo Bag", "Thea Trapeze Bag", "Uma Belt Bag", "Vera Evening Clutch", "Willow Basket Bag", "Xena Frame Bag", "Yara Drawstring Bag", "Zoe Quilted Bag", "Ava Circle Bag", "Bianca Top Handle", "Clara Flap Bag", "Daisy Tote", "Eva Micro Bag", "Fiona Doctor Bag", "Gemma Slouch Bag", "Heidi Weekender", "Isla Phone Bag", "Jules Sling Bag", "Kira Structured Bag", "Lily Raffia Tote", "Maya Cloud Clutch", "Nina Travel Bag", "Ophelia Crescent Bag", "Pearl Chain Crossbody", "Ruby Bucket Clutch", "Sophia Accordion Bag", "Tara Convertible Bag", "Unity Pochette"];
const bagSubs = ["handbags", "clutches", "tote-bags", "crossbody"];
const bagColors = [
  { value: "Black", hex: "#1a1a1a" }, { value: "Cream", hex: "#FFFDD0" }, { value: "Blush", hex: "#F8D7E5" },
  { value: "Tan", hex: "#D2B48C" }, { value: "Wine", hex: "#722F37" }, { value: "Navy", hex: "#000080" },
];

const jewelNames = ["Aurora Pendant Necklace", "Bloom Drop Earrings", "Celestia Diamond Ring", "Dahlia Pearl Bracelet", "Eclipse Hoop Earrings", "Flora Chain Necklace", "Gaia Gemstone Ring", "Harmony Bangle Set", "Iris Crystal Earrings", "Jasmine Layered Necklace", "Kayla Charm Bracelet", "Luna Crescent Necklace", "Melody Stud Earrings", "Nova Star Ring", "Opal Cuff Bracelet", "Petal Rose Earrings", "Quartz Statement Ring", "Riviera Pearl Set", "Siren Wave Necklace", "Tiara Crystal Set", "Unity Link Bracelet", "Venus Heart Pendant", "Willow Leaf Earrings", "Xanthe Gold Ring", "Yuki Snowflake Necklace", "Zenith Diamond Studs", "Amber Teardrop Earrings", "Bijou Stackable Rings", "Coral Reef Necklace", "Dew Drop Bracelet", "Ember Fire Earrings", "Frost Crystal Ring", "Glimmer Choker", "Halo Circle Necklace", "Ivy Vine Bracelet", "Jewel Box Set", "Kismet Earring Set", "Lyric Music Note Pendant", "Muse Chain Bracelet", "Nebula Galaxy Ring", "Orchid Flower Set", "Prism Light Earrings", "Radiance Solitaire Ring", "Serenity Pearl Necklace", "Twilight Star Set"];
const jewelSubs = ["necklaces", "earrings", "rings", "bracelets", "sets"];

const perfumeNames = ["Midnight Rose EDP", "Velvet Orchid EDT", "Golden Hour EDP", "Cherry Blossom Body Mist", "Silk Oud EDP", "Fresh Linen EDT", "Amber Dreams EDP", "Ocean Breeze Mist", "White Jasmine EDP", "Pink Peony EDT", "Sandalwood Luxe EDP", "Citrus Garden Mist", "Vanilla Noir EDP", "Wild Rose EDT", "Musk & Honey EDP", "Lavender Fields Mist", "Dahlia Intense EDP", "Summer Bloom EDT", "Cashmere Mist Body Mist", "Tokyo Sakura EDP", "Paris Night EDT", "Lemon Verbena Mist", "Royal Iris EDP", "Cedar & Bergamot EDT", "Oriental Spice EDP", "Peach Blossom Mist", "Noir Mystery EDP", "Aqua Marine EDT", "Bamboo & Green Tea Mist", "Tuberose EDP", "Lily of the Valley EDT", "Coconut Vanilla Mist", "Neroli Sunset EDP", "Fig & Lotus EDT", "Gardenia White Mist", "Amber & Myrrh EDP Gift Set", "Floral Dreams Gift Set", "Signature Scent Discovery Set", "Mini Fragrance Collection", "Date Night Duo Set"];
const perfumeSubs = ["edp", "edt", "body-mists", "gift-sets"];

const shoeNames = ["Aria Stiletto Heel", "Belle Block Heel", "Celine Kitten Heel", "Diana Slingback", "Elena Platform Heel", "Flora Pointed Flat", "Grace Ballet Flat", "Harper Loafer", "Iris Mule Flat", "Jade D'Orsay Flat", "Kira Slide Sandal", "Luna Strappy Sandal", "Mia Gladiator Sandal", "Nora Ankle Strap Sandal", "Olive Espadrille Wedge", "Petra Cork Wedge", "Quinn Platform Wedge", "Rosa Suede Wedge", "Stella Lace-Up Heel", "Thea Bow Flat", "Uma Embellished Sandal", "Vera Metallic Heel", "Willow Woven Flat", "Xena Thong Sandal", "Yara Open-Toe Heel", "Zoe Clear Heel", "Ava Pearl Flat", "Bianca Velvet Heel", "Clara Chain Sandal", "Daisy Floral Flat", "Eva Studded Mule", "Fiona Feather Heel", "Gemma Glitter Flat", "Heidi Hiking Sandal", "Isla Raffia Wedge", "Jules Sport Sandal", "Kaia Satin Heel", "Lily Crystal Flat", "Maya Mesh Sandal", "Nina Patent Wedge"];
const shoeSubs = ["heels", "flats", "sandals", "wedges"];
const shoeSizes = ["36", "37", "38", "39", "40", "41"];

const importedNames = ["COSRX Advanced Snail 96 Mucin", "Laneige Water Sleeping Mask", "Innisfree Green Tea Seed Serum", "Sulwhasoo First Care Activating Serum", "SK-II Facial Treatment Essence", "Shiseido Ultimune Serum", "La Mer Moisturizing Cream", "Estee Lauder Advanced Night Repair", "Clinique Moisture Surge", "Charlotte Tilbury Magic Cream", "Drunk Elephant Protini Cream", "Tatcha Dewy Skin Cream", "Fresh Rose Face Mask", "Kiehl's Midnight Recovery", "Origins GinZing Moisturizer", "Bobbi Brown Vitamin Face Base", "MAC Fix+ Setting Spray", "NARS Pure Radiant Foundation", "Too Faced Better Than Sex Mascara", "Urban Decay All Nighter Spray", "Benefit Brow Pencil", "Fenty Beauty Gloss Bomb", "Rare Beauty Blush", "Glossier Boy Brow", "Hourglass Setting Powder", "Pat McGrath Lip Fetish Balm", "Tom Ford Lip Color", "Dior Lip Glow", "YSL Rouge Pur Couture", "Chanel Les Beiges Powder", "Guerlain Terracotta Bronzer", "Laura Mercier Setting Powder", "ILIA Super Serum Skin Tint", "Tower 28 SOS Spray", "Summer Fridays Jet Lag Mask", "Glow Recipe Watermelon Mask", "Herbivore Blue Tansy Mask", "Byredo Gypsy Water Perfume", "Diptyque Baies Candle", "Jo Malone Wood Sage & Sea Salt"];
const importOrigins = ["Korea", "Japan", "France", "Italy", "USA", "UK"];

const preorderNames = ["Summer 2026 Skincare Kit", "Limited Edition Rose Collection", "Holiday Gift Box Set", "Signature Scent Launch", "Designer Collab Bag", "Crystal Jewelry Set", "Korean Beauty Box", "Premium Perfume Trio", "Luxury Shoe Collection", "Exclusive Import Bundle", "Anniversary Special Set", "Bridal Beauty Kit", "Eid Special Collection", "Valentine's Day Box", "Mother's Day Gift Set", "Birthday Glow Kit", "Self-Care Ritual Set", "Travel Beauty Kit", "Minimalist Skincare Set", "Maximalist Glam Kit", "Date Night Essentials", "Monsoon Care Kit", "Winter Glow Set", "Spring Bloom Collection", "Autumn Warmth Set", "Festive Sparkle Box", "New Year Glow Set", "Beach Ready Kit", "Work From Home Kit", "Wellness Box"];

function generateProducts(): Product[] {
  const products: Product[] = [];
  let idx = 0;

  // Skincare - 60 products
  const subcats = Object.keys(skincareNames);
  for (const sub of subcats) {
    const names = skincareNames[sub];
    for (const name of names) {
      idx++;
      const brand = pick(skincareBrands);
      const fullName = `${brand} ${name}`;
      const slug = slugify(fullName);
      const price = roundTo50(randBetween(800, 8000));
      const hasSale = rand() < 0.3;
      const badges: ProductBadge[] = [];
      if (rand() < 0.2) badges.push("new");
      if (hasSale) badges.push("sale");
      if (rand() < 0.1) badges.push("bestseller");
      if (rand() < 0.1) badges.push("trending");

      products.push({
        id: `prod-${idx}`,
        name: fullName,
        slug,
        description: `${fullName} is a premium skincare product designed to transform your skin. Formulated with carefully selected ingredients, this ${sub.replace(/s$/, "")} delivers visible results. Perfect for daily use in your beauty routine. Suitable for all skin types.`,
        short_description: `Premium ${name.toLowerCase()} for radiant, healthy-looking skin.`,
        sku: `SK-${String(idx).padStart(4, "0")}`,
        price,
        compare_at_price: hasSale ? roundTo50(price * (1 + rand() * 0.4 + 0.1)) : undefined,
        currency: "BDT",
        images: Array.from({ length: 4 }, (_, i) => ({
          id: `img-${idx}-${i}`,
          url: `https://picsum.photos/seed/${slug}-${i}/600/750`,
          alt: `${fullName} - Image ${i + 1}`,
          order: i,
        })),
        category_id: "skincare",
        category_name: "Premium Skincare",
        subcategory: sub,
        tags: ["skincare", sub, brand.toLowerCase().replace(/\s+/g, "-")],
        badges,
        variants: [
          { id: `v-${idx}-1`, name: "30ml", type: "size", value: "30ml", price_adjustment: 0, stock: randBetween(5, 50), sku: `SK-${String(idx).padStart(4, "0")}-30` },
          { id: `v-${idx}-2`, name: "50ml", type: "size", value: "50ml", price_adjustment: roundTo50(price * 0.4), stock: randBetween(5, 40), sku: `SK-${String(idx).padStart(4, "0")}-50` },
        ],
        stock_quantity: randBetween(10, 100), min_stock: 10, max_stock: 100,
        is_active: true,
        is_featured: rand() < 0.15,
        average_rating: +(3.5 + rand() * 1.5).toFixed(1),
        review_count: randBetween(0, 120),
        country_of_origin: pick(["Korea", "Japan", "France"]),
        weight: `${randBetween(30, 200)}ml`,
        ingredients: "Water, Glycerin, Niacinamide, Hyaluronic Acid, Centella Asiatica Extract, Snail Secretion Filtrate, Panthenol, Allantoin, Betaine, Sodium Hyaluronate",
        how_to_use: "Apply to cleansed skin morning and evening. Gently pat into skin until absorbed.",
        created_at: pick(months),
        updated_at: pick(months),
      });
    }
  }

  // Bags - 45 products
  for (let i = 0; i < 45; i++) {
    idx++;
    const name = bagNames[i];
    const slug = slugify(name);
    const sub = bagSubs[i % bagSubs.length];
    const price = roundTo50(randBetween(2000, 25000));
    const hasSale = rand() < 0.25;
    const badges: ProductBadge[] = [];
    if (rand() < 0.2) badges.push("new");
    if (hasSale) badges.push("sale");
    if (rand() < 0.12) badges.push("bestseller");

    products.push({
      id: `prod-${idx}`,
      name,
      slug,
      description: `The ${name} is a statement piece that combines luxury craftsmanship with modern design. Made with premium materials, this bag is perfect for elevating any outfit. Features high-quality hardware and a spacious interior.`,
      short_description: `Elegant ${sub.replace("-", " ")} crafted with premium materials.`,
      sku: `BG-${String(idx).padStart(4, "0")}`,
      price,
      compare_at_price: hasSale ? roundTo50(price * (1 + rand() * 0.3 + 0.1)) : undefined,
      currency: "BDT",
      images: Array.from({ length: 4 }, (_, j) => ({
        id: `img-${idx}-${j}`,
        url: `https://picsum.photos/seed/${slug}-${j}/600/750`,
        alt: `${name} - Image ${j + 1}`,
        order: j,
      })),
      category_id: "bags",
      category_name: "Bags",
      subcategory: sub,
      tags: ["bags", sub, "luxury", "fashion"],
      badges,
      variants: pickN(bagColors, 3).map((c, vi) => ({
        id: `v-${idx}-${vi}`,
        name: c.value,
        type: "color" as const,
        value: c.value,
        hex: c.hex,
        price_adjustment: 0,
        stock: randBetween(3, 20),
        sku: `BG-${String(idx).padStart(4, "0")}-${c.value.slice(0, 2).toUpperCase()}`,
      })),
      stock_quantity: randBetween(5, 40), min_stock: 5, max_stock: 50,
      is_active: true,
      is_featured: rand() < 0.15,
      average_rating: +(3.8 + rand() * 1.2).toFixed(1),
      review_count: randBetween(0, 80),
      country_of_origin: pick(["Italy", "Turkey", "China"]),
      created_at: pick(months),
      updated_at: pick(months),
    });
  }

  // Jewels - 45 products
  for (let i = 0; i < 45; i++) {
    idx++;
    const name = jewelNames[i];
    const slug = slugify(name);
    const sub = jewelSubs[i % jewelSubs.length];
    const price = roundTo50(randBetween(500, 15000));
    const hasSale = rand() < 0.2;
    const badges: ProductBadge[] = [];
    if (rand() < 0.2) badges.push("new");
    if (hasSale) badges.push("sale");
    if (rand() < 0.15) badges.push("bestseller");
    if (rand() < 0.08) badges.push("limited");

    products.push({
      id: `prod-${idx}`,
      name,
      slug,
      description: `The ${name} is a timeless piece that adds elegance to any ensemble. Crafted with attention to detail, this ${sub.replace(/s$/, "")} features exquisite design and premium finishes. A perfect gift or personal treasure.`,
      short_description: `Exquisite ${sub.replace(/s$/, "")} with elegant detailing.`,
      sku: `JW-${String(idx).padStart(4, "0")}`,
      price,
      compare_at_price: hasSale ? roundTo50(price * (1 + rand() * 0.35 + 0.1)) : undefined,
      currency: "BDT",
      images: Array.from({ length: 4 }, (_, j) => ({
        id: `img-${idx}-${j}`,
        url: `https://picsum.photos/seed/${slug}-${j}/600/750`,
        alt: `${name} - Image ${j + 1}`,
        order: j,
      })),
      category_id: "jewels",
      category_name: "Jewels",
      subcategory: sub,
      tags: ["jewelry", sub, "elegant", "fashion"],
      badges,
      variants: [
        { id: `v-${idx}-1`, name: "Gold", type: "color" as const, value: "Gold", hex: "#D4AF37", price_adjustment: 0, stock: randBetween(5, 30), sku: `JW-${String(idx).padStart(4, "0")}-G` },
        { id: `v-${idx}-2`, name: "Silver", type: "color" as const, value: "Silver", hex: "#C0C0C0", price_adjustment: -roundTo50(price * 0.1), stock: randBetween(5, 30), sku: `JW-${String(idx).padStart(4, "0")}-S` },
        { id: `v-${idx}-3`, name: "Rose Gold", type: "color" as const, value: "Rose Gold", hex: "#B76E79", price_adjustment: roundTo50(price * 0.05), stock: randBetween(3, 20), sku: `JW-${String(idx).padStart(4, "0")}-RG` },
      ],
      stock_quantity: randBetween(10, 60), min_stock: 10, max_stock: 60,
      is_active: true,
      is_featured: rand() < 0.15,
      average_rating: +(3.7 + rand() * 1.3).toFixed(1),
      review_count: randBetween(0, 90),
      created_at: pick(months),
      updated_at: pick(months),
    });
  }

  // Perfumes - 40 products
  for (let i = 0; i < 40; i++) {
    idx++;
    const name = perfumeNames[i];
    const slug = slugify(name);
    const sub = perfumeSubs[i % perfumeSubs.length];
    const price = roundTo50(randBetween(1500, 12000));
    const hasSale = rand() < 0.25;
    const badges: ProductBadge[] = [];
    if (rand() < 0.2) badges.push("new");
    if (hasSale) badges.push("sale");
    if (rand() < 0.12) badges.push("trending");

    products.push({
      id: `prod-${idx}`,
      name,
      slug,
      description: `${name} is an exquisite fragrance that captivates the senses. With carefully blended top, heart, and base notes, this perfume creates an unforgettable scent trail. Perfect for everyday wear or special occasions.`,
      short_description: `A captivating fragrance for the modern woman.`,
      sku: `PF-${String(idx).padStart(4, "0")}`,
      price,
      compare_at_price: hasSale ? roundTo50(price * (1 + rand() * 0.3 + 0.1)) : undefined,
      currency: "BDT",
      images: Array.from({ length: 4 }, (_, j) => ({
        id: `img-${idx}-${j}`,
        url: `https://picsum.photos/seed/${slug}-${j}/600/750`,
        alt: `${name} - Image ${j + 1}`,
        order: j,
      })),
      category_id: "perfumes",
      category_name: "Perfumes",
      subcategory: sub,
      tags: ["perfume", "fragrance", sub],
      badges,
      variants: sub === "gift-sets" ? [] : [
        { id: `v-${idx}-1`, name: "30ml", type: "size" as const, value: "30ml", price_adjustment: 0, stock: randBetween(10, 40), sku: `PF-${String(idx).padStart(4, "0")}-30` },
        { id: `v-${idx}-2`, name: "50ml", type: "size" as const, value: "50ml", price_adjustment: roundTo50(price * 0.5), stock: randBetween(5, 30), sku: `PF-${String(idx).padStart(4, "0")}-50` },
        { id: `v-${idx}-3`, name: "100ml", type: "size" as const, value: "100ml", price_adjustment: roundTo50(price * 0.9), stock: randBetween(3, 15), sku: `PF-${String(idx).padStart(4, "0")}-100` },
      ],
      stock_quantity: randBetween(10, 60), min_stock: 10, max_stock: 60,
      is_active: true,
      is_featured: rand() < 0.15,
      average_rating: +(3.6 + rand() * 1.4).toFixed(1),
      review_count: randBetween(0, 100),
      country_of_origin: pick(["France", "Italy", "USA", "UK"]),
      created_at: pick(months),
      updated_at: pick(months),
    });
  }

  // Shoes - 40 products
  for (let i = 0; i < 40; i++) {
    idx++;
    const name = shoeNames[i];
    const slug = slugify(name);
    const sub = shoeSubs[i % shoeSubs.length];
    const price = roundTo50(randBetween(2000, 18000));
    const hasSale = rand() < 0.25;
    const badges: ProductBadge[] = [];
    if (rand() < 0.2) badges.push("new");
    if (hasSale) badges.push("sale");
    if (rand() < 0.1) badges.push("bestseller");

    products.push({
      id: `prod-${idx}`,
      name,
      slug,
      description: `The ${name} combines style and comfort in a sophisticated design. Made with premium materials and expert craftsmanship, these ${sub} are perfect for making a statement. Features cushioned insole and durable outsole.`,
      short_description: `Stylish ${sub.replace(/s$/, "")} designed for comfort and elegance.`,
      sku: `SH-${String(idx).padStart(4, "0")}`,
      price,
      compare_at_price: hasSale ? roundTo50(price * (1 + rand() * 0.3 + 0.1)) : undefined,
      currency: "BDT",
      images: Array.from({ length: 4 }, (_, j) => ({
        id: `img-${idx}-${j}`,
        url: `https://picsum.photos/seed/${slug}-${j}/600/750`,
        alt: `${name} - Image ${j + 1}`,
        order: j,
      })),
      category_id: "shoes",
      category_name: "Shoes",
      subcategory: sub,
      tags: ["shoes", sub, "fashion", "luxury"],
      badges,
      variants: pickN(shoeSizes, 4).map((size, vi) => ({
        id: `v-${idx}-${vi}`,
        name: `Size ${size}`,
        type: "size" as const,
        value: size,
        price_adjustment: 0,
        stock: randBetween(2, 15),
        sku: `SH-${String(idx).padStart(4, "0")}-${size}`,
      })),
      stock_quantity: randBetween(5, 40), min_stock: 5, max_stock: 50,
      is_active: true,
      is_featured: rand() < 0.15,
      average_rating: +(3.7 + rand() * 1.3).toFixed(1),
      review_count: randBetween(0, 70),
      country_of_origin: pick(["Italy", "Spain", "Turkey", "China"]),
      created_at: pick(months),
      updated_at: pick(months),
    });
  }

  // Imported - 40 products
  for (let i = 0; i < 40; i++) {
    idx++;
    const name = importedNames[i];
    const slug = slugify(name);
    const price = roundTo50(randBetween(3000, 30000));
    const hasSale = rand() < 0.2;
    const origin = pick(importOrigins);
    const badges: ProductBadge[] = [];
    if (rand() < 0.25) badges.push("new");
    if (hasSale) badges.push("sale");
    if (rand() < 0.15) badges.push("bestseller");
    if (rand() < 0.1) badges.push("limited");

    products.push({
      id: `prod-${idx}`,
      name,
      slug,
      description: `Authentically imported from ${origin}, ${name} represents the finest in international beauty. This premium product delivers exceptional quality and results. Now exclusively available at ChineXa, bringing world-class beauty to Bangladesh.`,
      short_description: `Authentic imported product from ${origin}.`,
      sku: `IM-${String(idx).padStart(4, "0")}`,
      price,
      compare_at_price: hasSale ? roundTo50(price * (1 + rand() * 0.25 + 0.1)) : undefined,
      currency: "BDT",
      images: Array.from({ length: 4 }, (_, j) => ({
        id: `img-${idx}-${j}`,
        url: `https://picsum.photos/seed/${slug}-${j}/600/750`,
        alt: `${name} - Image ${j + 1}`,
        order: j,
      })),
      category_id: "imported",
      category_name: "Imported Products",
      tags: ["imported", origin.toLowerCase(), "authentic", "luxury"],
      badges,
      variants: [],
      stock_quantity: randBetween(5, 30), min_stock: 5, max_stock: 40,
      is_active: true,
      is_featured: rand() < 0.2,
      average_rating: +(4.0 + rand() * 1.0).toFixed(1),
      review_count: randBetween(5, 150),
      country_of_origin: origin,
      created_at: pick(months),
      updated_at: pick(months),
    });
  }

  // Pre-orders - 30 products
  for (let i = 0; i < 30; i++) {
    idx++;
    const name = preorderNames[i];
    const slug = slugify(name);
    const price = roundTo50(randBetween(1500, 20000));
    const badges: ProductBadge[] = ["preorder"];
    if (rand() < 0.3) badges.push("limited");
    if (rand() < 0.2) badges.push("trending");

    products.push({
      id: `prod-${idx}`,
      name,
      slug,
      description: `Be the first to own the ${name}. This exclusive collection is carefully curated with premium products and will be available soon. Pre-order now to secure yours before the official launch. Limited quantities available.`,
      short_description: `Exclusive pre-order collection — reserve yours today.`,
      sku: `PO-${String(idx).padStart(4, "0")}`,
      price,
      currency: "BDT",
      images: Array.from({ length: 4 }, (_, j) => ({
        id: `img-${idx}-${j}`,
        url: `https://picsum.photos/seed/${slug}-${j}/600/750`,
        alt: `${name} - Image ${j + 1}`,
        order: j,
      })),
      category_id: "preorder",
      category_name: "Pre-Orders",
      tags: ["pre-order", "exclusive", "limited", "upcoming"],
      badges,
      variants: [],
      stock_quantity: randBetween(20, 100), min_stock: 15, max_stock: 80,
      is_active: true,
      is_featured: rand() < 0.25,
      average_rating: 0,
      review_count: 0,
      created_at: pick(months),
      updated_at: pick(months),
    });
  }

  return products;
}

export const products: Product[] = generateProducts();
