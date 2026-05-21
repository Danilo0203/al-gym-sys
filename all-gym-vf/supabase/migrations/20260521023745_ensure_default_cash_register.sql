do $$
begin
  if not exists (
    select 1
    from public.cash_registers
    where is_active = true
  ) then
    update public.cash_registers
    set is_active = true
    where id = (
      select id
      from public.cash_registers
      where name = 'Caja principal'
      order by created_at asc
      limit 1
    );

    if not exists (
      select 1
      from public.cash_registers
      where is_active = true
    ) then
      insert into public.cash_registers (name, is_active)
      select 'Caja principal', true
      where not exists (
        select 1
        from public.cash_registers
        where is_active = true
      );
    end if;
  end if;
end $$;
