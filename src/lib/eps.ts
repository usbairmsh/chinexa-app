import crypto from "crypto";

// ── EPS (Easy Payment System) payment gateway client ──────────────────────────
// Server-only. Implements the 3-call redirect flow:
//   1) GetToken                     -> bearer JWT
//   2) InitializeEPS                -> RedirectURL (send the customer there)
//   3) CheckMerchantTransactionStatus -> verify payment server-side
//
// Auth on every call is a bearer token (from GetToken) plus an `x-hash` header:
//   x-hash = Base64( HMAC-SHA512( key = HASH_KEY, message = M ) )
// where M is the userName (GetToken) or the merchantTransactionId (Initialize /
// CheckStatus), per the EPS integration guide.
//
// All secrets come from environment variables — nothing hardcoded.
//
// EPS_BASE_URL is the API host, and it is the ONLY thing that differs between
// environments (paths, hash mechanism and payload are identical):
//   sandbox : https://sandboxpgapi.eps.com.bd
//   live    : https://pgapi.eps.com.bd
//
// Do NOT point EPS_BASE_URL at https://merchant.eps.com.bd — that is the
// merchant dashboard you log into, not the API. And https://pg.eps.com.bd is
// the customer-facing payment page EPS itself returns as RedirectURL; we never
// call it directly.
//
// There is deliberately no default: if EPS_BASE_URL is unset, isEpsConfigured()
// returns false and online payment is simply unavailable, rather than silently
// falling back to the wrong environment.

const cfg = () => ({
  baseUrl: (process.env.EPS_BASE_URL || "").replace(/\/+$/, ""),
  userName: process.env.EPS_USERNAME || "",
  password: process.env.EPS_PASSWORD || "",
  storeId: process.env.EPS_STORE_ID || "",
  merchantId: process.env.EPS_MERCHANT_ID || "",
  hashKey: process.env.EPS_HASH_KEY || "",
  // Some deployments need the hash key base64-decoded before use. Default is to
  // use it as a UTF-8 string (per the guide). Flip EPS_HASH_KEY_DECODE=1 if
  // sandbox GetToken returns 401 with the UTF-8 form.
  hashKeyDecode: process.env.EPS_HASH_KEY_DECODE === "1",
  transactionTypeId: Number(process.env.EPS_TRANSACTION_TYPE_ID) || 1,
});

export function isEpsConfigured(): boolean {
  const c = cfg();
  return !!(c.baseUrl && c.userName && c.password && c.storeId && c.merchantId && c.hashKey);
}

/** x-hash = Base64(HMAC-SHA512(hashKey, message)). */
function xHash(message: string): string {
  const c = cfg();
  const key = c.hashKeyDecode ? Buffer.from(c.hashKey, "base64") : Buffer.from(c.hashKey, "utf8");
  return crypto.createHmac("sha512", key).update(message, "utf8").digest("base64");
}

// Short-lived token cache (GetToken returns an expiry; refresh a bit early).
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  const c = cfg();
  if (tokenCache && Date.now() < tokenCache.expiresAt - 30_000) return tokenCache.token;

  const res = await fetch(`${c.baseUrl}/v1/Auth/GetToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-hash": xHash(c.userName) },
    body: JSON.stringify({ userName: c.userName, password: c.password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.token) {
    throw new Error(data?.errorMessage || `EPS GetToken failed (${res.status})`);
  }
  // expireDate is an ISO string; fall back to 25 min if unparseable.
  const expMs = data.expireDate ? Date.parse(data.expireDate) : NaN;
  tokenCache = { token: data.token, expiresAt: Number.isFinite(expMs) ? expMs : Date.now() + 25 * 60_000 };
  return data.token;
}

export interface EpsProduct {
  ProductName: string;
  NoOfItem: string;
  ProductProfile: string;
  ProductCategory: string;
  ProductPrice: string;
}

export interface EpsInitInput {
  merchantTransactionId: string;   // unique per attempt
  customerOrderId: string;         // our order number
  totalAmount: number;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipAddress?: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  customerCity: string;
  customerState: string;
  customerPostcode: string;
  customerCountry: string;         // e.g. "BD"
  customerPhone: string;
  products: EpsProduct[];
}

/** Initialize a payment; returns the RedirectURL the customer must be sent to. */
export async function initializeEps(input: EpsInitInput): Promise<{ redirectUrl: string; transactionId: string }> {
  const c = cfg();
  const token = await getToken();

  const payload = {
    merchantId: c.merchantId,
    storeId: c.storeId,
    CustomerOrderId: input.customerOrderId,
    merchantTransactionId: input.merchantTransactionId,
    transactionTypeId: c.transactionTypeId,
    financialEntityId: 0,
    transitionStatusId: 0,
    totalAmount: input.totalAmount,
    ipAddress: input.ipAddress || "0.0.0.0",
    version: "1",
    successUrl: input.successUrl,
    failUrl: input.failUrl,
    cancelUrl: input.cancelUrl,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerAddress: input.customerAddress,
    customerCity: input.customerCity,
    customerState: input.customerState,
    customerPostcode: input.customerPostcode,
    customerCountry: input.customerCountry,
    customerPhone: input.customerPhone,
    ProductList: input.products,
  };

  const res = await fetch(`${c.baseUrl}/v1/EPSEngine/InitializeEPS`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-hash": xHash(input.merchantTransactionId),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.RedirectURL) {
    throw new Error(data?.ErrorMessage || `EPS Initialize failed (${res.status})`);
  }
  return { redirectUrl: data.RedirectURL as string, transactionId: (data.TransactionId as string) || "" };
}

export interface EpsStatus {
  merchantTransactionId: string;
  status: string;        // "Success" | "Failed" | ... (verbatim from EPS)
  totalAmount: number;
  transactionType: string;
  financialEntity: string;
  errorMessage: string;
  raw: Record<string, unknown>;
}

/** Verify a transaction server-side. NEVER trust the browser redirect alone. */
export async function checkEpsStatus(merchantTransactionId: string): Promise<EpsStatus> {
  const c = cfg();
  const token = await getToken();
  const url = `${c.baseUrl}/v1/EPSEngine/CheckMerchantTransactionStatus?merchantTransactionId=${encodeURIComponent(merchantTransactionId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, "x-hash": xHash(merchantTransactionId) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.ErrorMessage || `EPS status check failed (${res.status})`);
  return {
    merchantTransactionId: String(data.MerchantTransactionId || merchantTransactionId),
    status: String(data.Status || ""),
    totalAmount: Number(data.TotalAmount) || 0,
    transactionType: String(data.TransactionType || ""),
    financialEntity: String(data.FinancialEntity || ""),
    errorMessage: String(data.ErrorMessage || ""),
    raw: data,
  };
}

/** True when EPS reports the transaction as paid. */
export function epsIsPaid(status: EpsStatus): boolean {
  return status.status.trim().toLowerCase() === "success";
}
