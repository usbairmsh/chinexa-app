"use client";

import { motion } from "framer-motion";
import { Bell, Package, Tag, Star, Truck, Gift, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const notifications = [
  { id: "n1", type: "order", icon: Truck, title: "Your order is on the way!", message: "Order #ORD-0527 has been shipped and will arrive in 1-2 business days.", time: "2 hours ago", read: false },
  { id: "n2", type: "promo", icon: Tag, title: "Flash Sale: 30% off Bags!", message: "Don't miss out — 30% off all bags this weekend only. Use code BAGS30.", time: "5 hours ago", read: false },
  { id: "n3", type: "order", icon: CheckCircle2, title: "Payment confirmed", message: "Your payment for order #ORD-0527 via bKash has been confirmed.", time: "8 hours ago", read: true },
  { id: "n4", type: "loyalty", icon: Gift, title: "You earned 250 points!", message: "Your recent purchase earned you 250 loyalty points. Total: 2,450 points.", time: "1 day ago", read: true },
  { id: "n5", type: "review", icon: Star, title: "How was your purchase?", message: "Your order #ORD-0519 has been delivered. Would you like to leave a review?", time: "3 days ago", read: true },
  { id: "n6", type: "promo", icon: Tag, title: "New Korean Beauty Drop!", message: "Authentic K-Beauty essentials just arrived — shop now before they sell out.", time: "5 days ago", read: true },
  { id: "n7", type: "order", icon: Package, title: "Order placed successfully", message: "Order #ORD-0519 has been placed. We'll notify you when it ships.", time: "1 week ago", read: true },
  { id: "n8", type: "loyalty", icon: Gift, title: "Welcome to Gold tier!", message: "Congratulations! You've been upgraded to Gold member status. Enjoy exclusive benefits.", time: "2 weeks ago", read: true },
];

const typeColors: Record<string, string> = {
  order: "bg-secondary/10 text-secondary",
  promo: "bg-coral-light text-coral",
  loyalty: "bg-gold/10 text-gold",
  review: "bg-blue-50 text-blue-500",
};

export default function NotificationsPage() {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-xl font-semibold text-charcoal">Notifications</h2>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">{unreadCount} new</Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-charcoal-lighter">
          Mark all read
        </Button>
      </div>

      <div className="space-y-2">
        {notifications.map((notif, i) => {
          const Icon = notif.icon;
          return (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className={cn(!notif.read && "bg-primary-50/50 border-secondary/10")}>
                <CardContent className="p-4 flex gap-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0", typeColors[notif.type] || "bg-pearl text-charcoal")}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm", notif.read ? "text-charcoal" : "font-semibold text-charcoal")}>
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className="h-2 w-2 rounded-full bg-secondary shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-charcoal-lighter mt-0.5 line-clamp-2">{notif.message}</p>
                    <p className="text-[10px] text-charcoal-lighter mt-1.5">{notif.time}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
