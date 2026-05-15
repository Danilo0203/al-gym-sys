-- Add explicit permission to close cash without admin password.

insert into public.permissions (key, description, module, action)
values (
  'cash.close_without_admin_password',
  'Cerrar caja sin contraseña de administrador',
  'cash',
  'close_without_admin_password'
)
on conflict (key) do nothing;

-- Replace close_cash_session with an RPC that records
-- which admin/owner authorized the closure.
CREATE OR REPLACE FUNCTION public.close_cash_session(p_session_id uuid, p_counted_amount numeric, p_notes text DEFAULT NULL::text, p_requested_by_user_id uuid DEFAULT NULL::uuid, p_closed_by_user_id uuid DEFAULT NULL::uuid)
 RETURNS public.cash_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_session public.cash_sessions%rowtype;
  v_expected_amount numeric(12,2);
  v_difference_amount numeric(12,2);
  v_closed_role text;
begin
  if p_counted_amount is null or p_counted_amount < 0 then
    raise exception 'Debe ingresar el monto contado';
  end if;

  if p_requested_by_user_id is null then
    raise exception 'Debe indicar el usuario solicitante';
  end if;

  if p_closed_by_user_id is null then
    raise exception 'Debe indicar el usuario que autorizó el cierre';
  end if;

  perform 1
  from public.profiles
  where id = p_requested_by_user_id;

  if not found then
    raise exception 'Usuario solicitante no encontrado';
  end if;

  select role::text
  into v_closed_role
  from public.profiles
  where id = p_closed_by_user_id;

  if not found then
    raise exception 'Usuario que autorizó el cierre no encontrado';
  end if;

  if p_closed_by_user_id <> p_requested_by_user_id and v_closed_role not in ('admin', 'owner') then
    raise exception 'Solo un administrador u owner puede autorizar el cierre de otra caja';
  end if;

  select *
  into v_session
  from public.cash_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Sesión de caja no encontrada';
  end if;

  if v_session.status <> 'open' then
    raise exception 'La sesión ya no está abierta';
  end if;

  if v_session.opened_by_user_id <> p_requested_by_user_id and v_closed_role not in ('admin', 'owner') then
    raise exception 'No autorizado para cerrar esta sesión';
  end if;

  select
    v_session.opening_amount + coalesce(sum(cm.cash_effect_amount), 0)
  into v_expected_amount
  from public.cash_movements cm
  where cm.cash_session_id = v_session.id
    and cm.session_link_status = 'assigned'
    and cm.voided_at is null;

  v_difference_amount := p_counted_amount - v_expected_amount;

  if v_difference_amount <> 0 and nullif(trim(coalesce(p_notes, '')), '') is null then
    raise exception 'Debe agregar una observación cuando exista diferencia';
  end if;

  update public.cash_sessions
  set closed_by_user_id = p_closed_by_user_id,
      closed_at = now(),
      expected_amount = v_expected_amount,
      counted_amount = p_counted_amount,
      difference_amount = v_difference_amount,
      status = case
        when v_difference_amount = 0 then 'closed'
        else 'closed_with_difference'
      end,
      notes = case
        when v_difference_amount = 0 then v_session.notes
        else nullif(trim(coalesce(p_notes, '')), '')
      end
  where id = v_session.id
  returning *
  into v_session;

  return v_session;
end;
$function$
;