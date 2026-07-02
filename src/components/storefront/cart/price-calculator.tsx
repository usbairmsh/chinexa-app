"use client";

import { Tag, Percent, Truck, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/stores/cart.store";
import { formatCurrency } from "@/lib/utils";

interface PriceCalculatorProps {
  shippingCost?: number;
  isFreeShipping?: boolean;
  freeDeliveryThreshold?: number;
  showShipping?: boolean;
}

export function PriceCalculator({
  shippingCost,
  isFreeShipping = false,
  freeDeliveryThreshold,
  showShipping = true,
}: PriceCalculatorProps) {
  const { getSubtotal, getSavings, getItemSavings, getDiscount, appliedOffers, couponCode, couponType, couponValue } = useCartStore();
  const [showOfferDetails, setShowOfferDetails] = useState(false);

  const subtotal = getSubtotal();
  const savings = getSavings();
  const itemSavings = getItemSavings();
  const discount = getDiscount();
  const shipping = showShipping ? (shippingCost ?? 0) : 0;

  const total = Math.max(0, subtotal - savings - discount + shipping);

  const couponLabel = couponType === "percentage" ? `${couponValue}% off` : couponCode || "";
  // Distinct offer titles currently applied, for naming which offer was used.
  const offerTitles = [...new Set(appliedOffers.map((o) => o.title))];

  return (
    <div className="space-y-2.5 text-sm">
      {/* Subtotal */}
      <div className="flex justify-between">
        <span className="text-charcoal-lighter">Subtotal</span>
        <span className="font-medium text-charcoal">{formatCurrency(subtotal)}</span>
      </div>

      {/* Offer Discount (from admin offers) */}
      {savings > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowOfferDetails(!showOfferDetails)}
            className="flex w-full items-center justify-between text-success"
          >
            <span className="flex items-center gap-1.5 text-left">
              <Percent className="h-3.5 w-3.5 shrink-0" />
              {offerTitles.length === 1 ? offerTitles[0] : "Offer Discount"}
              {itemSavings.length > 0 && (
                <span className="text-[10px] text-success/70">({itemSavings.length} {itemSavings.length === 1 ? "item" : "items"})</span>
              )}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              −{formatCurrency(savings)}
              <ChevronDown className={`h-3 w-3 transition-transform ${showOfferDetails ? "rotate-180" : ""}`} />
            </span>
          </button>
          {showOfferDetails && itemSavings.length > 0 && (
            <div className="mt-1.5 ml-5 space-y-1 border-l-2 border-success/20 pl-2.5">
              {itemSavings.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-2 text-xs">
                  <span className="text-charcoal-lighter truncate flex-1">{item.name}</span>
                  <span className="text-success shrink-0">−{formatCurrency(item.saved)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Coupon Discount */}
      {discount > 0 && couponCode && (
        <div className="flex justify-between text-success">
          <span className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            Coupon
            <code className="text-[9px] bg-success/10 px-1 py-0.5 rounded font-bold">{couponCode}</code>
            <span className="text-[10px] text-success/70">({couponLabel})</span>
          </span>
          <span>−{formatCurrency(discount)}</span>
        </div>
      )}

      {/* Shipping */}
      {showShipping && (
        <div className="flex justify-between">
          <span className="text-charcoal-lighter flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" />
            Shipping
          </span>
          <span className="font-medium text-charcoal">
            {shippingCost == null ? (
              <span className="text-[10px] text-charcoal-lighter">Select address</span>
            ) : isFreeShipping ? (
              <span className="text-success">Free</span>
            ) : shippingCost === 0 ? (
              <span className="text-[10px] text-charcoal-lighter">Calculated at checkout</span>
            ) : (
              formatCurrency(shippingCost)
            )}
          </span>
        </div>
      )}

      {isFreeShipping && freeDeliveryThreshold && (
        <p className="text-[10px] text-success ml-5">Free delivery on orders above {formatCurrency(freeDeliveryThreshold)}</p>
      )}

      <Separator className="!my-3" />

      {/* Total */}
      <div className="flex justify-between text-base font-semibold text-charcoal">
        <span>Total</span>
        <span>{formatCurrency(total)}</span>
      </div>

      {/* Total Savings Summary */}
      {(savings > 0 || discount > 0) && (
        <p className="text-xs text-success text-right">
          You save {formatCurrency(savings + discount)} on this order
        </p>
      )}
    </div>
  );
}
