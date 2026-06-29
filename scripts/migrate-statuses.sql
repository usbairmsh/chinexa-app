-- Migration: Update order statuses and create fraud_alerts table
-- Run this on existing chinexa database to apply new status system

USE chinexa;

-- Step 1: Update existing orders with old statuses to new ones
UPDATE orders SET status = 'received' WHERE status = 'delivered';
UPDATE orders SET status = 'not_received' WHERE status = 'cancelled';
UPDATE orders SET status = 'not_received' WHERE status = 'returned';

-- Step 2: Alter the ENUM to new values
ALTER TABLE orders MODIFY COLUMN status ENUM('pending', 'confirmed', 'processing', 'shipped', 'on_delivery', 'received', 'not_received') DEFAULT 'pending';

-- Step 3: Create fraud_alerts table
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

-- Step 4: Insert a test pending order
INSERT INTO orders (id, order_number, customer_id, customer_name, customer_phone, subtotal, shipping_cost, discount, tax, total, status, payment_method, payment_status, notes, created_at)
VALUES (
  'ord-test-001',
  'ORD-TEST01',
  NULL,
  'Fatima Rahman',
  '01712345678',
  4500.00,
  120.00,
  0,
  0,
  4620.00,
  'pending',
  'cod',
  'pending',
  'Test pending order for development',
  NOW()
);

-- Insert order items for test order
INSERT INTO order_items (id, order_id, product_id, product_name, product_image, quantity, unit_price, total_price)
SELECT
  'oi-test-001-1',
  'ord-test-001',
  p.id,
  p.name,
  (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id LIMIT 1),
  2,
  p.price,
  p.price * 2
FROM products p WHERE p.is_active = 1 LIMIT 1;

INSERT INTO order_items (id, order_id, product_id, product_name, product_image, quantity, unit_price, total_price)
SELECT
  'oi-test-001-2',
  'ord-test-001',
  p.id,
  p.name,
  (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id LIMIT 1),
  1,
  p.price,
  p.price
FROM products p WHERE p.is_active = 1 LIMIT 1 OFFSET 1;

-- Insert shipping address for test order
INSERT INTO order_addresses (id, order_id, type, name, phone, address_line_1, city, district, division)
VALUES ('oa-s-test-001', 'ord-test-001', 'shipping', 'Fatima Rahman', '01712345678', '42 Gulshan Avenue', 'Dhaka', 'Dhaka', 'Dhaka');

INSERT INTO order_addresses (id, order_id, type, name, phone, address_line_1, city, district, division)
VALUES ('oa-b-test-001', 'ord-test-001', 'billing', 'Fatima Rahman', '01712345678', '42 Gulshan Avenue', 'Dhaka', 'Dhaka', 'Dhaka');

-- Insert timeline entry
INSERT INTO order_timeline (order_id, status, note) VALUES ('ord-test-001', 'pending', 'Order placed');

SELECT 'Migration complete. Test order ORD-TEST01 created.' AS result;
