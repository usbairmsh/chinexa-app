"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, Check, X, MessageSquare, Trash2, Loader2 } from "lucide-react";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, getInitials, formatDateShort } from "@/lib/utils";
import { useAdmin } from "@/contexts/admin-context";
import { ReviewImageGallery } from "@/components/storefront/reviews/review-image-gallery";

interface ReviewData {
  id: string; customer_name: string; product_name: string; rating: number;
  title: string | null; comment: string; images?: string[]; is_verified_purchase: boolean;
  is_approved: boolean; admin_reply: string | null; created_at: string;
}

export default function AdminReviewsPage() {
  const { can } = useAdmin();
  const canApproveReview = can("reviews", "approve");
  const canDeleteReview = can("reviews", "delete");
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyDialog, setReplyDialog] = useState<ReviewData | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySaving, setReplySaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<ReviewData | null>(null);

  const fetchReviews = async () => {
    try {
      const res = await fetch("/api/reviews?limit=200");
      const data = await res.json();
      setReviews(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchReviews(); }, []);

  const handleApprove = async (id: string) => {
    await fetch(`/api/reviews/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_approved: true }) }).catch(() => {});
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, is_approved: true } : r));
  };

  const handleReject = async (id: string) => {
    await fetch(`/api/reviews/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_approved: false }) }).catch(() => {});
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, is_approved: false } : r));
  };

  const handleReply = async () => {
    if (!replyDialog || !replyText.trim()) return;
    setReplySaving(true);
    await fetch(`/api/reviews/${replyDialog.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ admin_reply: replyText.trim() }) }).catch(() => {});
    setReviews((prev) => prev.map((r) => r.id === replyDialog.id ? { ...r, admin_reply: replyText.trim() } : r));
    setReplyDialog(null);
    setReplyText("");
    setReplySaving(false);
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    await fetch(`/api/reviews/${deleteDialog.id}`, { method: "DELETE" }).catch(() => {});
    setReviews((prev) => prev.filter((r) => r.id !== deleteDialog.id));
    setDeleteDialog(null);
  };

  const openReply = (review: ReviewData) => {
    setReplyDialog(review);
    setReplyText(review.admin_reply || "");
  };

  const pendingReviews = reviews.filter((r) => !r.is_approved);
  const approvedReviews = reviews.filter((r) => r.is_approved);
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length).toFixed(1) : "0";

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 text-secondary animate-spin" /></div>;
  }

  const ReviewCard = ({ review, index = 0 }: { review: ReviewData; index?: number }) => (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-9 w-9 shrink-0"><AvatarFallback className="text-xs">{getInitials(review.customer_name)}</AvatarFallback></Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-charcoal truncate">{review.customer_name}</span>
                {review.is_verified_purchase && <Badge variant="success" className="text-[9px] shrink-0">Verified</Badge>}
              </div>
              <p className="text-[10px] text-charcoal-lighter">{formatDateShort(review.created_at)}</p>
            </div>
          </div>
          <Badge variant={review.is_approved ? "success" : "warning"} className="shrink-0">{review.is_approved ? "Approved" : "Pending"}</Badge>
        </div>

        <div className="flex items-center gap-1 mb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={cn("h-3.5 w-3.5", i < review.rating ? "text-gold fill-gold" : "text-border")} />
          ))}
        </div>

        <p className="text-xs text-charcoal-lighter mb-1">Product: <span className="text-charcoal font-medium">{review.product_name || "Unknown"}</span></p>
        {review.title && <h4 className="text-sm font-medium text-charcoal mb-1">{review.title}</h4>}
        <p className="text-sm text-charcoal-light leading-relaxed mb-3">{review.comment}</p>
        {review.images && review.images.length > 0 && <div className="mb-3"><ReviewImageGallery images={review.images} /></div>}

        {review.admin_reply && (
          <div className="bg-primary-light rounded-lg p-3 mb-3">
            <p className="text-[10px] font-medium text-secondary mb-1">ChineXa Reply</p>
            <p className="text-xs text-charcoal-light">{review.admin_reply}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/30">
          {!review.is_approved && canApproveReview && (
            <AdminButton size="sm" onClick={() => handleApprove(review.id)}><Check className="h-3 w-3 mr-1" /> Approve</AdminButton>
          )}
          {review.is_approved && canApproveReview && (
            <AdminButton variant="outline" size="sm" onClick={() => handleReject(review.id)}><X className="h-3 w-3 mr-1" /> Unapprove</AdminButton>
          )}
          {canApproveReview && (
            <AdminButton variant="ghost" size="sm" onClick={() => openReply(review)}>
              <MessageSquare className="h-3 w-3 mr-1" /> {review.admin_reply ? "Edit Reply" : "Reply"}
            </AdminButton>
          )}
          {canDeleteReview && (
            <AdminButton variant="ghost" size="sm" className="text-destructive sm:ml-auto" onClick={() => setDeleteDialog(review)}>
              <Trash2 className="h-3 w-3" />
            </AdminButton>
          )}
        </div>
      </CardContent>
    </Card>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-charcoal">Reviews</h1>
        <p className="text-sm text-charcoal-lighter">Moderate and respond to customer reviews</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Reviews", value: reviews.length, color: "text-charcoal" },
          { label: "Avg. Rating", value: avgRating, color: "text-gold" },
          { label: "Pending", value: pendingReviews.length, color: "text-warning" },
          { label: "Approved", value: approvedReviews.length, color: "text-success" },
        ].map((stat) => (
          <Card key={stat.label}><CardContent className="p-4 text-center">
            <p className="text-xs text-charcoal-lighter">{stat.label}</p>
            <p className={cn("text-2xl font-bold mt-1 [font-variant-numeric:tabular-nums]", stat.color)}>{stat.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {reviews.length === 0 ? (
        <EmptyState icon={Star} title="No reviews yet" description="Customer reviews will appear here when they submit them from product pages." />
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({reviews.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({pendingReviews.length})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({approvedReviews.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="all"><div className="grid sm:grid-cols-2 gap-4">{reviews.map((r, i) => <ReviewCard key={r.id} review={r} index={i} />)}</div></TabsContent>
          <TabsContent value="pending"><div className="grid sm:grid-cols-2 gap-4">{pendingReviews.map((r, i) => <ReviewCard key={r.id} review={r} index={i} />)}</div></TabsContent>
          <TabsContent value="approved"><div className="grid sm:grid-cols-2 gap-4">{approvedReviews.map((r, i) => <ReviewCard key={r.id} review={r} index={i} />)}</div></TabsContent>
        </Tabs>
      )}

      {/* Reply Dialog */}
      <Dialog open={!!replyDialog} onOpenChange={(open) => { if (!open) { setReplyDialog(null); setReplyText(""); } }}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Reply to Review</DialogTitle>
            <DialogDescription>Your reply will be visible to all customers on the product page</DialogDescription>
          </DialogHeader>
          {replyDialog && (
            <div className="p-3 rounded-lg bg-pearl/60 mb-2">
              <div className="flex items-center gap-1 mb-1">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn("h-3 w-3", i < replyDialog.rating ? "text-gold fill-gold" : "text-border")} />)}</div>
              <p className="text-xs text-charcoal-light line-clamp-2">{replyDialog.comment}</p>
              <p className="text-[10px] text-charcoal-lighter mt-1">— {replyDialog.customer_name}</p>
            </div>
          )}
          <Textarea placeholder="Write your reply..." className="min-h-[100px]" value={replyText} onChange={(e) => setReplyText(e.target.value)} required />
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => { setReplyDialog(null); setReplyText(""); }}>Cancel</AdminButton>
            <AdminButton onClick={handleReply} disabled={replySaving || !replyText.trim()}>
              {replySaving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Post Reply
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader><DialogTitle>Delete Review</DialogTitle><DialogDescription>This action cannot be undone.</DialogDescription></DialogHeader>
          {deleteDialog && <p className="text-sm text-charcoal-light">Review by <strong>{deleteDialog.customer_name}</strong> on <strong>{deleteDialog.product_name}</strong></p>}
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" /> Delete</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
