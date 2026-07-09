"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface AvatarViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  name: string;
}

/** Full-size lightbox for a profile picture — used wherever an avatar can be viewed larger (customer profile, admin customer detail). */
export function AvatarViewDialog({ open, onOpenChange, imageUrl, name }: AvatarViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-2 sm:p-2 bg-transparent border-0 shadow-none">
        <DialogTitle className="sr-only">{name}&apos;s profile picture</DialogTitle>
        <div className="rounded-2xl overflow-hidden bg-charcoal">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={name} className="w-full h-auto max-h-[75vh] object-contain" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
