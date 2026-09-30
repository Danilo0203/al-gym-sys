'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { deletePlan } from '../../actions/plan-actions';
import type { Plan } from '@/features/customers/lib/local-memberships';
import { AlertModal } from '@/components/modal/alert-modal';
import { PlanFormSheet } from '../plan-form-sheet';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/features/profile/hooks/use-profile';

interface CellActionProps {
  data: Plan;
}

export const CellAction: React.FC<CellActionProps> = ({ data }) => {
  const [loading, setLoading] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();

  const canUpdate = Boolean(currentUser?.isOwner || currentUser?.permissions?.includes('plans.update'));
  const canDelete = Boolean(currentUser?.isOwner || currentUser?.permissions?.includes('plans.delete'));


  const onDelete = async () => {
    setLoading(true);
    try {
      const result = await deletePlan(data.id);
      if (result.success) {
        toast.success(result.message || 'Plan desactivado correctamente');
        router.refresh();
      } else {
        toast.error(`Error: ${result.error}`);
      }
      setOpenDelete(false);
    } catch {
        toast.error('Error al desactivar el plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AlertModal
        isOpen={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirm={onDelete}
        loading={loading}
        title="¿Desactivar este plan?"
        description="El plan dejará de ofrecerse a nuevos clientes. Las membresías anteriores conservarán su historial."
        confirmText="Desactivar"
      />
      
      {canUpdate ? (
        <PlanFormSheet 
          mode="edit" 
          plan={data} 
          open={openEdit} 
          onOpenChange={setOpenEdit}
          trigger={null}
        />
      ) : null}

      <div className="flex items-center gap-2">
          {canUpdate ? (
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 hover:bg-muted"
                onClick={() => setOpenEdit(true)}
            >
              <IconEdit className="h-4 w-4 text-blue-500" />
              <span className="sr-only">Editar</span>
            </Button>
          ) : null}
          {canDelete ? (
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 hover:bg-destructive/10"
                onClick={() => setOpenDelete(true)}
            >
              <IconTrash className="h-4 w-4 text-destructive" />
              <span className="sr-only">Desactivar</span>
            </Button>
          ) : null}
      </div>
    </>
  );
};
