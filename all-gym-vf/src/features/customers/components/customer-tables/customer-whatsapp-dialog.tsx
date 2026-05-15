"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { IconAlertTriangle, IconBrandWhatsapp, IconFileText } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { getMessageTemplates } from "@/features/messages/actions/message-actions";
import { buildWhatsAppContext, interpolateMessage, buildWhatsAppUrl, type CustomerWhatsApp } from "@/features/messages/whatsapp-helper";

const PLACEHOLDERS = [
  { token: "@cliente", label: "Cliente" },
  { token: "@dias", label: "Días (número)" },
  { token: "@dias_texto", label: "Días (texto)" },
  { token: "@inicio", label: "Inicio" },
  { token: "@fin", label: "Fin" },
  { token: "@ultimo_ingreso", label: "Último ingreso" },
];

interface CustomerWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerWhatsApp;
}

export function CustomerWhatsAppDialog({ open, onOpenChange, customer }: CustomerWhatsAppDialogProps) {
  const [messageText, setMessageText] = useState("");
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const ctx = buildWhatsAppContext(customer);
  const { text: interpolatedText, hasNoAttendanceData } = ctx
    ? interpolateMessage(messageText, ctx)
    : { text: messageText, hasNoAttendanceData: false };

  const templatesQuery = useQuery({
    queryKey: ["message-templates", "active"],
    queryFn: async () => {
      const result = await getMessageTemplates({ includeInactive: false });
      if (!result.success || !result.data) throw new Error(result.error || "Error");
      return result.data;
    },
    enabled: open,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessageText("");
      setActiveTemplateId(null);
    }
  }, [open]);

  const handleSelectTemplate = (templateId: string) => {
    const template = templatesQuery.data?.find((t) => t.id === templateId);
    if (template) {
      setMessageText(template.content);
      setActiveTemplateId(templateId);
    }
  };

  const insertToken = (token: string) => {
    const textarea = document.getElementById("wa-message-textarea") as HTMLTextAreaElement | null;
    if (!textarea) {
      setMessageText((prev) => prev + token);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = messageText.slice(0, start);
    const after = messageText.slice(end);

    setMessageText(before + token + after);

    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + token.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  const handleSend = () => {
    if (!ctx) {
      toast.error("No hay teléfono registrado para este cliente");
      return;
    }
    if (!messageText.trim()) {
      toast.error("El mensaje está vacío");
      return;
    }
    const url = buildWhatsAppUrl(ctx, interpolatedText);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!ctx) return null;

  const templates = templatesQuery.data ?? [];
  const isLoadingTemplates = templatesQuery.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconBrandWhatsapp className="h-5 w-5 text-emerald-500" />
            Enviar mensaje a {customer.full_name || "Cliente"}
          </DialogTitle>
          <DialogDescription>
            Selecciona una plantilla o escribe un mensaje personalizado para enviar por WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {(isLoadingTemplates || templates.length > 0) && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Mensajes guardados</label>
              {isLoadingTemplates ? (
                <div className="space-y-1 rounded-md border p-2">
                  {[1].map((i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <Select
                  value={activeTemplateId ?? ""}
                  onValueChange={(value) => {
                    if (!value) {
                      setActiveTemplateId(null);
                      return;
                    }
                    handleSelectTemplate(value);
                  }}
                >
                  <SelectTrigger className="w-full justify-between">
                    <SelectValue placeholder="Selecciona una plantilla" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2 truncate">
                          <IconFileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate font-medium">{t.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mensaje</label>
            <Textarea
              id="wa-message-textarea"
              value={messageText}
              onChange={(e) => {
                setMessageText(e.target.value);
                setActiveTemplateId(null);
              }}
              placeholder="Escribe tu mensaje..."
              className="min-h-[120px] resize-y text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PLACEHOLDERS.map((ph) => (
              <Button
                key={ph.token}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs font-mono"
                onClick={() => insertToken(ph.token)}
              >
                {ph.token}
              </Button>
            ))}
          </div>

          {hasNoAttendanceData && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
              <IconAlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <span className="text-amber-700 dark:text-amber-300">No hay registros, 0 días</span>
            </div>
          )}

          {messageText.trim() && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Vista previa</label>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap break-words">
                {interpolatedText}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSend}
              disabled={!messageText.trim()}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <IconBrandWhatsapp className="h-4 w-4" />
              Abrir WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
