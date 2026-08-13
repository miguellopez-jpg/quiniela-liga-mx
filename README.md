# Quiniela Liga MX

App web para llevar una quiniela de la Liga MX entre amigos: predicciones
semana a semana, tabla general acumulada, historial de jornadas y panel de
administrador. Sin necesidad de cuenta de Claude ni de ningún proveedor
para los participantes — solo nombre + PIN de 4 dígitos.

## Archivos

- `index.html` — estructura de la app (una sola página).
- `styles.css` — estilos (tema cancha nocturna / dorado).
- `app.js` — toda la lógica (login, predicciones, tabla, admin) usando Supabase.
- `config.js` — **edítalo** con la URL y la anon key de tu proyecto Supabase.
- `schema.sql` — pega esto en el SQL Editor de Supabase para crear toda la base de datos.

## Cómo desplegarla

Ver `GUIA_DESPLIEGUE.md` para instrucciones paso a paso (Supabase + Netlify),
sin necesidad de saber programar.

## Sistema de puntos

- 3 puntos: marcador exacto.
- 1 punto: sólo acertaste quién gana o el empate.
- 0 puntos: fallaste por completo.
