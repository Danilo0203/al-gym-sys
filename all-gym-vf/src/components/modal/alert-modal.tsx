"use client";
import { useEffect, useState } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  title?: string;
  description?: React.ReactNode | string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "default" | "destructive" | "secondary" | "outline";
  contentClassName?: string;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  loading,
  title = "¿Estás seguro?",
  description = "Esta acción no se puede deshacer.",
  confirmText = "Continuar",
  cancelText = "Cancelar",
  confirmVariant = "destructive",
  contentClassName,
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsMounted(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "overflow-hidden border-border/70 bg-background/95 p-0 shadow-2xl sm:max-w-lg",
          contentClassName,
        )}
      >
        <DialogHeader className="border-b border-border/60 px-6 py-5 sm:px-7">
          <DialogTitle className="pr-8 text-2xl leading-tight tracking-tight">{title}</DialogTitle>
          {typeof description === "string" ? (
            <DialogDescription className="max-w-2xl pt-1 text-base leading-7">{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        {typeof description !== "string" ? (
          <DialogDescription className="px-6 py-5 sm:px-7">{description}</DialogDescription>
        ) : null}

        <DialogFooter className="border-t border-border/60 bg-muted/10 px-6 py-4 sm:px-7">
          <Button disabled={loading} variant="outline" onClick={onClose} className="min-w-28">
            {cancelText}
          </Button>
          <Button disabled={loading} variant={confirmVariant} onClick={onConfirm} className="min-w-32">
            {loading ? <IconLoader2 className="size-4 animate-spin" /> : null}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
