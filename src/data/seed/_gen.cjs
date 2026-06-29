const fs = require('fs');

function slug(n) { return n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function rr(min, max, rng) { return Math.round((min + rng() * (max - min)) / 50) * 50; }
function sr(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }

const cats = [
  { id:"skincare", name:"Skincare", n:60, pMin:800, pMax:8000, subs:["serums","moisturizers","cleansers","masks","toners","sunscreen"] },
  { id:"bags", name:"Bags", n:45, pMin:2000, pMax:25000, subs:["handbags","clutches","tote-bags","crossbody"] },
  { id:"jewels", name:"Jewels", n:45, pMin:500, pMax:15000, subs:["necklaces","earrings","rings","bracelets","sets"] },
  { id:"perfumes", name:"Perfumes", n:40, pMin:1500, pMax:12000, subs:["edp","edt","body-mists","gift-sets"] },
  { id:"shoes", name:"Shoes", n:40, pMin:2000, pMax:18000, subs:["heels","flats","sandals","wedges"] },
  { id:"imported", name:"Imported", n:40, pMin:3000, pMax:30000, subs:["luxury-skincare","luxury-fragrance","luxury-accessories","luxury-cosmetics"] },
  { id:"preorder", name:"Preorder", n:30, pMin:1500, pMax:20000, subs:["upcoming-skincare","upcoming-fragrance","upcoming-bags","upcoming-accessories"] },
];

const names = {
skincare:["Luminous Glow Vitamin C Serum","HydraBoost Hyaluronic Acid Moisturizer","Gentle Foam Purifying Cleanser","Rose Petal Rejuvenating Mask","AquaPure Balancing Toner","UV Shield Pro SPF 50+ Sunscreen","Retinol Renewal Night Serum","CeraVeil Barrier Repair Cream","Deep Pore Charcoal Cleanser","Golden Honey Nourishing Mask","Green Tea Clarifying Toner","SunGlow Matte Finish SPF 40","Niacinamide Brightening Serum","Collagen Plump Rich Moisturizer","Micellar Water Gentle Cleanser","Turmeric Radiance Clay Mask","Witch Hazel Pore Minimizing Toner","Invisible Defense SPF 50 PA++++","Peptide Firming Eye Serum","Shea Butter Ultra Hydrating Cream","Salicylic Acid Gel Cleanser","Matcha Detox Overnight Mask","Centella Calming Essence Toner","Mineral Shield Tinted Sunscreen","Snail Mucin Repair Serum","Squalane Lightweight Moisturizer","Oil-Free Foam Wash Cleanser","Avocado Intense Hydration Mask","Rice Water Brightening Toner","Daily Defense Lightweight SPF 35","Bakuchiol Anti-Aging Serum","Cica Recovery Soothing Cream","Double Cleanse Balm-to-Oil Cleanser","Pearl Luminosity Sheet Mask","Bamboo Extract Hydrating Toner","Sport Shield Water-Resistant SPF 50","Alpha Arbutin Dark Spot Serum","Ceramide Intensive Night Cream","Enzyme Powder Exfoliating Cleanser","Propolis Healing Overnight Mask","Aloe Vera Soothing Mist Toner","Glow Boost UV Primer SPF 45","Tranexamic Acid Clarity Serum","Oat Silk Sensitive Skin Moisturizer","Tea Tree Blemish Control Cleanser","Colloidal Gold Firming Mask","Rosewater Hydrating Spritz Toner","Anti-Pollution City Shield SPF 40","Ferulic Acid Antioxidant Serum","Probiotics Microbiome Cream","Coconut Milk Creamy Cleanser","Mugwort Calming Jelly Mask","Kombucha Glow Ferment Toner","Blue Light Defense Digital SPF 30","Azelaic Acid Smoothing Serum","Waterbank Hydro Gel Cream","Papaya Enzyme Brightening Cleanser","Caviar Luxe Rejuvenating Mask","Heartleaf Soothing pH Toner","Aqua Sun Gel Ultra-Light SPF 50+"],
bags:["Milano Structured Leather Handbag","Velvet Noir Evening Clutch","Canvas Luxe Weekend Tote","Petite Chain Crossbody Bag","Parisian Chic Top-Handle Bag","Crystal Embellished Box Clutch","Heritage Monogram Tote Bag","Quilted Mini Crossbody Purse","Executive Leather Satchel Handbag","Satin Bow Detail Clutch","Oversized Shopper Canvas Tote","Saddle Stitch Crossbody Bag","Croc-Embossed Lady Handbag","Pearl Clasp Envelope Clutch","Woven Raffia Beach Tote","Tassel Fringe Bohemian Crossbody","Structured Flap Briefcase Handbag","Metallic Mesh Party Clutch","Reversible Leather Tote Bag","Camera Style Mini Crossbody","Bamboo Handle Resort Handbag","Jeweled Minaudiere Evening Clutch","Eco-Canvas Daily Tote","Chain Strap Convertible Crossbody","Doctor Bag Vintage Handbag","Feather Trim Cocktail Clutch","Monochrome Leather Work Tote","Phone Pouch Mini Crossbody","Bucket Style Drawstring Handbag","Lucite Panel Modern Clutch","Stripe Print Summer Tote","Half-Moon Shoulder Crossbody","Pebbled Leather City Handbag","Art Deco Beaded Clutch","Contrast Stitch Carry-All Tote","Micro Quilted Chain Crossbody","Soft Leather Hobo Handbag","Snake Print Fold-Over Clutch","Neoprene Sport Casual Tote","Embroidered Floral Crossbody","Trapeze Shape Modern Handbag","Sequin Star Evening Clutch","Roll-Top Minimalist Tote","Leather Baguette Shoulder Crossbody","Wicker Basket Artisan Handbag"],
jewels:["Celestial Star Pendant Necklace","Crystal Drop Chandelier Earrings","Infinity Band Diamond Ring","Pearl Strand Classic Bracelet","Royal Heritage Jewellery Set","Baroque Pearl Chain Necklace","Emerald Cut Stud Earrings","Twisted Gold Signet Ring","Tennis Sparkle CZ Bracelet","Sapphire Dream Bridal Set","Layered Snake Chain Necklace","Geometric Art Deco Earrings","Solitaire Promise Ring","Charm Collector Link Bracelet","Victorian Rose Gold Set","Moonstone Teardrop Necklace","Huggie Hoop Pave Earrings","Stackable Eternity Ring","Cuff Bangle Statement Bracelet","Diamond Essence Complete Set","Choker Style Crystal Necklace","Mismatched Asymmetric Earrings","Nature Leaf Wrap Ring","Beaded Stretch Gemstone Bracelet","Pearl and Gold Layered Set","Lariat Y-Drop Necklace","Tassel Thread Statement Earrings","Cathedral Setting Engagement Ring","Herringbone Chain Bracelet","Vintage Cameo Heirloom Set","Coin Medallion Pendant Necklace","Ear Climber Crawler Earrings","Three-Stone Anniversary Ring","Sliding Knot Adjustable Bracelet","Minimalist Bar Jewellery Set","Filigree Heart Locket Necklace","Front-Back Double Earrings","Wide Band Hammered Ring","ID Tag Engraved Bracelet","Kundan Meenakari Traditional Set","Torque Open Collar Necklace","Constellation Zodiac Earrings","Spinner Anxiety Relief Ring","Evil Eye Protection Bracelet","Boho Turquoise Festival Set"],
perfumes:["Midnight Rose Eau de Parfum","Ocean Breeze Eau de Toilette","Vanilla Orchid Body Mist","Signature Scent Luxury Gift Set","Amber Oud Intense EDP","Fresh Citrus Burst EDT","Jasmine Dreams Body Spray","Discovery Collection Mini Set","Velvet Noir EDP Exclusive","Aqua Marine Sport EDT","Peony Blush Shimmer Body Mist","Date Night Duo Gift Set","Sandalwood Mystique EDP","Green Tea Garden EDT","Tropical Sunset Body Mist","Bestseller Trio Gift Set","Rose Gold Elixir EDP","Cool Water Rush EDT","Cotton Candy Sweet Body Mist","His and Hers Couple Gift Set","Black Opium Noir EDP","Lavender Fields EDT","Cherry Blossom Petal Body Mist","Fragrance Wardrobe Gift Set","Tobacco Vanille EDP","Lemon Zest Energizing EDT","Coconut Paradise Body Mist","Travel Essentials Mini Gift Set","Iris Absolute EDP","Bergamot Sage EDT","Honey Glow Shimmer Body Mist","Eid Special Luxury Gift Set","Patchouli Essence EDP","Cucumber Melon Fresh EDT","Wild Berry Body Mist","Anniversary Platinum Gift Set","Musk Blanc Pure EDP","Sea Salt Driftwood EDT","Caramel Latte Gourmand Body Mist","Collector Edition Vault Gift Set"],
shoes:["Stiletto Point Slingback Heels","Ballet Bow Leather Flats","Braided Strap Slide Sandals","Cork Platform Espadrille Wedges","Block Heel Ankle Strap Heels","Quilted Leather Ballerina Flats","Jeweled Thong Evening Sandals","Suede Peep-Toe High Wedges","Kitten Heel Pearl Mules","Pointed Toe DOrsay Flats","Gladiator Lace-Up Tall Sandals","Raffia Woven Platform Wedges","Sculpted Heel Statement Pumps","Embellished Loafer Flat Shoes","Minimalist Two-Strap Sandals","Chunky Wood Heel Wedges","Metallic Strappy Cage Heels","Velvet Smoking Slipper Flats","Pearl Ankle-Wrap Flat Sandals","Jute Rope Tied Wedge Heels","Clear PVC Panel Heels","Mesh Knit Comfort Flats","Padded Leather Slide Sandals","Crochet Detail Summer Wedges","Lucite Block Heel Mules","Leather Cap-Toe Ballet Flats","Feather Trim Party Sandals","Denim Patchwork Casual Wedges","Satin Bow Pointed Heels","Leopard Print Loafer Flats","Metallic Chain Link Sandals","Floral Embroidered Wedges","Patent Leather Mary Jane Heels","Fur-Lined Cozy Moccasin Flats","Crystal Buckle Dress Sandals","Woven Leather Platform Wedges","Sculptural Asymmetric Heels","Studded Rock Chic Flats","Toe Ring Bohemian Sandals","Canvas Striped Nautical Wedges"],
imported:["Sulwhasoo First Care Activating Serum","Tatcha Dewy Skin Cream","La Mer Creme de la Mer Moisturizer","Chanel No 5 LEau Fragrance","Gucci Bamboo Leather Tote","Tiffany T Wire Diamond Ring","SK-II Facial Treatment Essence","Jo Malone Peony and Blush Suede","YSL Kate Chain Wallet Bag","Cartier Love Bracelet Rose Gold","Estee Lauder Advanced Night Repair","Dior Jadore Infinissime EDP","Prada Re-Edition Nylon Bag","Bvlgari Serpenti Viper Ring","Shiseido Ultimune Power Infusing Serum","Tom Ford Black Orchid EDP","Fendi Peekaboo Mini Bag","Hermes Clic Clac H Bracelet","Laneige Water Sleeping Mask","Acqua di Parma Colonia EDP","Bottega Veneta Cassette Bag","Mikimoto Pearl Strand Necklace","Drunk Elephant Protini Cream","Maison Margiela Replica EDT","Valentino Garavani Rockstud Heels","Chopard Happy Diamonds Earrings","Cosrx Advanced Snail 96 Mucin","Byredo Gypsy Water EDP","Celine Triomphe Canvas Bag","David Yurman Cable Classics Bracelet","Dr Jart Cicapair Tiger Grass Cream","Diptyque Baies Candle and Mist Set","Loewe Puzzle Edge Small Bag","Georg Jensen Mercy Pendant Necklace","Biologique Recherche P50 Lotion","Penhaligons Halfeti EDP","Mansur Gavriel Bucket Bag","Monica Vinader Alta Capture Ring","Amorepacific Time Response Cream","Creed Aventus For Her EDP"],
preorder:["Aurora Glass Skin Ampoule","Dusk to Dawn Oud Parfum","Geometric Prism Clutch Bag","Celestial Orbit Pendant Set","Cloud Nine Cushion Foundation","Botanical Garden EDP Collection","Origami Fold Leather Tote","Constellation Map Ring Set","Bio-Retinol Super Serum 2.0","Noir Intense Parfum Extrait","Holographic Mini Crossbody","Ocean Pearl Drop Earrings","Barrier Repair Ceramide Kit","Oud Rose Attar Limited EDP","Architectural Frame Handbag","Zodiac Birthstone Bracelet","Next-Gen Peptide Eye Cream","Velvet Whisper Body Parfum","Convertible 3-Way Bag","Art Nouveau Filigree Necklace","Probiotic Glow Essence Toner","Amber Saffron Niche Parfum","Puffer Quilted Chain Bag","Moissanite Solitaire Ring","Centella Recovery Sleeping Pack","Fresh Fig Leaf EDT","Crescent Moon Shoulder Bag","Layered Chain Anklet Set","Glass Skin Primer SPF 45","Legacy Collection Parfum Gift Set"]
};

const hexMap = {"Black":"#000000","Tan":"#D2B48C","Burgundy":"#800020","Ivory":"#FFFFF0","Rose Gold":"#B76E79","Silver":"#C0C0C0","Gold":"#FFD700","Champagne":"#F7E7CE"};
const origins = {imported:["Korea","Japan","France","Italy","USA","UK"], preorder:["Korea","Japan","France","Italy","USA"]};

const ingredients = [
  "Water, Ascorbic Acid (Vitamin C), Propanediol, Glycerin, Ascorbyl Glucoside, Sodium Hyaluronate, Panthenol, Niacinamide, Tocopherol, Ferulic Acid, Citric Acid, Phenoxyethanol",
  "Water, Glycerin, Dimethicone, Hyaluronic Acid, Squalane, Ceramide NP, Cholesterol, Phytosphingosine, Sodium Lauroyl Lactylate, Carbomer, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin",
  "Water, Sodium Cocoyl Glycinate, Cocamidopropyl Betaine, Glycerin, Sodium Chloride, Panthenol, Allantoin, Citric Acid, Sodium Benzoate, Fragrance",
  "Water, Kaolin, Bentonite, Glycerin, Rosa Damascena Flower Water, Honey Extract, Centella Asiatica Extract, Aloe Barbadensis Leaf Juice, Tocopherol, Phenoxyethanol",
  "Water, Butylene Glycol, Glycerin, Niacinamide, Hamamelis Virginiana Water, Panthenol, Allantoin, Sodium Hyaluronate, Centella Asiatica Extract, Ethylhexylglycerin",
  "Homosalate, Octisalate, Zinc Oxide, Titanium Dioxide, Water, Glycerin, Dimethicone, Niacinamide, Tocopherol, Bisabolol, Allantoin, Phenoxyethanol",
  "Water, Propanediol, Retinol, Squalane, Ceramide NP, Adenosine, Peptide Complex, Tocopherol, Bisabolol, Ethylhexylglycerin, Phenoxyethanol",
  "Water, Glycerin, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Ceramide AP, Ceramide EOP, Ceramide NP, Phytosphingosine, Cholesterol, Dimethicone",
  "Water, Cocamidopropyl Betaine, Sodium C14-16 Olefin Sulfonate, Charcoal Powder, Glycerin, Salicylic Acid, Tea Tree Oil, Niacinamide, Allantoin, Phenoxyethanol",
  "Water, Glycerin, Butylene Glycol, Snail Secretion Filtrate, Niacinamide, Sodium Hyaluronate, Panthenol, Arginine, Allantoin, Carbomer, Ethylhexylglycerin"
];

const howToUse = [
  "Apply 3-4 drops to cleansed face and neck. Gently pat until absorbed. Use morning and evening before moisturizer.",
  "After cleansing and toning, apply a generous amount to face and neck. Massage in upward circular motions until fully absorbed.",
  "Wet face with lukewarm water. Dispense a small amount and lather between palms. Massage onto face for 30-60 seconds, then rinse thoroughly.",
  "Apply an even layer to cleansed face, avoiding the eye area. Leave on for 10-15 minutes, then rinse off with lukewarm water. Use 2-3 times per week.",
  "After cleansing, saturate a cotton pad and sweep across face and neck. Alternatively, pour into palms and press gently onto skin.",
  "Apply generously as the last step of your skincare routine, 15 minutes before sun exposure. Reapply every 2 hours when outdoors."
];

const shortDescs = {
  skincare:["A potent formula that targets uneven skin tone and dullness for a radiant complexion.","Deeply hydrating treatment that locks in moisture for up to 72 hours of plump, dewy skin.","Gentle yet effective cleanser that removes impurities without stripping the skin's natural barrier.","Intensive treatment mask that revitalizes tired skin with concentrated botanical extracts.","Alcohol-free toner that balances skin pH while delivering a boost of lightweight hydration.","Broad-spectrum protection that shields against UVA/UVB rays with a weightless, non-greasy finish."],
  bags:["Exquisitely crafted handbag featuring premium materials and timeless silhouette for everyday elegance.","Compact evening clutch with refined detailing, perfect for special occasions and nights out.","Spacious tote designed for the modern woman who values both style and functionality.","Versatile crossbody bag with adjustable strap, ideal for hands-free sophistication on the go."],
  jewels:["Stunning statement necklace that elevates any outfit with its intricate craftsmanship and shine.","Elegant earrings featuring meticulous detailing that catch light beautifully with every movement.","Beautifully designed ring that makes a lasting impression, perfect for gifting or self-expression.","Delicate bracelet combining classic design with modern elegance for effortless wrist styling.","Curated jewellery set offering perfectly coordinated pieces for a complete, polished look."],
  perfumes:["A captivating eau de parfum with rich, long-lasting sillage that leaves an unforgettable impression.","Light and refreshing eau de toilette perfect for daytime wear and casual outings.","Delightfully scented body mist offering a subtle veil of fragrance for all-day freshness.","Beautifully packaged gift set featuring complementary fragrances for the ultimate scent experience."],
  shoes:["Sleek heels with expert proportions that combine runway style with all-day wearable comfort.","Effortlessly chic flats crafted from premium materials for sophisticated everyday styling.","Stylish sandals designed with comfort-first construction and trend-forward aesthetic appeal.","Elevated wedges offering height and stability with a fashion-forward silhouette for any occasion."],
  imported:["Authentic luxury import featuring world-renowned formulation trusted by beauty enthusiasts globally.","Premium imported product sourced directly from the brand, guaranteed 100% genuine and fresh."],
  preorder:["Highly anticipated upcoming launch — secure yours early before the official release date.","Exclusive preorder item featuring next-generation formulation and limited first-batch availability."]
};

const longDescs = {
  skincare:[
    "This advanced serum harnesses the power of stabilized active ingredients to deliver visible results within weeks. The lightweight, fast-absorbing formula penetrates deep into the skin layers to address multiple concerns simultaneously. Suitable for all skin types, it works synergistically with your existing skincare routine. Clinical trials have shown significant improvement in skin texture, tone, and overall radiance. Made with ethically sourced ingredients and free from parabens, sulfates, and artificial fragrances.",
    "Our bestselling moisturizer features a unique blend of hydrating compounds that create a moisture reservoir in the skin. The rich yet non-greasy texture melts into the skin, providing instant comfort and long-term hydration benefits. Enriched with antioxidants to protect against environmental stressors throughout the day. Perfect for dry to combination skin types seeking a healthy, dewy glow. Dermatologist-tested and suitable for sensitive skin.",
    "Experience a new level of clean with this pH-balanced cleanser that effectively removes makeup, SPF, and daily impurities. The innovative formula transforms from gel to a creamy lather, making the cleansing ritual both effective and enjoyable. Infused with skin-loving ingredients that leave your face feeling fresh, soft, and never tight. Ideal as both a morning refresh and evening deep cleanse. Free from harsh sulfates and suitable for all skin types including sensitive skin.",
    "Transform your skincare routine with this spa-quality mask that delivers professional-grade results at home. The unique texture adheres perfectly to facial contours, allowing maximum absorption of concentrated active ingredients. Natural botanical extracts work together to soothe, firm, and brighten the complexion in just 15 minutes. Perfect for weekly pampering sessions or pre-event skin preparation. Each application reveals smoother, more refined, and luminous skin.",
    "This carefully formulated toner bridges the gap between cleansing and treatment in your skincare regimen. The gentle, alcohol-free formula sweeps away residual impurities while infusing the skin with a layer of lightweight hydration. Preps the skin to better absorb subsequent serums and moisturizers, maximizing their efficacy. Contains soothing botanical extracts that calm and balance even the most reactive skin types. A true multitasker that refines pores and evens out skin tone over time.",
    "Stay protected without compromising on skin comfort with this next-generation sunscreen technology. The ultra-light formula provides robust broad-spectrum protection against harmful UVA and UVB rays, blue light, and environmental pollution. Leaves no white cast, making it perfect for all skin tones and an excellent makeup base. Water-resistant for up to 80 minutes, ideal for active lifestyles and outdoor activities. Enriched with skincare benefits including antioxidants and hydrating agents for protection that actually improves your skin."
  ],
  bags:[
    "Meticulously handcrafted from the finest materials, this bag represents the perfect marriage of luxury and practicality. The thoughtfully designed interior features multiple compartments to keep your essentials organized while maintaining a sleek exterior profile. Premium hardware and reinforced stitching ensure this piece will remain a wardrobe staple for years to come. The versatile design transitions seamlessly from professional settings to weekend brunches. A true investment piece that embodies timeless elegance.",
    "Make a statement with this exquisitely designed piece that captures the essence of contemporary luxury fashion. Every detail has been carefully considered, from the hand-selected materials to the precision-crafted closures and finishing touches. The compact size belies its clever interior organization, accommodating all evening essentials with ease. The detachable chain strap offers versatility in how you choose to carry it. A showstopping accessory that complements both formal gowns and chic cocktail attire.",
    "Designed for the woman who refuses to compromise between style and substance, this spacious bag handles everything your day demands. The durable yet luxurious exterior resists daily wear while maintaining its sophisticated appearance over time. Interior pockets and a secure zip compartment keep valuables safe and accessible on the move. Comfortable shoulder straps distribute weight evenly for all-day carrying comfort. An essential everyday companion that elevates any outfit effortlessly.",
    "This thoughtfully proportioned crossbody bag offers the ultimate in hands-free convenience without sacrificing an ounce of style. The adjustable strap allows for customized positioning, whether worn across the body or over the shoulder. Premium materials and expert construction create a bag that feels as luxurious as it looks. The smart interior layout maximizes storage in a compact footprint. Perfect for everything from daily commutes to travel adventures and weekend explorations."
  ],
  jewels:[
    "This breathtaking piece showcases exceptional artisan craftsmanship, with each element meticulously placed to create a harmonious design. The lustrous finish catches light from every angle, creating a mesmerizing play of brilliance and sophistication. Crafted from premium materials that are hypoallergenic and tarnish-resistant for lasting beauty. The secure clasp mechanism ensures confident wear throughout the day or evening. A versatile piece that elevates both casual and formal ensembles.",
    "Designed to be both a personal indulgence and a meaningful gift, this jewellery piece embodies elegance in its purest form. The intricate detailing reveals new beauty upon closer inspection, a hallmark of superior craftsmanship. Made with nickel-free materials suitable for sensitive skin, ensuring comfortable all-day wear. The timeless design transcends seasonal trends, making it a worthy addition to any jewellery collection. Presented in a luxurious gift box, ready for giving or treasuring.",
    "Express your unique style with this contemporary jewellery piece that balances bold design with refined elegance. The premium plating ensures a lasting lustre that maintains its beauty through daily wear and beyond. Lightweight construction means you can make a statement without any discomfort throughout long days and evenings. Each piece undergoes rigorous quality inspection to meet our exacting standards of excellence. Pair with complementary pieces from our collection for a curated, coordinated look.",
    "This elegant bracelet exemplifies the art of fine jewellery making with its fluid lines and meticulous detailing. The comfortable fit allows for effortless everyday wear while maintaining a presence that draws admiring glances. Premium materials ensure lasting beauty and resistance to everyday elements. The versatile design layers beautifully with other bracelets or makes a refined statement worn alone. An essential piece for building a sophisticated jewellery wardrobe.",
    "This coordinated jewellery set takes the guesswork out of accessorizing by offering perfectly matched pieces designed to work in harmony. Each element in the set has been crafted with the same attention to detail, creating a cohesive and polished aesthetic. The premium materials and finishes ensure each piece maintains its beauty over time with minimal care. Versatile enough to be worn as a complete set for maximum impact or as individual pieces for everyday elegance. Presented in an elegant gift box, making it perfect for special occasions."
  ],
  perfumes:[
    "Embark on a sensory journey with this masterfully composed fragrance that unfolds in captivating layers throughout the day. The opening notes create an immediate impression that evolves into a rich, complex heart, finally settling into a warm, memorable base. Crafted by renowned perfumers using the finest natural and synthetic ingredients for optimal longevity and sillage. The elegant bottle design makes it a beautiful addition to any vanity. A signature scent that garners compliments and becomes uniquely yours on the skin.",
    "This carefully balanced fragrance captures a specific mood and transforms it into an olfactory experience you can wear. Light enough for everyday enjoyment yet distinctive enough to leave a lasting impression on those around you. The innovative formulation ensures consistent performance from morning application through evening events. Each spray releases a perfectly proportioned blend of top, middle, and base notes. An accessible luxury that elevates your daily routine into something special.",
    "Refresh and uplift your senses with this delightful body mist that offers a lighter alternative to traditional fragrances. The generous formula allows for liberal application throughout the day for continuous freshness and subtle scent. Infused with skin-conditioning ingredients that leave your body feeling softly moisturized after each spray. The convenient spray mechanism delivers a fine, even mist for comfortable, all-over application. Layer with matching body lotion for enhanced longevity and scent depth.",
    "This thoughtfully curated gift set brings together complementary fragrances in beautifully presented packaging. Each piece has been selected to offer a complete scent wardrobe, from fresh daytime options to richer evening choices. The luxurious presentation makes it an ideal gift for birthdays, anniversaries, Eid, or any special celebration. Travel-friendly sizes allow recipients to explore and discover their new signature scent. An exceptional value that introduces the full range of a beloved fragrance collection."
  ],
  shoes:[
    "Engineered for the modern woman who demands both style and comfort, these shoes feature cushioned insoles and balanced proportions. The premium upper materials have been selected for their beauty, breathability, and long-lasting durability. Expert construction techniques ensure a secure, flattering fit that supports your feet through hours of wear. The versatile design pairs effortlessly with everything from tailored trousers to flowing dresses. A wardrobe essential that proves you never have to choose between looking good and feeling great.",
    "Step into effortless elegance with these meticulously crafted shoes that prioritize comfort without compromising on contemporary style. The flexible sole construction moves naturally with your foot, providing all-day wearability for even the busiest schedules. Premium materials develop a beautiful patina over time, making each pair uniquely yours. The classic silhouette ensures these will remain in rotation season after season. Perfect for building a capsule shoe wardrobe of timeless, versatile pieces.",
    "These statement shoes are designed to be the finishing touch that pulls your entire outfit together with confidence. The carefully considered proportions flatter the foot while providing stable, comfortable wear from morning to evening. Artisan finishing details set these apart from ordinary footwear, showcasing quality that is visible and tangible. The durable outsole provides excellent traction on various surfaces for worry-free movement. An investment in style that pays dividends with every wear.",
    "Elevate your look with these beautifully designed wedges that offer the height you want with the stability you need. The ergonomic platform distributes weight evenly across the foot, reducing fatigue during extended wear. Premium materials and meticulous construction create a shoe that is as durable as it is stylish. The contemporary silhouette pairs beautifully with both casual and dressy ensembles for maximum versatility. A summer essential that transitions effortlessly from daytime outings to evening events."
  ],
  imported:[
    "Sourced directly from the original brand and imported with full authentication, this premium product brings international luxury to your doorstep. The acclaimed formulation has earned a devoted global following for its exceptional quality and visible results. Each batch undergoes strict quality control to ensure you receive a product at the peak of its freshness and potency. Our direct import process eliminates intermediaries, offering you authentic luxury at the most competitive price point. Complete with original packaging, batch codes, and authenticity verification for your peace of mind.",
    "Experience the gold standard of international beauty and luxury with this highly sought-after imported product. Developed using cutting-edge research and the finest globally sourced ingredients, it represents the pinnacle of its category. Trusted by professionals, celebrities, and discerning consumers worldwide for its consistent, remarkable performance. We guarantee 100% authenticity with every purchase, backed by verifiable batch numbers and official packaging. A true luxury experience that justifies its cult status in the global beauty and fashion community."
  ],
  preorder:[
    "Be among the first to own this highly anticipated product by securing your preorder today. Developed using next-generation technology and premium ingredients, this launch promises to set new standards in its category. Early preorder customers receive priority shipping and exclusive first-batch packaging that won't be available after the official release. Limited quantities are available in this initial run, making early reservation essential. Expected to ship within 4-6 weeks of the official launch date.",
    "This upcoming release has already generated significant buzz among beauty enthusiasts and industry insiders. The innovative formulation addresses unmet needs identified through extensive consumer research and testing. Preorder now to guarantee your allocation from the limited first production run. Your card will be charged at the time of preorder to secure your reservation. Join the waitlist excitement and be part of the exclusive early adopter community."
  ]
};

function makeVariants(catId, name, s, i, rng) {
  const vs = [];
  const pad = String(i+1).padStart(3,'0');
  const cid = catId.toUpperCase();
  if (catId === "skincare") {
    [["30ml",0],["50ml",300],["100ml",800]].forEach(([v,adj],vi) => {
      vs.push({ id:`var-${s}-${vi+1}`, name:`${name} - ${v}`, type:"size", value:v, price_adjustment:adj, stock:Math.floor(rng()*50)+5, sku:`SKU-${cid}-${pad}-${v.toUpperCase()}` });
    });
  } else if (catId === "bags") {
    ["Black","Tan","Burgundy","Ivory"].forEach((c,vi) => {
      vs.push({ id:`var-${s}-${vi+1}`, name:`${name} - ${c}`, type:"color", value:c, hex:hexMap[c], price_adjustment:0, stock:Math.floor(rng()*30)+3, sku:`SKU-${cid}-${pad}-${c.toUpperCase().replace(/\s/g,'')}` });
    });
  } else if (catId === "jewels") {
    ["Rose Gold","Silver","Gold","Champagne"].forEach((c,vi) => {
      vs.push({ id:`var-${s}-${vi+1}`, name:`${name} - ${c}`, type:"color", value:c, hex:hexMap[c], price_adjustment:vi===2?500:0, stock:Math.floor(rng()*40)+5, sku:`SKU-${cid}-${pad}-${c.toUpperCase().replace(/\s/g,'')}` });
    });
  } else if (catId === "perfumes") {
    [["30ml",0],["50ml",800],["100ml",2000]].forEach(([v,adj],vi) => {
      vs.push({ id:`var-${s}-${vi+1}`, name:`${name} - ${v}`, type:"size", value:v, price_adjustment:adj, stock:Math.floor(rng()*35)+5, sku:`SKU-${cid}-${pad}-${v.toUpperCase()}` });
    });
  } else if (catId === "shoes") {
    ["36","37","38","39","40"].forEach((v,vi) => {
      vs.push({ id:`var-${s}-${vi+1}`, name:`${name} - EU ${v}`, type:"size", value:v, price_adjustment:0, stock:Math.floor(rng()*20)+2, sku:`SKU-${cid}-${pad}-EU${v}` });
    });
  } else if (catId === "imported") {
    [["S",0],["M",0],["L",500]].forEach(([v,adj],vi) => {
      vs.push({ id:`var-${s}-${vi+1}`, name:`${name} - ${v}`, type:"size", value:v, price_adjustment:adj, stock:Math.floor(rng()*15)+2, sku:`SKU-${cid}-${pad}-${v}` });
    });
  } else if (catId === "preorder") {
    vs.push({ id:`var-${s}-1`, name:`${name} - One Size`, type:"size", value:"One Size", price_adjustment:0, stock:0, sku:`SKU-${cid}-${pad}-OS` });
  }
  return vs;
}

let gIdx = 0;
const allProducts = [];

for (const cat of cats) {
  const ns = names[cat.id];
  for (let i = 0; i < cat.n; i++) {
    const rng = sr(gIdx * 7 + 42);
    const nm = ns[i];
    const s = slug(nm);
    const price = rr(cat.pMin, cat.pMax, rng);
    const hasComp = rng() < 0.3;
    const compPrice = hasComp ? Math.round(price * (1.15 + rng()*0.35) / 50)*50 : undefined;
    const subIdx = i % cat.subs.length;
    const sub = cat.subs[subIdx];

    const sd = shortDescs[cat.id][subIdx % shortDescs[cat.id].length];
    const ld = longDescs[cat.id][subIdx % longDescs[cat.id].length];

    const bdg = [];
    if (cat.id === "preorder") { bdg.push("preorder"); }
    else {
      const br = rng();
      if (br < 0.20) bdg.push("new");
      else if (br < 0.35) bdg.push("sale");
      else if (br < 0.45) bdg.push("bestseller");
      else if (br < 0.50) bdg.push("limited");
      else if (br < 0.60) bdg.push("trending");
    }
    if (hasComp && !bdg.includes("sale")) bdg.push("sale");

    const vs = makeVariants(cat.id, nm, s, i, rng);
    const totalStock = vs.reduce((a,v) => a + v.stock, 0);
    const isFeat = rng() < 0.15;
    const rating = Math.round((3.5 + rng()*1.5)*10)/10;
    const revCnt = Math.floor(rng()*150);

    const mAgo = Math.floor(rng()*12);
    const dom = Math.floor(rng()*28)+1;
    let cd = new Date(2025, 6+mAgo, dom);
    const now = new Date(2026, 5, 28);
    if (cd > now) cd = new Date(cd.getTime() - 365*86400000);
    let ud = new Date(cd.getTime() + Math.floor(rng()*30)*86400000);
    if (ud > now) ud = now;

    const imgs = [];
    for (let im = 0; im < 4; im++) {
      imgs.push({ id:`img-${s}-${im+1}`, url:`https://picsum.photos/seed/${s}-${im+1}/600/750`, alt:`${nm} - Image ${im+1}`, order:im });
    }

    const tags = [cat.id, sub];
    if (isFeat) tags.push("featured");
    if (bdg.includes("new")) tags.push("new-arrival");

    const p = {
      id:`prod-${s}`, name:nm, slug:s, description:ld, short_description:sd,
      sku:`SKU-${cat.id.toUpperCase()}-${String(i+1).padStart(3,'0')}`,
      price, currency:"BDT", images:imgs,
      category_id:cat.id, category_name:cat.name, subcategory:sub,
      tags, badges:bdg, variants:vs, stock_quantity:totalStock,
      is_active: cat.id !== "preorder" || rng() < 0.5,
      is_featured:isFeat, average_rating:rating, review_count:revCnt,
      created_at:cd.toISOString(), updated_at:ud.toISOString(),
      seo_title:`${nm} | ChineXa Bangladesh`,
      seo_description:sd
    };
    if (compPrice) p.compare_at_price = compPrice;
    if (cat.id === "imported" || cat.id === "preorder") {
      const ors = origins[cat.id];
      p.country_of_origin = ors[Math.floor(rng()*ors.length)];
    }
    if (cat.id === "skincare" || cat.id === "imported") {
      p.ingredients = ingredients[i % ingredients.length];
      p.how_to_use = howToUse[i % howToUse.length];
      p.weight = ["30ml","50ml","100ml","150ml","200ml"][i%5];
    }
    if (cat.id === "perfumes") p.weight = ["30ml","50ml","75ml","100ml"][i%4];
    if (cat.id === "bags") p.weight = ["350g","450g","550g","650g","800g"][i%5];
    if (cat.id === "shoes") p.weight = ["250g","300g","350g","400g"][i%4];
    if (cat.id === "jewels") p.weight = ["15g","25g","35g","50g","75g"][i%5];

    allProducts.push(p);
    gIdx++;
  }
}

// Write output
let out = 'import { Product } from "@/types/product";\n\nexport const products: Product[] = [\n';

for (const p of allProducts) {
  out += '  {\n';
  out += `    id: ${JSON.stringify(p.id)},\n`;
  out += `    name: ${JSON.stringify(p.name)},\n`;
  out += `    slug: ${JSON.stringify(p.slug)},\n`;
  out += `    description: ${JSON.stringify(p.description)},\n`;
  out += `    short_description: ${JSON.stringify(p.short_description)},\n`;
  out += `    sku: ${JSON.stringify(p.sku)},\n`;
  out += `    price: ${p.price},\n`;
  if (p.compare_at_price) out += `    compare_at_price: ${p.compare_at_price},\n`;
  out += `    currency: "BDT",\n`;
  out += `    images: [\n`;
  for (const im of p.images) {
    out += `      { id: ${JSON.stringify(im.id)}, url: ${JSON.stringify(im.url)}, alt: ${JSON.stringify(im.alt)}, order: ${im.order} },\n`;
  }
  out += `    ],\n`;
  out += `    category_id: ${JSON.stringify(p.category_id)},\n`;
  out += `    category_name: ${JSON.stringify(p.category_name)},\n`;
  if (p.subcategory) out += `    subcategory: ${JSON.stringify(p.subcategory)},\n`;
  out += `    tags: ${JSON.stringify(p.tags)},\n`;
  out += `    badges: ${JSON.stringify(p.badges)},\n`;
  out += `    variants: [\n`;
  for (const v of p.variants) {
    let vl = `      { id: ${JSON.stringify(v.id)}, name: ${JSON.stringify(v.name)}, type: ${JSON.stringify(v.type)}, value: ${JSON.stringify(v.value)}, `;
    if (v.hex) vl += `hex: ${JSON.stringify(v.hex)}, `;
    vl += `price_adjustment: ${v.price_adjustment}, stock: ${v.stock}, sku: ${JSON.stringify(v.sku)} },\n`;
    out += vl;
  }
  out += `    ],\n`;
  out += `    stock_quantity: ${p.stock_quantity},\n`;
  out += `    is_active: ${p.is_active},\n`;
  out += `    is_featured: ${p.is_featured},\n`;
  out += `    average_rating: ${p.average_rating},\n`;
  out += `    review_count: ${p.review_count},\n`;
  if (p.country_of_origin) out += `    country_of_origin: ${JSON.stringify(p.country_of_origin)},\n`;
  if (p.weight) out += `    weight: ${JSON.stringify(p.weight)},\n`;
  if (p.ingredients) out += `    ingredients: ${JSON.stringify(p.ingredients)},\n`;
  if (p.how_to_use) out += `    how_to_use: ${JSON.stringify(p.how_to_use)},\n`;
  out += `    created_at: ${JSON.stringify(p.created_at)},\n`;
  out += `    updated_at: ${JSON.stringify(p.updated_at)},\n`;
  if (p.seo_title) out += `    seo_title: ${JSON.stringify(p.seo_title)},\n`;
  if (p.seo_description) out += `    seo_description: ${JSON.stringify(p.seo_description)},\n`;
  out += '  },\n';
}

out += '];\n';

fs.writeFileSync('d:/E-commerce/chinexa-app/src/data/seed/products.ts', out, 'utf8');

// Stats
const cc = {};
let fc = 0, cpc = 0;
const bc = {};
for (const p of allProducts) {
  cc[p.category_id] = (cc[p.category_id]||0)+1;
  if (p.is_featured) fc++;
  if (p.compare_at_price) cpc++;
  for (const b of p.badges) bc[b] = (bc[b]||0)+1;
}
console.log("Total products:", allProducts.length);
console.log("Category counts:", JSON.stringify(cc));
console.log("Featured:", fc, ((fc/300*100).toFixed(1))+"%");
console.log("With compare_at_price:", cpc, ((cpc/300*100).toFixed(1))+"%");
console.log("Badge distribution:", JSON.stringify(bc));
console.log("File size:", (Buffer.byteLength(out)/1024).toFixed(1), "KB");
