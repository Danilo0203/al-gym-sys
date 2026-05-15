"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createMessageTemplate,
  updateMessageTemplate,
  type MessageTemplate,
} from "../actions/message-actions";

const PLACEHOLDERS = [
  { token: "@cliente", label: "Cliente" },
  { token: "@dias", label: "Días (número)" },
  { token: "@dias_texto", label: "Días (texto)" },
  { token: "@inicio", label: "Inicio" },
  { token: "@fin", label: "Fin" },
  { token: "@ultimo_ingreso", label: "Último ingreso" },
];

interface MessageFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: MessageTemplate | null;
  onSuccess: () => void;
}

export function MessageFormSheet({ open, onOpenChange, template, onSuccess }: MessageFormSheetProps) {
  const isEditing = !!template;
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setName(template?.name || "");
      setContent(template?.content || "");
    }
  }, [open, template]);

  const insertToken = (token: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + token);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = content.slice(0, start);
    const after = content.slice(end);

    setContent(before + token + after);

    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + token.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!content.trim()) {
      toast.error("El contenido es obligatorio");
      return;
    }

    setSubmitting(true);
    try {
      const actionPromise = isEditing && template
        ? updateMessageTemplate({ id: template.id, name, content })
        : createMessageTemplate({ name, content });

      const result = await actionPromise;

      if (result.success) {
        toast.success(isEditing ? "Mensaje actualizado" : "Mensaje creado");
        onSuccess();
      } else {
        toast.error(result.error || "Error al guardar");
      }
    } catch {
      toast.error("Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex h-full flex-col overflow-hidden">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-5 w-5 text-primary" />
            {isEditing ? "Editar mensaje" : "Crear mensaje"}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Modifica el nombre y contenido del mensaje."
              : "Crea una plantilla para enviar por WhatsApp."}
          </SheetDescription>
        </SheetHeader>

        <div className="border-b bg-muted/30 px-6 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Placeholders disponibles
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 pb-28">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre del mensaje</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Recordatorio de inactividad"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Contenido</label>
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe tu mensaje..."
              className="min-h-[180px] resize-y font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Usa los botones de abajo para insertar datos del cliente automáticamente.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Insertar placeholder:</p>
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
                  <span className="ml-1 text-[10px] text-muted-foreground font-sans">
                    ({ph.label})
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-20 mt-auto border-t bg-background/95 px-6 py-4 backdrop-blur">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="min-w-32">
              {submitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear mensaje"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
