"use client";

import { useEffect, useState } from "react";
import {
  getMessageTemplates,
  deleteMessageTemplate,
  toggleMessageTemplateActive,
  type MessageTemplate,
} from "../actions/message-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Pencil, Trash2, MessageSquare, EyeOff, Eye } from "lucide-react";
import { MessageFormSheet } from "./message-form-sheet";

const TOKEN_PREVIEWS: Record<string, string> = {
  "@cliente": "Cliente Ejemplo",
  "@dias": "12",
  "@dias_texto": "12 días",
  "@inicio": "01/01/2025",
  "@fin": "01/02/2025",
  "@ultimo_ingreso": "08/02/2025",
};

function previewContent(content: string): string {
  let preview = content;
  for (const [token, sample] of Object.entries(TOKEN_PREVIEWS)) {
    preview = preview.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), sample);
  }
  return preview.length > 120 ? preview.slice(0, 120) + "..." : preview;
}

export function MessagesListing() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const fetchTemplates = async (silent = false) => {
    if (!silent) setLoading(true);
    const result = await getMessageTemplates({ includeInactive: true });
    if (result.success && result.data) {
      setTemplates(result.data);
    } else {
      toast.error(result.error || "Error al cargar mensajes");
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchTemplates();
  }, []);

  const handleToggleActive = async (template: MessageTemplate) => {
    const result = await toggleMessageTemplateActive(template.id, !template.is_active);
    if (result.success) {
      toast.success(template.is_active ? "Mensaje desactivado" : "Mensaje activado");
      await fetchTemplates(true);
    } else {
      toast.error(result.error || "Error al cambiar el estado");
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteMessageTemplate(id);
    if (result.success) {
      toast.success("Mensaje eliminado");
      await fetchTemplates(true);
    } else {
      toast.error(result.error || "Error al eliminar");
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {templates.map((template) => (
          <Card key={template.id} className="hover:bg-muted/50 transition-colors">
            <CardContent className="flex items-start justify-between p-4 gap-4">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="mt-0.5 shrink-0">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm truncate">{template.name}</span>
                    {template.is_active ? (
                      <Badge variant="default" className="text-[10px] h-4 px-1.5 shrink-0">
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0 text-muted-foreground">
                        Inactivo
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 break-words">
                    {previewContent(template.content)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleToggleActive(template)}
                  title={template.is_active ? "Desactivar" : "Activar"}
                >
                  {template.is_active ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setEditingTemplate(template);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDelete(template.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No hay mensajes configurados
          </div>
        )}
      </div>
      <MessageFormSheet
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingTemplate(null);
        }}
        template={editingTemplate}
        onSuccess={() => fetchTemplates(true)}
      />
    </>
  );
}
