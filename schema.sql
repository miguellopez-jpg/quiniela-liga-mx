-- ============================================================
-- QUINIELA LIGA MX — Esquema de base de datos para Supabase
-- ============================================================
-- Instrucciones: copia TODO este archivo y pégalo en
-- Supabase → SQL Editor → New query → Run
-- ============================================================

-- Extensión necesaria para hashear PINs y la clave de admin
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- TABLAS
-- ------------------------------------------------------------

create table if not exists participantes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  pin_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists jornadas (
  id serial primary key,
  numero int not null unique,
  estado text not null default 'abierta' check (estado in ('abierta','cerrada','finalizada')),
  created_at timestamptz not null default now()
);

create table if not exists partidos (
  id serial primary key,
  jornada_id int not null references jornadas(id) on delete cascade,
  local text not null,
  visitante text not null,
  resultado_local int,
  resultado_visitante int,
  orden int not null default 0
);

create table if not exists predicciones (
  id serial primary key,
  partido_id int not null references partidos(id) on delete cascade,
  participante_id uuid not null references participantes(id) on delete cascade,
  pred_local int not null,
  pred_visitante int not null,
  puntos int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partido_id, participante_id)
);

-- Config de administrador (una sola fila). No es legible desde el cliente.
create table if not exists admin_config (
  id int primary key default 1,
  admin_key_hash text not null
);

-- ¡IMPORTANTE! Reemplaza 'Estadio-Gol-3462' por tu propia clave si quieres
-- una distinta antes de correr este script (o cámbiala después, ver
-- sección "Cambiar la clave de admin" en la guía).
insert into admin_config (id, admin_key_hash)
values (1, crypt('Estadio-Gol-3462', gen_salt('bf')))
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
-- Todo el acceso de escritura/lectura sensible pasa por funciones
-- RPC (security definer) más abajo. Las tablas en sí quedan
-- bloqueadas para el rol anónimo excepto lecturas públicas
-- explícitas (jornadas, partidos, y predicciones sólo cuando la
-- jornada ya no está abierta).

alter table participantes enable row level security;
alter table jornadas enable row level security;
alter table partidos enable row level security;
alter table predicciones enable row level security;
alter table admin_config enable row level security;

-- jornadas y partidos: lectura pública, escritura sólo vía RPC
create policy "jornadas_select_publico" on jornadas for select using (true);
create policy "partidos_select_publico" on partidos for select using (true);

-- participantes: NO se exponen filas directamente (evita filtrar pin_hash)
-- (sin policy de select => nadie puede leer la tabla directo con anon key)

-- predicciones: sólo visibles cuando la jornada ya no está "abierta"
create policy "predicciones_select_si_no_abierta" on predicciones
  for select using (
    exists (
      select 1 from partidos p
      join jornadas j on j.id = p.jornada_id
      where p.id = predicciones.partido_id
        and j.estado <> 'abierta'
    )
  );

-- admin_config: nunca legible desde el cliente
-- (sin policies => bloqueado por completo salvo funciones security definer)

-- ------------------------------------------------------------
-- FUNCIONES RPC
-- ------------------------------------------------------------

-- Login / registro de participante. Si el nombre no existe, lo crea
-- con el PIN dado. Si existe, valida el PIN.
create or replace function login_participante(p_nombre text, p_pin text)
returns table(id uuid, nombre text, ok boolean, mensaje text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row participantes%rowtype;
begin
  if p_nombre is null or length(trim(p_nombre)) = 0 then
    return query select null::uuid, null::text, false, 'Escribe tu nombre';
    return;
  end if;
  if p_pin !~ '^[0-9]{4}$' then
    return query select null::uuid, null::text, false, 'El PIN debe ser de 4 dígitos';
    return;
  end if;

  select * into v_row from participantes pt where lower(pt.nombre) = lower(trim(p_nombre));

  if not found then
    insert into participantes (nombre, pin_hash)
    values (trim(p_nombre), crypt(p_pin, gen_salt('bf')))
    returning * into v_row;
    return query select v_row.id, v_row.nombre, true, 'Cuenta creada';
    return;
  end if;

  if v_row.pin_hash = crypt(p_pin, v_row.pin_hash) then
    return query select v_row.id, v_row.nombre, true, 'Bienvenido de vuelta';
  else
    return query select null::uuid, null::text, false, 'PIN incorrecto';
  end if;
end;
$$;

-- Guarda (inserta o actualiza) la predicción de un participante para un
-- partido, validando su PIN y que la jornada siga abierta.
create or replace function guardar_prediccion(
  p_participante_id uuid,
  p_pin text,
  p_partido_id int,
  p_local int,
  p_visitante int
)
returns table(ok boolean, mensaje text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_part participantes%rowtype;
  v_estado text;
begin
  select * into v_part from participantes where id = p_participante_id;
  if not found or v_part.pin_hash <> crypt(p_pin, v_part.pin_hash) then
    return query select false, 'Sesión inválida, vuelve a entrar';
    return;
  end if;

  if p_local is null or p_visitante is null or p_local < 0 or p_visitante < 0 then
    return query select false, 'Marcador inválido';
    return;
  end if;

  select j.estado into v_estado
  from partidos p join jornadas j on j.id = p.jornada_id
  where p.id = p_partido_id;

  if not found then
    return query select false, 'Partido no encontrado';
    return;
  end if;
  if v_estado <> 'abierta' then
    return query select false, 'Esta jornada ya no acepta predicciones';
    return;
  end if;

  insert into predicciones (partido_id, participante_id, pred_local, pred_visitante)
  values (p_partido_id, p_participante_id, p_local, p_visitante)
  on conflict (partido_id, participante_id)
  do update set pred_local = excluded.pred_local,
                pred_visitante = excluded.pred_visitante,
                updated_at = now();

  return query select true, 'Predicción guardada';
end;
$$;

-- Devuelve las predicciones propias de un participante para una jornada,
-- sin importar si sigue abierta o no (validando PIN).
create or replace function mis_predicciones(
  p_participante_id uuid,
  p_pin text,
  p_jornada_id int
)
returns table(partido_id int, pred_local int, pred_visitante int, puntos int)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_part participantes%rowtype;
begin
  select * into v_part from participantes where id = p_participante_id;
  if not found or v_part.pin_hash <> crypt(p_pin, v_part.pin_hash) then
    return;
  end if;

  return query
    select pr.partido_id, pr.pred_local, pr.pred_visitante, pr.puntos
    from predicciones pr
    join partidos p on p.id = pr.partido_id
    where pr.participante_id = p_participante_id
      and p.jornada_id = p_jornada_id;
end;
$$;

-- Tabla general: puntos acumulados por participante en jornadas finalizadas
create or replace function tabla_general()
returns table(participante_id uuid, nombre text, puntos_totales bigint, jornadas_jugadas bigint)
language sql
security definer
set search_path = public, extensions
as $$
  select
    pa.id,
    pa.nombre,
    coalesce(sum(pr.puntos), 0) as puntos_totales,
    count(distinct j.id) as jornadas_jugadas
  from participantes pa
  left join predicciones pr on pr.participante_id = pa.id
  left join partidos p on p.id = pr.partido_id
  left join jornadas j on j.id = p.jornada_id and j.estado = 'finalizada'
  where pr.puntos is not null
  group by pa.id, pa.nombre
  order by puntos_totales desc, pa.nombre asc;
$$;

-- Resultados de una jornada específica (ranking de esa semana)
create or replace function tabla_jornada(p_jornada_id int)
returns table(participante_id uuid, nombre text, puntos bigint)
language sql
security definer
set search_path = public, extensions
as $$
  select pa.id, pa.nombre, coalesce(sum(pr.puntos),0) as puntos
  from participantes pa
  join predicciones pr on pr.participante_id = pa.id
  join partidos p on p.id = pr.partido_id
  where p.jornada_id = p_jornada_id and pr.puntos is not null
  group by pa.id, pa.nombre
  order by puntos desc, pa.nombre asc;
$$;

-- ------------------------------------------------------------
-- FUNCIONES DE ADMINISTRADOR (todas piden p_admin_key)
-- ------------------------------------------------------------

create or replace function _check_admin(p_admin_key text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from admin_config
    where id = 1 and admin_key_hash = crypt(p_admin_key, admin_key_hash)
  );
$$;

create or replace function admin_crear_jornada(p_admin_key text, p_numero int)
returns table(ok boolean, mensaje text, jornada_id int)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id int;
begin
  if not _check_admin(p_admin_key) then
    return query select false, 'Clave de administrador incorrecta', null::int;
    return;
  end if;
  insert into jornadas (numero, estado) values (p_numero, 'abierta') returning id into v_id;
  return query select true, 'Jornada creada', v_id;
exception when unique_violation then
  return query select false, 'Ya existe una jornada con ese número', null::int;
end;
$$;

create or replace function admin_agregar_partido(
  p_admin_key text, p_jornada_id int, p_local text, p_visitante text
)
returns table(ok boolean, mensaje text, partido_id int)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id int;
  v_orden int;
begin
  if not _check_admin(p_admin_key) then
    return query select false, 'Clave de administrador incorrecta', null::int;
    return;
  end if;
  select coalesce(max(orden),0)+1 into v_orden from partidos where jornada_id = p_jornada_id;
  insert into partidos (jornada_id, local, visitante, orden)
  values (p_jornada_id, trim(p_local), trim(p_visitante), v_orden)
  returning id into v_id;
  return query select true, 'Partido agregado', v_id;
end;
$$;

create or replace function admin_cerrar_jornada(p_admin_key text, p_jornada_id int)
returns table(ok boolean, mensaje text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not _check_admin(p_admin_key) then
    return query select false, 'Clave de administrador incorrecta';
    return;
  end if;
  update jornadas set estado = 'cerrada' where id = p_jornada_id and estado = 'abierta';
  if not found then
    return query select false, 'La jornada no está abierta';
    return;
  end if;
  return query select true, 'Jornada cerrada. Ya no se aceptan predicciones';
end;
$$;

create or replace function admin_cargar_resultado(
  p_admin_key text, p_partido_id int, p_local int, p_visitante int
)
returns table(ok boolean, mensaje text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not _check_admin(p_admin_key) then
    return query select false, 'Clave de administrador incorrecta';
    return;
  end if;
  update partidos set resultado_local = p_local, resultado_visitante = p_visitante
  where id = p_partido_id;
  if not found then
    return query select false, 'Partido no encontrado';
    return;
  end if;
  return query select true, 'Resultado cargado';
end;
$$;

-- Calcula puntos de todas las predicciones de la jornada y la marca
-- como finalizada. Reglas: 3 pts marcador exacto, 1 pt sólo signo
-- (ganador/empate) correcto, 0 en cualquier otro caso.
create or replace function admin_finalizar_jornada(p_admin_key text, p_jornada_id int)
returns table(ok boolean, mensaje text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_sin_resultado int;
begin
  if not _check_admin(p_admin_key) then
    return query select false, 'Clave de administrador incorrecta';
    return;
  end if;

  select count(*) into v_sin_resultado
  from partidos
  where jornada_id = p_jornada_id
    and (resultado_local is null or resultado_visitante is null);

  if v_sin_resultado > 0 then
    return query select false, format('Faltan %s partido(s) por capturar resultado', v_sin_resultado);
    return;
  end if;

  update predicciones pr
  set puntos = case
    when pr.pred_local = p.resultado_local and pr.pred_visitante = p.resultado_visitante then 3
    when sign(pr.pred_local - pr.pred_visitante) = sign(p.resultado_local - p.resultado_visitante) then 1
    else 0
  end
  from partidos p
  where p.id = pr.partido_id and p.jornada_id = p_jornada_id;

  update jornadas set estado = 'finalizada' where id = p_jornada_id;

  return query select true, 'Jornada finalizada y puntos calculados';
end;
$$;

create or replace function admin_eliminar_jornada(p_admin_key text, p_jornada_id int)
returns table(ok boolean, mensaje text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not _check_admin(p_admin_key) then
    return query select false, 'Clave de administrador incorrecta';
    return;
  end if;
  delete from jornadas where id = p_jornada_id;
  return query select true, 'Jornada eliminada';
end;
$$;

-- Lista jornadas con sus partidos y (si aplica) resultados — usada por
-- el panel admin para elegir en qué jornada trabajar.
-- Verifica si una clave de administrador es correcta (para el login del panel)
create or replace function admin_verificar(p_admin_key text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select _check_admin(p_admin_key);
$$;

create or replace function admin_listar_jornadas(p_admin_key text)
returns table(id int, numero int, estado text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not _check_admin(p_admin_key) then
    return;
  end if;
  return query select j.id, j.numero, j.estado from jornadas j order by j.numero desc;
end;
$$;

-- ------------------------------------------------------------
-- PERMISOS: el rol anon (usado por el navegador) puede EJECUTAR
-- las funciones RPC y hacer SELECT donde las policies lo permiten,
-- pero no tiene INSERT/UPDATE/DELETE directo en ninguna tabla.
-- ------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select on jornadas, partidos, predicciones to anon;
grant execute on all functions in schema public to anon;
