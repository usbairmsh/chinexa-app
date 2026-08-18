# Requirements: Manual Invoice Generator (Admin)

> **Date:** 2026-08-08
> **Type:** feature
> **Source:** verbal brief + requirements interview
> **Phase:** 1 of 5 (Requirement Engineering)

## Summary

Admins need to raise an invoice directly, without a customer having placed an order on the
storefront. Today the only invoice in the system is order-bound: it renders whatever is already
stored against an existing order, so there is no way to bill for a walk-in sale, a social-media
sale, a service charge, or a quotation.

This feature adds a standalone invoice builder in the admin panel — pick products and variants,
adjust quantity and price, apply discounts per line and overall, add a delivery charge, stamp it
with a saved seal and signature, print it in the existing invoice format, and keep a permanent
record of every invoice raised. Two independent toggles decide whether a given invoice affects
stock and accounting, and whether it claims a real order number for reference.

## Problem & Motivation

**Trigger.** A large share of trade happens off the storefront — over Facebook, Instagram,
WhatsApp, by phone, and in person. Those customers still expect a document, and the business still
needs a record. At present the only way to produce one is to create a full order through Record
Sale, which forces every such transaction into the order list, order counts, customer statistics
and revenue — whether or not it belongs there.

**Who benefits.**
- *Admin/sales staff* get a fast way to bill a customer without fabricating an order.
- *The business* gets an auditable register of every invoice raised, and control over which ones
  count financially.
- *Customers* get a consistent, professional document identical in appearance to the automatic
  order invoice.

**If we don't do it.** Staff continue to either raise fake orders (polluting revenue, stock and
customer data) or produce documents outside the system entirely (no record, no traceability, no
stock or accounting linkage). Both are already happening and both are costly to unwind.

## Users & Consumers

- **Admin / sales staff** — raise, edit, publish, print and mark invoices as paid; decide per
  invoice whether it is financially real.
- **Accounts/owner** — needs certainty that only genuinely accountable invoices reach revenue,
  COGS and stock, and needs a complete register for audit.
- **Customer (recipient)** — receives a printed or PDF document; never interacts with this feature
  directly.
- **Existing accounting module** — consumes only those invoices explicitly marked accountable.
- **Existing stock module** — consumes only those invoices explicitly marked stock-affecting.

## Functional Requirements

| ID | Requirement | Acceptance Criterion |
|----|-------------|----------------------|
| R1 | Admin can create a manual invoice from a dedicated admin page. | A new invoice can be created and saved as a draft without touching any existing order. |
| R2 | Admin can add multiple products to one invoice, selecting a specific variant where the product has variants. | An invoice containing at least three products, one of them a specific variant, saves and renders all three correctly. |
| R3 | Each added line defaults to quantity 1 and to the product's (or variant's) current system price. | Adding a product with system price ৳1,200 produces a line showing quantity 1 and unit price ৳1,200 with no manual entry. |
| R4 | Both quantity and unit price on every line are editable and override the system values for this invoice only. | Editing a line's price to ৳900 changes that invoice's totals; the product's catalogue price is unchanged afterwards. |
| R5 | Each line supports its own discount, entered as either a percentage or a fixed amount. | A 10% line discount and a ৳50 line discount each reduce their own line total correctly and independently. |
| R6 | The invoice supports an order-level discount, entered as either a percentage or a fixed amount. | Applying a 5% order discount reduces the total after line discounts, and is shown as its own row. |
| R7 | A delivery charge can be entered manually per invoice. | Entering a ৳120 delivery charge adds ৳120 to the total and appears as its own row. |
| R8 | The invoice shows a live summary: subtotal, total line discounts, order discount, delivery charge and grand total. | Changing any quantity, price or discount updates every summary figure immediately without saving. |
| R9 | Customer details can be either selected from existing customers or typed in manually. | An invoice can be raised against an existing customer record, and separately against a typed-in walk-in name and phone. |
| R10 | A seal image and a signature image can be uploaded on the invoice generation page and are reused as the default on subsequent invoices. | After uploading once, the next new invoice shows the same seal and signature pre-applied with no re-upload. |
| R11 | The saved seal and signature can be replaced or removed; both are optional. | An invoice can be generated with seal only, signature only, both, or neither. |
| R12 | Generated invoices are rendered in the same visual format as the existing automatic order invoice. | A manual invoice and an order invoice placed side by side are visually consistent in layout, branding and typography. |
| R13 | Every invoice is assigned a unique voucher number on creation. | Two invoices created in the same second receive different voucher numbers. |
| R14 | Admin can optionally allocate a real order number to an invoice, drawn from the same sequence used by Order Management. | With the toggle on, the invoice displays an order number in the live `ORD-<yy>-<nnnnnn>` sequence; with it off, no order number appears anywhere on the invoice. |
| R15 | An invoice that has been allocated an order number must not appear in the Order Management list. | After generating an invoice with an order number, the order list contains no new row. |
| R16 | Admin can toggle, per invoice, whether it participates in stock and accounting. | With the toggle off, marking the invoice paid changes no stock level and no accounting figure. |
| R17 | Stock deduction and revenue recognition occur only when an invoice is marked as paid, and only when the toggle is on. | Publishing an accountable invoice changes nothing; marking it paid deducts stock and increases revenue exactly once. |
| R18 | Invoices follow a lifecycle of Draft → Published → Paid. | The status is visible on the list and detail views and only advances in that order. |
| R19 | An invoice is fully editable while in Draft and becomes read-only once Published. | Editing controls are available on a draft and absent on a published invoice. |
| R20 | Admin can mark a published invoice as paid and record the payment method (e.g. cash, bKash, bank transfer). | Marking paid records the method and timestamp, both visible on the detail view. |
| R21 | All generated invoices are recorded in a list with search and filtering. | The list shows voucher number, date, customer, total, status and whether the invoice is accountable, and can be filtered by status. |
| R22 | A print action is available when creating an invoice, on its detail view, and from the three-dot menu in the list. | Print can be triggered from all three locations and produces the same document. |
| R23 | A draft invoice can be deleted. | Deleting a draft removes it from the list; no stock or accounting effect occurs. |
| R24 | A published invoice can be voided rather than deleted, and remains in the register. | A voided invoice is shown with a Void status and is excluded from financial figures. |
| R25 | A paid invoice cannot be edited, voided or deleted. | All destructive and edit actions are unavailable on a paid invoice. |

## Non-Functional Requirements

| ID | Requirement | Acceptance Criterion |
|----|-------------|----------------------|
| N1 | Stock deduction and revenue recognition are idempotent. | Triggering "mark as paid" twice (double-click, retry, concurrent request) deducts stock and counts revenue exactly once. |
| N2 | Voucher and order number allocation are safe under concurrency. | Two invoices generated simultaneously never receive the same voucher number or the same order number. |
| N3 | Manual invoices are excluded from all storefront-facing data. | No manual invoice or its customer appears in storefront order tracking, customer order history, or public data. |
| N4 | Access is restricted to authorised admin users and enforced server-side. | An admin lacking the relevant permission receives an authorisation failure from the API, not merely a hidden button. |
| N5 | Every state change is attributable. | The register records which admin created, published, paid or voided each invoice, and when. |
| N6 | The generation page remains usable on a tablet-sized screen. | All controls, including the line editor, are operable at 768px width. |
| N7 | Printed output is correct on A4. | A printed invoice fits A4 without clipping, and the seal and signature render at a legible size. |

## Behaviors & Domain Rules

### Lifecycle

An invoice moves through exactly three states, plus one terminal exception:

- **Draft** — fully editable. Nothing has happened financially. Can be deleted outright.
- **Published** — locked for editing. The document is considered issued to the customer. Can be
  voided. Still no financial effect.
- **Paid** — the financial trigger. If the invoice is marked accountable, stock is deducted and
  revenue is recognised at this moment. Permanent: cannot be edited, voided or deleted.
- **Void** — a published invoice withdrawn before payment. Remains in the register for audit and is
  excluded from all financial figures.

### The two independent toggles

These are deliberately separate and control different things:

1. **Include in stock & accounting.** When on, marking the invoice paid deducts stock for every
   line and recognises the invoice value as revenue. When off, the invoice is a document only —
   a quotation, proforma, or a record of a transaction accounted for elsewhere. Neither stock nor
   any accounting figure moves, ever.
2. **Generate order number.** When on, the invoice is allocated the next number from the live order
   sequence and prints it as a reference. This does **not** create an order: no row appears in Order
   Management, and the number exists purely as a printed reference tying the invoice to the
   business's order numbering.

The toggles are independent — any of the four combinations is valid and meaningful.

### Pricing and discounts

- Every line carries its own quantity, unit price, and optional discount (percentage or fixed).
- The line total is `(quantity x unit price) - line discount`.
- The subtotal is the sum of line totals.
- An order-level discount (percentage or fixed) applies after the subtotal.
- The delivery charge is added last.
- The grand total is `subtotal - order discount + delivery charge`.
- The summary shows total line discounts as a single aggregated figure alongside the order discount,
  so the customer can see the full saving.

**Why these rules matter:**

- **Financial effect is deferred to payment, not creation.** An invoice that has been issued but
  not paid is not a sale. Deducting stock or recognising revenue at creation would inflate both
  and make every abandoned quotation look like trade.
- **Manual invoices never enter the orders table.** Payment links taught this lesson already: when
  a non-sale artefact is stored as an order, it silently contaminates revenue, order counts and
  customer statistics, and the contamination is discovered late. Keeping invoices in their own
  register makes the accountability toggle meaningful and enforceable.
- **The order number is a reference, not an order.** The business wants continuity in its numbering,
  not a fulfilment record. Allocating from the shared sequence guarantees the number is genuinely
  unique across the business; not creating an order keeps the order list clean.
- **Prices are snapshotted onto the invoice.** Editing a line price must never write back to the
  catalogue, and a later catalogue price change must never alter an already-issued invoice.
- **Paid is permanent.** Once stock has moved and revenue has been recognised, silently reversing
  it would break the audit trail. Corrections are made by an offsetting entry, the same discipline
  already applied to partner and loan records.

**Common mistakes:**

- Creating an order row for every invoice "because the invoice page needs one" — this defeats the
  entire accountability toggle. The invoice register must be able to render an invoice with no
  order behind it.
- Applying stock and revenue at publish rather than at paid.
- Allowing "mark as paid" to run twice and deducting stock twice — the effect must be guarded by a
  persisted flag, not by the status alone.
- Treating the order-number toggle as "create an order" — it allocates a number only.
- Writing an edited line price back to the product record.
- Deriving the grand total in the browser and trusting it on save — totals must be recomputed
  server-side from the stored lines.
- Allowing a voucher number to be reused after a draft is deleted — numbers are consumed on
  allocation and gaps are acceptable.

## Edge Cases & Failure Modes

| Scenario | Decision | Rationale |
|----------|----------|-----------|
| Insufficient stock when marking an accountable invoice as paid | Show a warning offering two explicit choices: proceed and allow stock to go negative, or proceed without updating stock for this invoice | The goods have already physically left the shelf in an offline sale; blocking the record would be wrong, and silently corrupting stock worse. The invoice is already locked at this point, so the choice must be available at mark-paid rather than requiring an edit. |
| "Mark as paid" triggered twice (double-click, retry, two admins) | Stock deducted and revenue recognised exactly once, guarded by a persisted flag | Matches the existing `stock_deducted` / `revenue_counted` discipline used by orders |
| Two invoices generated at the same instant | Both receive distinct voucher numbers, and distinct order numbers if requested | Allocation uses the existing row-locked counter rather than max+1 |
| Order numbers consumed by invoices create gaps in the order list | Accepted | Guaranteeing global uniqueness is worth visible gaps; the alternative (a separate sequence) would not be "the next order number" the business asked for |
| A product is deleted or renamed after an invoice is issued | The invoice continues to show what was sold at the time | Line details are snapshotted onto the invoice, never joined live from the catalogue |
| A product's catalogue price changes after an invoice is issued | The invoice total is unchanged | As above |
| A line is added with quantity 0 or a negative quantity | Rejected with a validation message | A zero or negative line is meaningless on an invoice |
| A discount larger than the line or invoice value | Clamped so no line total and no grand total can be negative | A negative invoice is not a valid document; the existing refund clamp sets the precedent |
| An invoice with no lines | Cannot be published | An empty invoice is not a document |
| Marking a non-accountable invoice as paid | Records the payment for the register only; no stock or accounting movement | This is the entire purpose of the toggle |
| A draft is abandoned and never published | Remains a draft indefinitely and can be deleted | Drafts have no financial or numbering consequence beyond their own voucher number |
| Seal or signature image missing or removed | The invoice renders correctly without them | Both are explicitly optional |
| A very large invoice (many lines) is printed | Renders across multiple A4 pages with totals intact | Long invoices must not clip or lose the summary |
| Deleting a customer who is linked to an invoice | The invoice retains the customer details as recorded at issue | The document must remain complete and auditable |

## Decisions Log

| # | Decision | Alternatives Considered | Chosen Because |
|---|----------|------------------------|----------------|
| 1 | Manual invoices are stored in their own register, entirely separate from orders | Create an order row for every invoice and flag it | Storing non-sales as orders contaminates revenue, order counts and customer stats — the exact problem already corrected for standalone payment links. Separation is what makes the accountability toggle enforceable. |
| 2 | Every invoice receives its own voucher number | Reuse the order number as the only identifier | An invoice must be identifiable even when no order number is requested |
| 3 | The optional order number is drawn from the live order sequence and printed as a reference only | A separate invoice-only sequence with no gaps | The business explicitly asked for "the next order number from order management"; visible gaps are the accepted cost of genuine uniqueness |
| 4 | Lifecycle is Draft → Published → Paid | Immutable on creation; or editable indefinitely | Allows correction before issue, then locks the issued document, then separates the financial event from issuance |
| 5 | Stock and accounting apply on Paid, never on create or publish | Apply at creation | An unpaid invoice is not a sale; applying earlier would inflate stock movement and revenue |
| 6 | When the accountability toggle is off, neither stock nor accounting is affected | Deduct stock but exclude from accounting | Confirmed with the business — a non-accountable invoice is a document only |
| 7 | Payment is recorded manually, with a method | Attach an online payment link | Standalone payment links already cover online collection; this feature targets offline invoicing |
| 8 | Insufficient stock at mark-paid shows a warning with two explicit choices | Hard block; or silently allow negative stock | The sale has physically occurred; the admin must make an informed choice, and the invoice cannot be unlocked at that point |
| 9 | Draft is deletable, Published is voidable, Paid is permanent | Allow voiding at any stage | Preserves the audit trail once money and stock have moved; corrections are made by offsetting entry |
| 10 | Discounts are available per line (percentage or amount) and at order level | Order-level only | Requested by the business; the summary aggregates line discounts so the total saving is visible |
| 11 | Customer may be picked from existing records or typed manually | Require an existing customer | Walk-in and one-off sales have no customer record and must not be forced to create one |
| 12 | Seal and signature are configured on the generation page and reused as defaults | Store only in global Settings | Requested by the business; keeps setup in the same place as use while still being uploaded only once |
| 13 | Print is available from create, detail and the list's three-dot menu | Detail view only | Requested by the business; matches how staff actually work |
| 14 | Line prices and product details are snapshotted onto the invoice | Join live from the catalogue at render time | An issued document must never change retroactively because the catalogue changed |

## Scope Boundaries

### In Scope

- A dedicated admin page for creating manual invoices.
- Product and variant selection with editable quantity and unit price.
- Per-line discounts (percentage or amount) and an order-level discount.
- Manually entered delivery charge.
- Live subtotal, aggregated line discounts, order discount, delivery and grand total.
- Customer selection from existing records, or manual entry.
- Seal and signature upload, reuse, replacement and removal — all optional.
- Invoice rendering consistent with the existing automatic invoice.
- A register of all generated invoices, with search, filtering and status.
- Print from creation, detail and list.
- Draft → Published → Paid lifecycle, plus Void for published invoices.
- Per-invoice toggle for stock and accounting participation.
- Per-invoice toggle for allocating a real order number as a printed reference.
- Manual payment recording with method and timestamp.
- Permission-gated access and attribution of every state change.

### Out of Scope

- Online payment of a manual invoice (reason: standalone payment links already provide this; can be
  linked in a later phase).
- Emailing or SMSing the invoice to the customer (reason: not requested; the immediate need is a
  printed document).
- Recurring or scheduled invoices (reason: not requested).
- Multi-currency invoicing (reason: the business operates in BDT only).
- Tax/VAT lines on the invoice (reason: not requested; flagged as an open question below).
- Credit notes and partial refunds against a manual invoice (reason: paid is terminal by decision;
  corrections are made by offsetting entry).
- Converting a manual invoice into a real fulfilable order (reason: explicitly not wanted — the
  order number is a reference only).
- Customer-facing visibility of manual invoices in storefront order history or tracking.
- Bulk invoice generation or import.

## Open Questions

- **Should the invoice show a tax/VAT line?**
  - *Impact if unresolved:* if VAT registration applies, issued invoices may be non-compliant and
    would need reissuing.
  - *Suggested default:* no tax line, matching the existing order invoice, which also omits it.
    Revisit if the business becomes VAT-registered.

- **Should a paid manual invoice appear in the customer's own order history when it was raised
  against an existing customer record?**
  - *Impact if unresolved:* a customer may see a document they do not recognise, or may fail to see
    a purchase they expect.
  - *Suggested default:* no — manual invoices stay entirely within admin, consistent with N3.

- **How long should draft invoices be retained before automatic cleanup?**
  - *Impact if unresolved:* abandoned drafts accumulate in the register indefinitely.
  - *Suggested default:* retain indefinitely; revisit only if volume becomes a problem.

- **Should the register be exportable to spreadsheet?**
  - *Impact if unresolved:* the accountant may need to re-key data manually.
  - *Suggested default:* out of scope for this sprint; add alongside the existing accounting exports
    if needed.

---
_This requirements document is the input for the **plan-architecture** skill._
_Next step: `/plan-architecture from: specs/requirements/REQ-manual-invoice-generator.md`_
