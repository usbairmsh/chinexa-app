USE chinexa;

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  image VARCHAR(500),
  parent_id VARCHAR(50),
  `order` INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  product_count INT DEFAULT 0,
  seo_title VARCHAR(255),
  seo_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Products
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  short_description TEXT,
  sku VARCHAR(100) NOT NULL UNIQUE,
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2),
  currency VARCHAR(10) DEFAULT 'BDT',
  category_id VARCHAR(50),
  category_name VARCHAR(255),
  subcategory VARCHAR(100),
  tags JSON,
  badges JSON,
  stock_quantity INT DEFAULT 0,
  min_stock INT DEFAULT 10,
  max_stock INT DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  average_rating DECIMAL(3,2) DEFAULT 0,
  review_count INT DEFAULT 0,
  country_of_origin VARCHAR(100),
  weight VARCHAR(50),
  ingredients TEXT,
  how_to_use TEXT,
  seo_title VARCHAR(255),
  seo_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Product Images
CREATE TABLE IF NOT EXISTS product_images (
  id VARCHAR(50) PRIMARY KEY,
  product_id VARCHAR(50) NOT NULL,
  url VARCHAR(500) NOT NULL,
  alt VARCHAR(255),
  `order` INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Product Variants
CREATE TABLE IF NOT EXISTS product_variants (
  id VARCHAR(50) PRIMARY KEY,
  product_id VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  type ENUM('size', 'color', 'shade', 'weight') NOT NULL,
  value VARCHAR(100) NOT NULL,
  hex VARCHAR(10),
  price_adjustment DECIMAL(10,2) DEFAULT 0,
  stock INT DEFAULT 0,
  sku VARCHAR(100) NOT NULL,
  image VARCHAR(500),
  focal_point VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL UNIQUE,
  avatar VARCHAR(500),
  total_orders INT DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  deactivated_at TIMESTAMP NULL,
  deactivation_reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_order_at TIMESTAMP NULL
) ENGINE=InnoDB;

-- Customer Addresses
CREATE TABLE IF NOT EXISTS customer_addresses (
  id VARCHAR(50) PRIMARY KEY,
  customer_id VARCHAR(50) NOT NULL,
  label VARCHAR(50) DEFAULT 'Home',
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address_line_1 VARCHAR(255) NOT NULL,
  address_line_2 VARCHAR(255),
  city VARCHAR(100),
  district VARCHAR(100),
  division VARCHAR(100),
  postal_code VARCHAR(20),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(50) PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id VARCHAR(50),
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'BDT',
  status ENUM('pending', 'confirmed', 'processing', 'shipped', 'on_delivery', 'received', 'not_received') DEFAULT 'pending',
  payment_method VARCHAR(50),
  payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
  transaction_id VARCHAR(100),
  coupon_code VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  product_id VARCHAR(50),
  product_name VARCHAR(255) NOT NULL,
  product_image VARCHAR(500),
  product_slug VARCHAR(255),
  variant VARCHAR(100),
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Order Addresses (billing + shipping)
CREATE TABLE IF NOT EXISTS order_addresses (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  type ENUM('billing', 'shipping') NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  address_line_1 VARCHAR(255) NOT NULL,
  address_line_2 VARCHAR(255),
  city VARCHAR(100),
  district VARCHAR(100),
  division VARCHAR(100),
  postal_code VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Order Timeline
CREATE TABLE IF NOT EXISTS order_timeline (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(50) PRIMARY KEY,
  product_id VARCHAR(50) NOT NULL,
  product_name VARCHAR(255),
  customer_id VARCHAR(50),
  customer_name VARCHAR(255) NOT NULL,
  customer_avatar VARCHAR(500),
  rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title VARCHAR(255),
  comment TEXT NOT NULL,
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  admin_reply TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Coupons
CREATE TABLE IF NOT EXISTS coupons (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  discount_type ENUM('percentage', 'fixed') NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2),
  max_discount_amount DECIMAL(10,2),
  usage_limit INT,
  used_count INT DEFAULT 0,
  valid_from DATETIME NULL,
  valid_until DATETIME NULL,
  is_active BOOLEAN DEFAULT TRUE,
  applicable_categories JSON,
  applicable_products JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Banners
CREATE TABLE IF NOT EXISTS banners (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  image VARCHAR(500) NOT NULL,
  mobile_image VARCHAR(500),
  link VARCHAR(500),
  cta_text VARCHAR(100),
  position ENUM('hero', 'promo', 'category', 'popup') DEFAULT 'hero',
  focal_point VARCHAR(100) DEFAULT '{"x":50,"y":50,"zoom":1}',
  `order` INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  start_date TIMESTAMP NULL,
  end_date TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Blog Posts
CREATE TABLE IF NOT EXISTS blog_posts (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  excerpt TEXT,
  content LONGTEXT,
  featured_image VARCHAR(500),
  category VARCHAR(100),
  tags JSON,
  author_name VARCHAR(255),
  author_avatar VARCHAR(500),
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP NULL,
  reading_time INT DEFAULT 5,
  views INT DEFAULT 0,
  seo_title VARCHAR(255),
  seo_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
  id VARCHAR(50) PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  avatar VARCHAR(500),
  role ENUM('superadmin', 'admin') DEFAULT 'admin',
  permissions JSON,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Roles & Permissions
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(50),
  user_name VARCHAR(255),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(50),
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- SEO Metadata
CREATE TABLE IF NOT EXISTS seo_metadata (
  id INT AUTO_INCREMENT PRIMARY KEY,
  page_path VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(255),
  meta_title VARCHAR(255),
  meta_description TEXT,
  keywords JSON,
  canonical_url VARCHAR(500),
  og_title VARCHAR(255),
  og_description TEXT,
  og_image VARCHAR(500),
  no_index BOOLEAN DEFAULT FALSE,
  no_follow BOOLEAN DEFAULT FALSE,
  custom_schema JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Delivery Zones
CREATE TABLE IF NOT EXISTS delivery_zones (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  areas TEXT,
  charge DECIMAL(10,2) NOT NULL,
  estimated_days VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Delivery Partners
CREATE TABLE IF NOT EXISTS delivery_partners (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  tracking_url VARCHAR(500),
  zones JSON,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Offers
CREATE TABLE IF NOT EXISTS offers (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  applicability ENUM('store', 'categories', 'subcategories', 'customers') DEFAULT 'store',
  applicable_ids JSON,
  discount VARCHAR(100) NOT NULL,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Fraud Alerts
CREATE TABLE IF NOT EXISTS fraud_alerts (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  order_number VARCHAR(50) NOT NULL,
  customer_id VARCHAR(50),
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  risk_score INT DEFAULT 100,
  risk_factors JSON,
  status ENUM('flagged', 'reviewed', 'cleared', 'blocked') DEFAULT 'flagged',
  reviewed_by VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(100) PRIMARY KEY,
  value JSON,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Membership Tiers
CREATE TABLE IF NOT EXISTS membership_tiers (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  min_points INT NOT NULL DEFAULT 0,
  max_points INT NOT NULL DEFAULT 0,
  points_multiplier DECIMAL(4,2) DEFAULT 1.00,
  color VARCHAR(50) DEFAULT 'bg-gray-100 text-gray-600',
  badge_name VARCHAR(100) DEFAULT 'ChineXa General',
  badge_color VARCHAR(20) DEFAULT '#3B82F6',
  badge_opacity DECIMAL(3,2) DEFAULT 1.00,
  benefits JSON,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Customer Points Ledger
CREATE TABLE IF NOT EXISTS customer_points (
  id VARCHAR(50) PRIMARY KEY,
  customer_id VARCHAR(50) NOT NULL,
  points INT NOT NULL,
  type ENUM('purchase', 'bonus', 'redemption', 'admin_adjustment', 'coupon_reward', 'refund') NOT NULL,
  reference_id VARCHAR(50),
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Customer Coupons (assign coupons to specific customers or tiers)
CREATE TABLE IF NOT EXISTS customer_coupons (
  id VARCHAR(50) PRIMARY KEY,
  coupon_id VARCHAR(50) NOT NULL,
  customer_id VARCHAR(50),
  tier_name VARCHAR(100),
  is_used BOOLEAN DEFAULT FALSE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP NULL,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Customer Notifications
CREATE TABLE IF NOT EXISTS customer_notifications (
  id VARCHAR(50) PRIMARY KEY,
  customer_id VARCHAR(50) NOT NULL,
  type ENUM('order', 'promo', 'loyalty', 'system') DEFAULT 'system',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(500),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Insert default settings
INSERT IGNORE INTO settings (`key`, value) VALUES
  ('store_name', '"ChineXa"'),
  ('store_email', '"hello@chinexa.com"'),
  ('store_phone', '"+880 1700-000000"'),
  ('currency', '"BDT"'),
  ('free_delivery_enabled', 'true'),
  ('free_delivery_threshold', '3000'),
  ('points_per_taka', '10'),
  ('points_enabled', 'true');

-- Insert default membership tiers
INSERT IGNORE INTO membership_tiers (id, name, min_points, max_points, points_multiplier, color, badge_name, badge_color, badge_opacity, benefits, sort_order) VALUES
  ('tier-general', 'General', 1, 500, 1.00, 'bg-blue-100 text-blue-700', 'ChineXa General', '#3B82F6', 0.70, '["Basic member benefits"]', 1),
  ('tier-elite', 'Elite', 501, 1100, 1.50, 'bg-emerald-100 text-emerald-700', 'ChineXa Elite', '#10B981', 0.80, '["5% extra discount", "Priority support"]', 2),
  ('tier-signature', 'Signature', 1101, 1800, 2.00, 'bg-amber-100 text-amber-700', 'ChineXa Signature', '#F59E0B', 0.85, '["10% extra discount", "Free shipping", "Early access to sales"]', 3),
  ('tier-prestige', 'Prestige', 1801, 2500, 2.50, 'bg-purple-100 text-purple-700', 'ChineXa Prestige', '#8B5CF6', 0.90, '["15% extra discount", "Free shipping", "VIP support"]', 4),
  ('tier-royal', 'Royal', 2501, 3500, 3.00, 'bg-rose-100 text-rose-700', 'ChineXa Royal', '#E11D48', 0.95, '["20% extra discount", "Free express shipping", "VIP support", "Exclusive products"]', 5),
  ('tier-black', 'Black', 3501, 99999, 4.00, 'bg-gray-900 text-white', 'ChineXa Black', '#1a1a1a', 1.00, '["25% extra discount", "Free express shipping", "Personal shopper", "Exclusive early access", "Birthday gifts"]', 6);
