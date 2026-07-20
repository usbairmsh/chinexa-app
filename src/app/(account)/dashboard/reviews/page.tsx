"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Star, Loader2, Package, MessageSquareText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ReviewImageUpload } from "@/components/storefront/reviews/review-image-upload";
import { ReviewImageGallery } from "@/components/storefront/reviews/review-image-gallery";
import { useAuthStore } from "@/stores/auth.store";
import { cn, formatDateShort } from "@/lib/utils";

interface PendingReviewItem {
  product_id: string; product_name: string; product_image: string | null;
  product_slug: string | null; order_id: string; order_number: string; ordered_at: string;
}

interface MyReview {
  id: string; product_id: string; product_name: string; rating: number;
  title: string | null; comment: string; images: string[];
  is_verified_purchase: boolean; is_approved: boolean; admin_reply: string | null; created_at: string;
}

export default function MyReviewsPage() {
  const storeUser = useAuthStore((s) => s.user);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const user = mounted ? storeUser : null;

  const [pending, setPending] = useState<PendingReviewItem[]>([]);
  const [myReviews, setMyReviews] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);

  const [writeDialog, setWriteDialog] = useState<PendingReviewItem | null>(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const fetchAll = async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const [pendingRes, reviewsRes] = await Promise.all([
        fetch(`/api/customers/${user.id}/pending-reviews`),
        fetch(`/api/reviews?customer_id=${user.id}&limit=100`),
      ]);
      const pendingData = await pendingRes.json();
      const reviewsData = await reviewsRes.json();
      setPending(Array.isArray(pendingData?.items) ? pendingData.items : []);
      setMyReviews(Array.isArray(reviewsData) ? reviewsData : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { if (mounted) fetchAll(); }, [mounted, user?.id]);

  const openWrite = (item: PendingReviewItem) => {
    setWriteDialog(item);
    setRating(5); setTitle(""); setComment(""); setImages([]); setSubmitError("");
  };

  const handleSubmit = async () => {
    if (!writeDialog || !user?.id || !comment.trim()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: writeDialog.product_id,
          product_name: writeDialog.product_name,
          customer_id: user.id,
          customer_name: user.name || "Customer",
          rating, title: title.trim() || null, comment: comment.trim(),
          images, is_approved: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error || "Failed to submit review"); return; }
      setWriteDialog(null);
      fetchAll();
    } catch { setSubmitError("Failed to submit review"); } finally { setSubmitting(false); }
  };

  if (!mounted || loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 text-secondary animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold text-charcoal">My Reviews</h2>
        <p className="text-sm text-charcoal-lighter mt-1">
          Review products you've received, and see what you've said before.
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            Pending Review
            {pending.length > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-secondary text-white">{pending.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="mine">My Reviews ({myReviews.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pending.length === 0 ? (
            <EmptyState icon={MessageSquareText} title="Nothing to review" description="Once an order is delivered, you'll be able to review each product here." />
          ) : (
            <div className="space-y-3">
              {pending.map((item) => (
                <motion.div key={item.product_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="relative h-14 w-14 rounded-xl bg-pearl overflow-hidden shrink-0">
                        {item.product_image ? (
                          <Image src={item.product_image} alt={item.product_name} fill className="object-cover" sizes="56px" unoptimized={item.product_image.includes("/uploads/")} />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center"><Package className="h-5 w-5 text-charcoal-lighter" /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-charcoal truncate">{item.product_name}</p>
                        <p className="text-[10px] text-charcoal-lighter">Order {item.order_number} &middot; Delivered {formatDateShort(item.ordered_at)}</p>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => openWrite(item)} className="shrink-0">
                        <Star className="h-3.5 w-3.5 mr-1" /> Write Review
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mine" className="mt-4">
          {myReviews.length === 0 ? (
            <EmptyState icon={Star} title="No reviews yet" description="Reviews you write will show up here." />
          ) : (
            <div className="space-y-3">
              {myReviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium text-charcoal">{review.product_name}</p>
                          {review.is_verified_purchase && <Badge variant="success" className="text-[9px]">Verified Purchase</Badge>}
                          <Badge variant={review.is_approved ? "success" : "warning"} className="text-[9px]">{review.is_approved ? "Published" : "Pending Approval"}</Badge>
                        </div>
                        <div className="flex items-center gap-0.5 mt-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn("h-3.5 w-3.5", i < review.rating ? "text-gold fill-gold" : "text-border")} />
                          ))}
                        </div>
                      </div>
                      <span className="text-[10px] text-charcoal-lighter shrink-0">{formatDateShort(review.created_at)}</span>
                    </div>
                    {review.title && <h4 className="text-sm font-medium text-charcoal mb-1">{review.title}</h4>}
                    <p className="text-sm text-charcoal-light">{review.comment}</p>
                    {review.images && review.images.length > 0 && <ReviewImageGallery images={review.images} />}
                    {review.admin_reply && (
                      <div className="mt-3 p-3 rounded-lg bg-primary-light">
                        <p className="text-[10px] font-medium text-secondary mb-0.5">ChineXa Reply</p>
                        <p className="text-xs text-charcoal-light">{review.admin_reply}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Write Review Dialog */}
      <Dialog open={!!writeDialog} onOpenChange={(open) => !open && setWriteDialog(null)}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Write a Review</DialogTitle>
            <DialogDescription>{writeDialog?.product_name}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            <div>
              <label className="text-xs font-medium text-charcoal-light mb-1.5 block">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} type="button" onClick={() => setRating(s)} className="p-1.5">
                    <Star className={cn("h-6 w-6 transition-colors", s <= rating ? "text-gold fill-gold" : "text-border hover:text-gold/50")} />
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              placeholder="Review title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              className="w-full h-10 rounded-xl border border-border bg-white px-3 text-sm text-charcoal placeholder:text-charcoal-lighter/50 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
            />

            <Textarea
              label="Your Review"
              required
              placeholder="Share your experience with this product..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={5000}
              className="min-h-[90px]"
            />

            <div>
              <label className="text-xs font-medium text-charcoal-light mb-1.5 block">Add Photos (optional)</label>
              <ReviewImageUpload value={images} onChange={setImages} />
            </div>

            {submitError && <p className="text-xs text-destructive">{submitError}</p>}
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t border-border/20">
            <Button variant="outline" size="sm" onClick={() => setWriteDialog(null)}>Cancel</Button>
            <Button variant="secondary" size="sm" onClick={handleSubmit} disabled={submitting || !comment.trim()}>
              {submitting && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
