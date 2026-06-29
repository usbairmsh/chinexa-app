/**
 * ChineXa Database Seed Script
 * Run: node scripts/seed-db.js
 *
 * Seeds all tables with realistic demo data for both customer and admin sides.
 * Requires: XAMPP MySQL running on localhost:3306, database 'chinexa' created.
 */

const mysql = require("mysql2/promise");

const DB_CONFIG = {
  host: "localhost",
  port: 3306,
  user: "root",
  password: "",
  database: "chinexa",
  multipleStatements: true,
};

// ─── HELPERS ────────────────────────────────────────────
let seedCounter = 42;
function seededRand() { seedCounter = (seedCounter * 16807) % 2147483647; return (seedCounter - 1) / 2147483646; }
const pick = (arr) => arr[Math.floor(seededRand() * arr.length)];
const randBetween = (min, max) => Math.floor(seededRand() * (max - min + 1)) + min;
const roundTo50 = (n) => Math.round(n / 50) * 50;
const slugify = (s) => s.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
const uuid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const randomDate = (startMonths, endMonths) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - startMonths, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - endMonths, 28);
  return new Date(start.getTime() + seededRand() * (end.getTime() - start.getTime())).toISOString().slice(0, 19).replace("T", " ");
};

async function seed() {
  console.log("🌱 Connecting to MySQL...");
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log("✅ Connected to chinexa database\n");

  // Disable FK checks for seeding
  await conn.execute("SET FOREIGN_KEY_CHECKS = 0");

  // ═══════════════════════════════════════════════
  // 1. CATEGORIES
  // ═══════════════════════════════════════════════
  console.log("📁 Seeding categories...");
  await conn.execute("TRUNCATE TABLE categories");

  const parentCategories = [
    { id: "skincare", name: "Premium Skincare", slug: "skincare", desc: "Curated collection of premium skincare essentials.", img: "https://picsum.photos/seed/cat-skincare/600/400", count: 60 },
    { id: "bags", name: "Bags", slug: "bags", desc: "Luxury bags for every occasion.", img: "https://picsum.photos/seed/cat-bags/600/400", count: 45 },
    { id: "jewels", name: "Jewels", slug: "jewels", desc: "Exquisite jewelry for the modern woman.", img: "https://picsum.photos/seed/cat-jewels/600/400", count: 45 },
    { id: "perfumes", name: "Perfumes", slug: "perfumes", desc: "Signature scents from world-class perfume houses.", img: "https://picsum.photos/seed/cat-perfumes/600/400", count: 40 },
    { id: "shoes", name: "Shoes", slug: "shoes", desc: "Step into elegance with our premium shoe collection.", img: "https://picsum.photos/seed/cat-shoes/600/400", count: 40 },
    { id: "imported", name: "Imported Products", slug: "imported", desc: "Authentic imported luxury products.", img: "https://picsum.photos/seed/cat-imported/600/400", count: 40 },
    { id: "preorder", name: "Pre-Orders", slug: "pre-orders", desc: "Be the first to own the latest launches.", img: "https://picsum.photos/seed/cat-preorder/600/400", count: 30 },
  ];

  for (let i = 0; i < parentCategories.length; i++) {
    const c = parentCategories[i];
    await conn.execute(
      "INSERT INTO categories (id, name, slug, description, image, `order`, is_active, product_count) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)",
      [c.id, c.name, c.slug, c.desc, c.img, i + 1, c.count]
    );
  }

  const subcategories = {
    skincare: ["Serums", "Moisturizers", "Cleansers", "Face Masks", "Toners", "Sunscreen"],
    bags: ["Handbags", "Clutches", "Tote Bags", "Crossbody"],
    jewels: ["Necklaces", "Earrings", "Rings", "Bracelets", "Sets"],
    perfumes: ["Eau de Parfum", "Eau de Toilette", "Body Mists", "Gift Sets"],
    shoes: ["Heels", "Flats", "Sandals", "Wedges"],
  };

  for (const [parentId, subs] of Object.entries(subcategories)) {
    for (let i = 0; i < subs.length; i++) {
      const subSlug = slugify(subs[i]);
      await conn.execute(
        "INSERT INTO categories (id, name, slug, parent_id, `order`, is_active, product_count) VALUES (?, ?, ?, ?, ?, TRUE, ?)",
        [`${parentId}-${subSlug}`, subs[i], subSlug, parentId, i + 1, randBetween(8, 15)]
      );
    }
  }
  console.log(`  ✅ ${parentCategories.length} parent + ${Object.values(subcategories).flat().length} subcategories\n`);

  // ═══════════════════════════════════════════════
  // 2. PRODUCTS (300)
  // ═══════════════════════════════════════════════
  console.log("📦 Seeding products (300)...");
  await conn.execute("TRUNCATE TABLE product_images");
  await conn.execute("TRUNCATE TABLE product_variants");
  await conn.execute("TRUNCATE TABLE products");

  const brands = ["CosRX", "SOME BY MI", "Innisfree", "Laneige", "Sulwhasoo", "Dr. Jart+", "Beauty of Joseon", "Torriden", "Anua", "SKIN1004"];
  const origins = ["Korea", "Japan", "France", "Italy", "USA", "UK"];
  const badgeOptions = ["new", "sale", "bestseller", "preorder", "limited", "trending"];

  const productConfigs = [
    { cat: "skincare", catName: "Premium Skincare", count: 60, priceMin: 800, priceMax: 8000, names: ["Vitamin C Serum", "Hyaluronic Acid Serum", "Niacinamide Serum", "Retinol Serum", "Snail Mucin Serum", "AHA BHA Serum", "Centella Serum", "Propolis Serum", "Rice Essence", "Peptide Serum", "Green Tea Serum", "Galactomyces Essence", "Deep Moisture Cream", "Water Sleeping Mask", "Barrier Cream", "Ceramide Cream", "Collagen Cream", "Aloe Gel", "Cica Cream", "Birch Juice Cream", "Low pH Cleanser", "Foam Cleanser", "Cleansing Oil", "Cleansing Gel", "Enzyme Wash", "Honey Mask", "Clay Mask", "Sheet Mask Pack", "Sleeping Mask", "Eye Patch Set", "AHA Toner", "Green Tea Toner", "Rice Toner", "Centella Toner", "Hydrating Toner", "Birch Toner", "Brightening Toner", "Rose Toner", "Sun Cream SPF50+", "Sun Gel SPF50+", "UV Essence", "Birch Sunscreen", "Centella Sun Cream", "Daily Sunscreen", "Aloe Sun Gel", "Rice Sun Cream", "Cica Sun Cream", "UV Mist SPF45", "Moisture Serum", "Glow Serum", "Repair Cream", "Hydra Cream", "Pore Cleanser", "Deep Cleanser", "Overnight Mask", "Peel Mask", "Mist Toner", "Essence Toner", "Light Sun Cream", "Tone Up Sun"] },
    { cat: "bags", catName: "Bags", count: 45, priceMin: 2000, priceMax: 25000, names: ["Aria Leather Tote", "Belle Crossbody", "Celine Clutch", "Diana Chain Bag", "Elena Bucket Bag", "Florence Satchel", "Grace Kelly Bag", "Harper Shoulder Bag", "Iris Woven Tote", "Jade Clutch", "Luna Saddle Bag", "Mia Camera Bag", "Nora Baguette", "Olive Canvas Tote", "Petra Box Bag", "Quinn Pouch", "Rosa Mini Bag", "Stella Hobo Bag", "Thea Trapeze Bag", "Uma Belt Bag", "Vera Evening Clutch", "Willow Basket Bag", "Xena Frame Bag", "Yara Drawstring", "Zoe Quilted Bag", "Ava Circle Bag", "Bianca Top Handle", "Clara Flap Bag", "Daisy Tote", "Eva Micro Bag", "Fiona Doctor Bag", "Gemma Slouch Bag", "Heidi Weekender", "Isla Phone Bag", "Jules Sling Bag", "Kira Structured Bag", "Lily Raffia Tote", "Maya Cloud Clutch", "Nina Travel Bag", "Ophelia Crescent Bag", "Pearl Chain Crossbody", "Ruby Bucket Clutch", "Sophia Accordion Bag", "Tara Convertible", "Unity Pochette"] },
    { cat: "jewels", catName: "Jewels", count: 45, priceMin: 500, priceMax: 15000, names: ["Aurora Pendant", "Bloom Earrings", "Celestia Ring", "Dahlia Bracelet", "Eclipse Hoops", "Flora Chain Necklace", "Gaia Gemstone Ring", "Harmony Bangle Set", "Iris Crystal Earrings", "Jasmine Layered Necklace", "Kayla Charm Bracelet", "Luna Crescent Necklace", "Melody Studs", "Nova Star Ring", "Opal Cuff", "Petal Rose Earrings", "Quartz Statement Ring", "Riviera Pearl Set", "Siren Wave Necklace", "Tiara Crystal Set", "Unity Link Bracelet", "Venus Heart Pendant", "Willow Leaf Earrings", "Xanthe Gold Ring", "Yuki Snowflake Necklace", "Zenith Diamond Studs", "Amber Teardrop Earrings", "Bijou Stackable Rings", "Coral Reef Necklace", "Dew Drop Bracelet", "Ember Fire Earrings", "Frost Crystal Ring", "Glimmer Choker", "Halo Circle Necklace", "Ivy Vine Bracelet", "Jewel Box Set", "Kismet Earring Set", "Lyric Pendant", "Muse Chain Bracelet", "Nebula Galaxy Ring", "Orchid Flower Set", "Prism Earrings", "Radiance Solitaire", "Serenity Pearl Necklace", "Twilight Star Set"] },
    { cat: "perfumes", catName: "Perfumes", count: 40, priceMin: 1500, priceMax: 12000, names: ["Midnight Rose EDP", "Velvet Orchid EDT", "Golden Hour EDP", "Cherry Blossom Mist", "Silk Oud EDP", "Fresh Linen EDT", "Amber Dreams EDP", "Ocean Breeze Mist", "White Jasmine EDP", "Pink Peony EDT", "Sandalwood EDP", "Citrus Garden Mist", "Vanilla Noir EDP", "Wild Rose EDT", "Musk & Honey EDP", "Lavender Mist", "Dahlia Intense EDP", "Summer Bloom EDT", "Cashmere Mist", "Tokyo Sakura EDP", "Paris Night EDT", "Lemon Verbena Mist", "Royal Iris EDP", "Cedar Bergamot EDT", "Oriental Spice EDP", "Peach Blossom Mist", "Noir Mystery EDP", "Aqua Marine EDT", "Bamboo Green Tea Mist", "Tuberose EDP", "Lily Valley EDT", "Coconut Vanilla Mist", "Neroli Sunset EDP", "Fig Lotus EDT", "Gardenia Mist", "Amber Myrrh Gift Set", "Floral Dreams Gift Set", "Discovery Set", "Mini Collection", "Date Night Duo"] },
    { cat: "shoes", catName: "Shoes", count: 40, priceMin: 2000, priceMax: 18000, names: ["Aria Stiletto", "Belle Block Heel", "Celine Kitten Heel", "Diana Slingback", "Elena Platform", "Flora Pointed Flat", "Grace Ballet Flat", "Harper Loafer", "Iris Mule Flat", "Jade D'Orsay Flat", "Kira Slide Sandal", "Luna Strappy Sandal", "Mia Gladiator Sandal", "Nora Ankle Strap", "Olive Espadrille", "Petra Cork Wedge", "Quinn Platform Wedge", "Rosa Suede Wedge", "Stella Lace-Up Heel", "Thea Bow Flat", "Uma Embellished Sandal", "Vera Metallic Heel", "Willow Woven Flat", "Xena Thong Sandal", "Yara Open-Toe Heel", "Zoe Clear Heel", "Ava Pearl Flat", "Bianca Velvet Heel", "Clara Chain Sandal", "Daisy Floral Flat", "Eva Studded Mule", "Fiona Feather Heel", "Gemma Glitter Flat", "Heidi Hiking Sandal", "Isla Raffia Wedge", "Jules Sport Sandal", "Kaia Satin Heel", "Lily Crystal Flat", "Maya Mesh Sandal", "Nina Patent Wedge"] },
    { cat: "imported", catName: "Imported Products", count: 40, priceMin: 3000, priceMax: 30000, names: ["COSRX Snail Mucin", "Laneige Water Mask", "Innisfree Green Tea", "Sulwhasoo First Care", "SK-II Treatment Essence", "Shiseido Ultimune", "La Mer Moisturizer", "Estee Lauder Night Repair", "Clinique Moisture Surge", "Charlotte Tilbury Cream", "Drunk Elephant Protini", "Tatcha Dewy Skin", "Fresh Rose Mask", "Kiehl's Recovery", "Origins GinZing", "Bobbi Brown Face Base", "MAC Fix+ Spray", "NARS Foundation", "Too Faced Mascara", "Urban Decay Spray", "Benefit Brow Pencil", "Fenty Gloss Bomb", "Rare Beauty Blush", "Glossier Boy Brow", "Hourglass Powder", "Pat McGrath Lip Balm", "Tom Ford Lip Color", "Dior Lip Glow", "YSL Rouge Couture", "Chanel Les Beiges", "Guerlain Bronzer", "Laura Mercier Powder", "ILIA Skin Tint", "Tower 28 SOS Spray", "Summer Fridays Mask", "Glow Recipe Mask", "Herbivore Blue Tansy", "Byredo Gypsy Water", "Diptyque Baies Candle", "Jo Malone Wood Sage"] },
    { cat: "preorder", catName: "Pre-Orders", count: 30, priceMin: 1500, priceMax: 20000, names: ["Summer 2026 Kit", "Rose Collection", "Holiday Gift Box", "Signature Scent", "Designer Bag", "Crystal Jewelry Set", "Korean Beauty Box", "Perfume Trio", "Luxury Shoe Collection", "Import Bundle", "Anniversary Set", "Bridal Kit", "Eid Collection", "Valentine Box", "Mother's Day Set", "Birthday Kit", "Self-Care Set", "Travel Kit", "Minimalist Skincare", "Maximalist Glam", "Date Night Kit", "Monsoon Care Kit", "Winter Glow Set", "Spring Collection", "Autumn Warmth Set", "Festive Sparkle Box", "New Year Kit", "Beach Ready Kit", "Work From Home Kit", "Wellness Box"] },
  ];

  let productIdx = 0;
  for (const config of productConfigs) {
    for (let i = 0; i < config.count; i++) {
      productIdx++;
      const brand = config.cat === "skincare" ? pick(brands) : "";
      const productName = brand ? `${brand} ${config.names[i]}` : config.names[i];
      const slug = slugify(productName);
      const price = roundTo50(randBetween(config.priceMin, config.priceMax));
      const hasSale = seededRand() < 0.3;
      const comparePrice = hasSale ? roundTo50(price * (1 + seededRand() * 0.4 + 0.1)) : null;
      const badges = [];
      if (seededRand() < 0.2) badges.push("new");
      if (hasSale) badges.push("sale");
      if (seededRand() < 0.1) badges.push("bestseller");
      if (config.cat === "preorder") badges.push("preorder");
      if (seededRand() < 0.05) badges.push("limited");
      if (seededRand() < 0.1) badges.push("trending");

      const sku = `${config.cat.slice(0, 2).toUpperCase()}-${String(productIdx).padStart(4, "0")}`;
      const rating = config.cat === "preorder" ? 0 : +(3.5 + seededRand() * 1.5).toFixed(1);
      const reviewCount = config.cat === "preorder" ? 0 : randBetween(0, 120);
      const stock = randBetween(5, 100);
      const origin = ["imported", "skincare"].includes(config.cat) ? pick(origins) : null;
      const createdAt = randomDate(12, 0);

      await conn.execute(
        `INSERT INTO products (id, name, slug, description, short_description, sku, price, compare_at_price, currency, category_id, category_name, tags, badges, stock_quantity, is_active, is_featured, average_rating, review_count, country_of_origin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BDT', ?, ?, ?, ?, ?, TRUE, ?, ?, ?, ?, ?, ?)`,
        [
          `prod-${productIdx}`, productName, slug,
          `${productName} is a premium product from ChineXa's ${config.catName} collection. Crafted with the finest quality materials and designed for the modern woman.`,
          `Premium ${productName.toLowerCase()} for the discerning beauty enthusiast.`,
          sku, price, comparePrice, config.cat, config.catName,
          JSON.stringify([config.cat, slug.split("-")[0]]),
          JSON.stringify(badges), stock, seededRand() < 0.15,
          rating, reviewCount, origin, createdAt, createdAt,
        ]
      );

      // Images (4 per product)
      for (let j = 0; j < 4; j++) {
        await conn.execute(
          "INSERT INTO product_images (id, product_id, url, alt, `order`) VALUES (?, ?, ?, ?, ?)",
          [`img-${productIdx}-${j}`, `prod-${productIdx}`, `https://picsum.photos/seed/${slug}-${j}/600/750`, `${productName} - Image ${j + 1}`, j]
        );
      }

      // Variants (2-3 per product, skip preorder)
      if (config.cat !== "preorder" && config.cat !== "imported") {
        const variantType = config.cat === "shoes" ? "size" : config.cat === "bags" || config.cat === "jewels" ? "color" : "size";
        const variants = variantType === "size"
          ? config.cat === "shoes" ? ["36", "37", "38", "39"] : ["30ml", "50ml"]
          : [{ v: "Black", h: "#1a1a1a" }, { v: "Blush", h: "#F8D7E5" }, { v: "Gold", h: "#D4AF37" }];

        for (let k = 0; k < Math.min(variants.length, 3); k++) {
          const v = variants[k];
          const vName = typeof v === "string" ? v : v.v;
          const hex = typeof v === "string" ? null : v.h;
          await conn.execute(
            "INSERT INTO product_variants (id, product_id, name, type, value, hex, price_adjustment, stock, sku) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [`v-${productIdx}-${k}`, `prod-${productIdx}`, vName, variantType, vName, hex, k === 0 ? 0 : roundTo50(price * 0.3), randBetween(5, 30), `${sku}-${vName.slice(0, 3).toUpperCase()}`]
          );
        }
      }
    }
  }
  console.log(`  ✅ ${productIdx} products with images and variants\n`);

  // ═══════════════════════════════════════════════
  // 3. CUSTOMERS (20)
  // ═══════════════════════════════════════════════
  console.log("👥 Seeding customers...");
  await conn.execute("TRUNCATE TABLE customer_addresses");
  await conn.execute("TRUNCATE TABLE customers");

  const customerData = [
    { name: "Fatima Akter", email: "fatima@email.com", phone: "+880171234567", div: "Dhaka", dist: "Dhaka", addr: "House 12, Road 5, Gulshan-2", orders: 18, spent: 156800 },
    { name: "Ayesha Rahman", email: "ayesha@email.com", phone: "+880181234567", div: "Dhaka", dist: "Dhaka", addr: "Flat 4B, Navana Tower, Gulshan", orders: 11, spent: 89500 },
    { name: "Nusrat Jahan", email: "", phone: "+880191234567", div: "Dhaka", dist: "Dhaka", addr: "House 8, Road 3, Dhanmondi", orders: 22, spent: 198400 },
    { name: "Sadia Islam", email: "sadia@email.com", phone: "+880161234567", div: "Dhaka", dist: "Gazipur", addr: "Block B, Bashundhara R/A", orders: 5, spent: 32500 },
    { name: "Tamanna Akter", email: "", phone: "+880151234567", div: "Dhaka", dist: "Dhaka", addr: "Mirpur-10", orders: 28, spent: 245600 },
    { name: "Priya Das", email: "priya@email.com", phone: "+880131234567", div: "Dhaka", dist: "Dhaka", addr: "Uttara Sector 7", orders: 7, spent: 52300 },
    { name: "Rima Sultana", email: "", phone: "+880141234567", div: "Chittagong", dist: "Chittagong", addr: "Agrabad, Chittagong", orders: 3, spent: 14200 },
    { name: "Nabila Chowdhury", email: "nabila@email.com", phone: "+880171234568", div: "Dhaka", dist: "Dhaka", addr: "Banani DOHS", orders: 9, spent: 78400 },
    { name: "Sabrina Islam", email: "", phone: "+880181234568", div: "Chittagong", dist: "Chittagong", addr: "Nasirabad, Chittagong", orders: 4, spent: 28600 },
    { name: "Lamia Akter", email: "", phone: "+880191234568", div: "Sylhet", dist: "Sylhet", addr: "Zindabazar, Sylhet", orders: 2, spent: 11800 },
    { name: "Meher Afroz", email: "meher@email.com", phone: "+880161234568", div: "Rajshahi", dist: "Rajshahi", addr: "Rajshahi City", orders: 6, spent: 42100 },
    { name: "Farzana Yasmin", email: "", phone: "+880151234568", div: "Khulna", dist: "Khulna", addr: "Khulna City", orders: 4, spent: 25800 },
    { name: "Laboni Akter", email: "laboni@email.com", phone: "+880131234568", div: "Dhaka", dist: "Narayanganj", addr: "Fatullah, Narayanganj", orders: 8, spent: 61200 },
    { name: "Sumaiya Rahman", email: "", phone: "+880141234568", div: "Dhaka", dist: "Dhaka", addr: "Mohammadpur", orders: 12, spent: 95600 },
    { name: "Tasneem Haque", email: "tasneem@email.com", phone: "+880171234569", div: "Dhaka", dist: "Dhaka", addr: "Lalmatia", orders: 15, spent: 125400 },
    { name: "Anika Tasnim", email: "", phone: "+880181234569", div: "Rangpur", dist: "Rangpur", addr: "Rangpur City", orders: 2, spent: 8900 },
    { name: "Fariha Noor", email: "fariha@email.com", phone: "+880191234569", div: "Barisal", dist: "Barisal", addr: "Barisal City", orders: 3, spent: 18500 },
    { name: "Sharmin Sultana", email: "", phone: "+880161234569", div: "Mymensingh", dist: "Mymensingh", addr: "Mymensingh City", orders: 1, spent: 4500 },
    { name: "Nusaiba Ahmed", email: "nusaiba@email.com", phone: "+880151234569", div: "Dhaka", dist: "Dhaka", addr: "Farmgate", orders: 10, spent: 82000 },
    { name: "Raisa Islam", email: "", phone: "+880131234569", div: "Dhaka", dist: "Dhaka", addr: "Tejgaon", orders: 6, spent: 38700 },
  ];

  for (let i = 0; i < customerData.length; i++) {
    const c = customerData[i];
    const cId = `cust-${i + 1}`;
    const joinDate = randomDate(14, 2);
    await conn.execute(
      "INSERT INTO customers (id, name, email, phone, total_orders, total_spent, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)",
      [cId, c.name, c.email || null, c.phone, c.orders, c.spent, joinDate]
    );
    // Address
    await conn.execute(
      "INSERT INTO customer_addresses (id, customer_id, label, name, phone, address_line_1, city, district, division, is_default) VALUES (?, ?, 'Home', ?, ?, ?, ?, ?, ?, TRUE)",
      [`addr-${i + 1}`, cId, c.name, c.phone, c.addr, c.dist, c.dist, c.div]
    );
  }
  console.log(`  ✅ ${customerData.length} customers with addresses\n`);

  // ═══════════════════════════════════════════════
  // 4. ORDERS (30)
  // ═══════════════════════════════════════════════
  console.log("🛒 Seeding orders...");
  await conn.execute("TRUNCATE TABLE fraud_alerts");
  await conn.execute("TRUNCATE TABLE order_timeline");
  await conn.execute("TRUNCATE TABLE order_addresses");
  await conn.execute("TRUNCATE TABLE order_items");
  await conn.execute("TRUNCATE TABLE orders");

  const statuses = ["pending", "confirmed", "processing", "shipped", "on_delivery", "received", "received", "received", "received", "not_received"];
  const payments = ["bKash", "Nagad", "COD", "Card"];

  for (let i = 0; i < 30; i++) {
    const orderId = `ord-${i + 1}`;
    const orderNum = `ORD-${String(530 - i).padStart(4, "0")}`;
    const customer = customerData[i % customerData.length];
    const custId = `cust-${(i % customerData.length) + 1}`;
    const status = statuses[i % statuses.length];
    const payment = pick(payments);
    const itemCount = randBetween(1, 4);
    const subtotal = roundTo50(randBetween(2000, 25000));
    const shipping = subtotal >= 3000 ? 0 : 60;
    const total = subtotal + shipping;
    const isCOD = payment === "COD";
    // COD: paid only when received. Non-COD: paid when confirmed or later.
    const payStatus = status === "not_received" ? "pending"
      : status === "pending" ? "pending"
      : isCOD ? (status === "received" ? "paid" : "pending")
      : "paid";
    const orderDate = randomDate(6, 0);

    await conn.execute(
      `INSERT INTO orders (id, order_number, customer_id, customer_name, customer_phone, subtotal, shipping_cost, discount, tax, total, status, payment_method, payment_status, transaction_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, orderNum, custId, customer.name, customer.phone, subtotal, shipping, total, status, payment, payStatus, payStatus === "paid" ? `TXN${uuid().slice(0, 8).toUpperCase()}` : null, orderDate, orderDate]
    );

    // Order Items
    for (let j = 0; j < itemCount; j++) {
      const pIdx = randBetween(1, 300);
      const qty = randBetween(1, 2);
      const itemPrice = roundTo50(randBetween(1000, 8000));
      await conn.execute(
        "INSERT INTO order_items (id, order_id, product_id, product_name, product_image, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [`oi-${i + 1}-${j}`, orderId, `prod-${pIdx}`, `Product ${pIdx}`, `https://picsum.photos/seed/oi-${i}-${j}/80/80`, qty, itemPrice, itemPrice * qty]
      );
    }

    // Billing Address
    await conn.execute(
      "INSERT INTO order_addresses (id, order_id, type, name, phone, address_line_1, district, division) VALUES (?, ?, 'billing', ?, ?, ?, ?, ?)",
      [`oa-b-${i + 1}`, orderId, customer.name, customer.phone, customer.addr, customer.dist, customer.div]
    );
    await conn.execute(
      "INSERT INTO order_addresses (id, order_id, type, name, phone, address_line_1, district, division) VALUES (?, ?, 'shipping', ?, ?, ?, ?, ?)",
      [`oa-s-${i + 1}`, orderId, customer.name, customer.phone, customer.addr, customer.dist, customer.div]
    );

    // Timeline
    const timelineSteps = ["pending", "confirmed", "processing", "shipped", "on_delivery", "received"];
    const statusIdx = timelineSteps.indexOf(status === "not_received" ? "on_delivery" : status);
    for (let t = 0; t <= Math.max(statusIdx, 0); t++) {
      await conn.execute(
        "INSERT INTO order_timeline (order_id, status, note, created_at) VALUES (?, ?, ?, ?)",
        [orderId, timelineSteps[t], `Order ${timelineSteps[t]}`, orderDate]
      );
    }
    if (status === "not_received") {
      await conn.execute("INSERT INTO order_timeline (order_id, status, note, created_at) VALUES (?, 'not_received', 'Customer reported order not received', ?)", [orderId, orderDate]);
    }
    // Auto-create fraud alert for not_received orders
    if (status === "not_received") {
      await conn.execute(
        `INSERT INTO fraud_alerts (id, order_id, order_number, customer_id, customer_name, customer_phone, amount, risk_score, risk_factors, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'flagged', ?)`,
        [`fraud-seed-${i + 1}`, orderId, orderNum, custId, customer.name, customer.phone, total, 85, JSON.stringify(["Order not received by customer", "Potential fraudulent claim"]), orderDate]
      );
    }
  }
  console.log(`  ✅ 30 orders with items, addresses, and timeline\n`);

  // ═══════════════════════════════════════════════
  // 5. REVIEWS (50)
  // ═══════════════════════════════════════════════
  console.log("⭐ Seeding reviews...");
  await conn.execute("TRUNCATE TABLE reviews");

  const reviewTexts = [
    "Absolutely love this product! Quality exceeded my expectations.",
    "Great quality, fast delivery. Will buy again!",
    "Perfect gift for my sister. She loved it!",
    "The scent lasts all day. Amazing product.",
    "Beautiful design, premium feel. Worth every taka.",
    "My skin has never looked better after using this.",
    "Good product but packaging could be better.",
    "Exactly as described. Very happy with my purchase.",
    "Color is slightly different from photos but still nice.",
    "Best purchase I've made this year!",
  ];

  for (let i = 0; i < 50; i++) {
    const pIdx = randBetween(1, 100);
    const cIdx = (i % 20) + 1;
    await conn.execute(
      "INSERT INTO reviews (id, product_id, product_name, customer_id, customer_name, rating, title, comment, is_verified_purchase, is_approved, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)",
      [`rev-${i + 1}`, `prod-${pIdx}`, `Product ${pIdx}`, `cust-${cIdx}`, customerData[cIdx - 1].name, randBetween(3, 5), i % 3 === 0 ? "Great product!" : null, pick(reviewTexts), seededRand() < 0.7, randomDate(6, 0)]
    );
  }
  console.log(`  ✅ 50 reviews\n`);

  // ═══════════════════════════════════════════════
  // 6. COUPONS, BANNERS, BLOG, DELIVERY, ADMIN
  // ═══════════════════════════════════════════════
  console.log("🎫 Seeding coupons, banners, blog, delivery, admin...");

  // Coupons
  await conn.execute("TRUNCATE TABLE coupons");
  const couponData = [
    ["coupon-1", "WELCOME10", "10% off for new customers", "percentage", 10, 1500, 500, 1000, 342],
    ["coupon-2", "BEAUTY20", "20% off skincare", "percentage", 20, 2000, 1000, 500, 189],
    ["coupon-3", "FLAT500", "Flat ৳500 off above ৳5000", "fixed", 500, 5000, null, 300, 98],
    ["coupon-4", "LUXE15", "15% off bags & jewelry", "percentage", 15, 3000, 2000, 200, 56],
    ["coupon-5", "FREESHIP", "Free shipping", "fixed", 120, null, null, 1000, 432],
  ];
  for (const c of couponData) {
    await conn.execute(
      "INSERT INTO coupons (id, code, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, used_count, valid_from, valid_until, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '2025-01-01', '2026-12-31', TRUE)",
      c
    );
  }

  // Banners
  await conn.execute("TRUNCATE TABLE banners");
  const bannerData = [
    ["banner-1", "Summer Glow Collection", "Discover radiance with our new skincare", "https://picsum.photos/seed/hero-1/1920/800", "/collections/new-arrivals", "Shop Now", "hero", 1],
    ["banner-2", "Luxury Bags Collection", "Elevate your style with premium bags", "https://picsum.photos/seed/hero-2/1920/800", "/categories/bags", "Explore", "hero", 2],
    ["banner-3", "Signature Scents", "Find your signature fragrance", "https://picsum.photos/seed/hero-3/1920/800", "/categories/perfumes", "Discover", "hero", 3],
    ["banner-4", "Free Shipping Over ৳3,000", "Limited time offer", "https://picsum.photos/seed/promo-1/1200/400", "/products", "Shop Now", "promo", 1],
  ];
  for (const b of bannerData) {
    await conn.execute(
      "INSERT INTO banners (id, title, subtitle, image, link, cta_text, position, `order`, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)",
      b
    );
  }

  // Blog Posts
  await conn.execute("TRUNCATE TABLE blog_posts");
  const blogData = [
    ["blog-1", "The Ultimate Guide to Korean Skincare", "korean-skincare-routine-guide", "Discover the 10-step Korean skincare routine.", "Korean skincare has revolutionized beauty worldwide...", "https://picsum.photos/seed/blog-1/800/450", "Skincare", 8, 1250],
    ["blog-2", "5 Must-Have Perfumes for the Modern Woman", "must-have-perfumes-modern-woman", "Five signature scents for your fragrance wardrobe.", "Choosing the perfect perfume is personal...", "https://picsum.photos/seed/blog-2/800/450", "Perfumes", 5, 890],
    ["blog-3", "How to Style Your Bag for Every Occasion", "style-bag-every-occasion", "Pair the perfect bag with any outfit.", "A well-chosen bag transforms an outfit...", "https://picsum.photos/seed/blog-3/800/450", "Fashion", 6, 760],
    ["blog-4", "Jewelry Trends 2026", "jewelry-trends-2026", "Trends that will define style this season.", "The jewelry world is evolving...", "https://picsum.photos/seed/blog-4/800/450", "Jewelry", 7, 1100],
    ["blog-5", "Science Behind Premium Sunscreens", "science-behind-premium-sunscreens", "Understanding SPF and PA ratings.", "Sunscreen is the most important skincare step...", "https://picsum.photos/seed/blog-5/800/450", "Skincare", 10, 2300],
    ["blog-6", "Imported vs Local Products", "imported-vs-local-authentic-products", "Why authentic imported products matter.", "In beauty, authenticity is everything...", "https://picsum.photos/seed/blog-6/800/450", "Beauty", 6, 1800],
  ];
  for (const b of blogData) {
    await conn.execute(
      "INSERT INTO blog_posts (id, title, slug, excerpt, content, featured_image, category, reading_time, views, author_name, is_published, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ChineXa Team', TRUE, NOW(), NOW())",
      b
    );
  }

  // Delivery Zones
  await conn.execute("TRUNCATE TABLE delivery_zones");
  const zoneData = [
    ["dhaka-city", "Dhaka City", "Gulshan, Banani, Dhanmondi, Uttara, Mirpur", 60, "1-2"],
    ["dhaka-sub", "Dhaka Suburbs", "Gazipur, Narayanganj, Savar, Tongi", 100, "2-3"],
    ["chittagong", "Chittagong", "Chittagong, Cox's Bazar, Comilla", 120, "3-5"],
    ["rajshahi", "Rajshahi", "Rajshahi, Bogra, Pabna", 130, "3-5"],
    ["khulna", "Khulna", "Khulna, Jessore, Satkhira", 130, "3-5"],
    ["sylhet", "Sylhet", "Sylhet, Moulvibazar, Habiganj", 140, "4-6"],
    ["rangpur", "Rangpur", "Rangpur, Dinajpur, Thakurgaon", 140, "4-6"],
    ["barisal", "Barisal", "Barisal, Patuakhali, Bhola", 150, "4-7"],
    ["mymensingh", "Mymensingh", "Mymensingh, Jamalpur, Netrokona", 130, "3-5"],
  ];
  for (const z of zoneData) {
    await conn.execute("INSERT INTO delivery_zones (id, name, areas, charge, estimated_days, is_active) VALUES (?, ?, ?, ?, ?, TRUE)", z);
  }

  // Delivery Partners
  await conn.execute("TRUNCATE TABLE delivery_partners");
  const partnerData = [
    ["steadfast", "Steadfast Courier", "https://steadfast.com.bd/track"],
    ["pathao", "Pathao Courier", "https://pathao.com/track"],
    ["redx", "RedX", "https://redx.com.bd/track"],
    ["sundarban", "Sundarban Courier", "https://sundarbanbd.com/track"],
    ["paperfly", "Paperfly", "https://paperfly.com.bd/track"],
  ];
  for (const p of partnerData) {
    await conn.execute("INSERT INTO delivery_partners (id, name, tracking_url, is_active) VALUES (?, ?, ?, TRUE)", p);
  }

  // Admin Users
  await conn.execute("TRUNCATE TABLE admin_users");
  await conn.execute("TRUNCATE TABLE roles");
  await conn.execute(
    "INSERT INTO roles (id, name, description, permissions) VALUES ('r1', 'Super Admin', 'Full access', ?)",
    [JSON.stringify(["products", "orders", "customers", "reviews", "blog", "seo", "analytics", "accounting", "settings", "users", "fraud"])]
  );
  await conn.execute(
    "INSERT INTO admin_users (id, name, email, phone, role_id, is_active) VALUES ('admin-1', 'Admin', 'admin@chinexa.com', '+8801700000000', 'r1', TRUE)"
  );

  console.log("  ✅ Coupons, banners, blog posts, delivery zones, partners, admin users\n");

  // Re-enable FK checks
  await conn.execute("SET FOREIGN_KEY_CHECKS = 1");

  // Summary
  const [counts] = await conn.execute(`
    SELECT
      (SELECT COUNT(*) FROM categories) as categories,
      (SELECT COUNT(*) FROM products) as products,
      (SELECT COUNT(*) FROM product_images) as images,
      (SELECT COUNT(*) FROM product_variants) as variants,
      (SELECT COUNT(*) FROM customers) as customers,
      (SELECT COUNT(*) FROM orders) as orders,
      (SELECT COUNT(*) FROM order_items) as order_items,
      (SELECT COUNT(*) FROM reviews) as reviews,
      (SELECT COUNT(*) FROM coupons) as coupons,
      (SELECT COUNT(*) FROM banners) as banners,
      (SELECT COUNT(*) FROM blog_posts) as blog_posts,
      (SELECT COUNT(*) FROM delivery_zones) as zones,
      (SELECT COUNT(*) FROM delivery_partners) as partners
  `);

  console.log("═══════════════════════════════════════");
  console.log("🎉 Database seeded successfully!");
  console.log("═══════════════════════════════════════");
  console.log(JSON.stringify(counts[0], null, 2));

  await conn.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
