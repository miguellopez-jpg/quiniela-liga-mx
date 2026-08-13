# Guía de despliegue — Quiniela Liga MX

Esta guía te lleva paso a paso para publicar tu quiniela en una URL pública real,
usando **Supabase** (base de datos gratuita) y **Netlify** (hosting gratuito).
No necesitas saber programar. Te va a tomar entre 15 y 25 minutos la primera vez.

Nadie que juegue necesitará crear cuenta en ningún lado — solo tú, como
administrador, necesitas las cuentas de Supabase y Netlify (gratis).

---

## Parte 1 — Crear la base de datos en Supabase

1. Ve a **https://supabase.com** y da clic en **"Start your project"**.
2. Crea tu cuenta (puedes usar tu cuenta de GitHub o tu correo).
3. Da clic en **"New project"**.
   - Organización: la que te asigne por default está bien.
   - Nombre del proyecto: `quiniela-liga-mx`.
   - Database Password: genera una y **guárdala** en un lugar seguro (no la vas a necesitar para esta app, pero es buena práctica guardarla).
   - Región: elige la más cercana a México (por ejemplo `East US` o `South America`).
   - Da clic en **"Create new project"** y espera 1-2 minutos mientras se aprovisiona.
4. Cuando el proyecto esté listo, en el menú lateral izquierdo entra a **SQL Editor**.
5. Da clic en **"New query"**.
6. Abre el archivo `schema.sql` (que te entregué), copia **todo** su contenido, y pégalo en el editor.
   - Si quieres usar tu propia clave de administrador en vez de la que generé, busca la línea que dice `crypt('Estadio-Gol-3462', ...)` y cambia el texto entre comillas por la clave que prefieras **antes** de correr el script.
7. Da clic en **"Run"** (o Ctrl/Cmd + Enter). Debe decir "Success. No rows returned".
8. Ve a **Project Settings** (ícono de engrane) → **API**.
9. Copia dos valores, los vas a necesitar en la Parte 2:
   - **Project URL** (algo como `https://xxxxxxxxxxxx.supabase.co`)
   - **anon public key** (una cadena larga que empieza con `eyJ...`)

> Nota: la "anon public key" está diseñada para ser pública — vive en el
> navegador de cada usuario. La seguridad real está en las reglas (RLS) y
> funciones que ya vienen configuradas en `schema.sql`, que impiden leer
> PINs de otros o editar predicciones ajenas.

---

## Parte 2 — Configurar el código con tus datos de Supabase

1. Abre el archivo `config.js` (que te entregué) con cualquier editor de texto (Bloc de notas, TextEdit, VS Code, etc.).
2. Reemplaza:
   ```js
   window.SUPABASE_URL = "PEGA_AQUI_TU_SUPABASE_URL";
   window.SUPABASE_ANON_KEY = "PEGA_AQUI_TU_SUPABASE_ANON_KEY";
   ```
   con tus valores reales de la Parte 1, por ejemplo:
   ```js
   window.SUPABASE_URL = "https://xxxxxxxxxxxx.supabase.co";
   window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
   ```
3. Guarda el archivo.

---

## Parte 3 — Publicar la app en Netlify

1. Ve a **https://app.netlify.com** y crea tu cuenta gratis (puedes usar GitHub, GitLab, o correo).
2. Una vez dentro, ve a la sección **"Sites"** y busca el recuadro que dice **"Add new site" → "Deploy manually"** (a veces aparece como una zona para arrastrar archivos, "Drag and drop your site folder here").
3. En tu computadora, ve a la carpeta `quiniela-liga-mx` que te entregué (con `index.html`, `styles.css`, `app.js`, `config.js` ya editado).
4. **Arrastra la carpeta completa** a esa zona de Netlify. Espera unos segundos mientras se publica.
5. Netlify te va a asignar una URL aleatoria como `https://random-name-123.netlify.app`. Pruébala — ya debería funcionar.
6. Para ponerle un nombre bonito:
   - Ve a **"Site configuration"** (o "Site settings") → **"Change site name"**.
   - Escribe `quiniela-liga-mx` (si ya está tomado, prueba `quiniela-liga-mx-<tu-grupo>`).
   - Guarda. Tu URL final será algo como:
     **`https://quiniela-liga-mx.netlify.app`**
7. Comparte esa URL por WhatsApp con tus amigos. Nadie necesita crear cuenta en Netlify, Supabase, ni Claude — solo entran, ponen su nombre y un PIN de 4 dígitos.

> Tip para actualizaciones futuras: si algún día quieres cambiar el diseño o
> agregar algo al código, edita los archivos y vuelve a arrastrar la carpeta
> a la misma zona de Netlify ("deploys" → arrastra de nuevo) para republicar.

---

## Parte 4 — Cómo entras tú como administrador cada semana

1. Abre la URL de tu quiniela (`https://quiniela-liga-mx.netlify.app`) en tu celular o computadora.
2. Si es tu primera vez, entra como cualquier participante (nombre + PIN) — esto es opcional, solo si tú también quieres jugar.
3. Ve a la pestaña **"Admin"** (arriba).
4. Escribe la clave de administrador:

   **`Estadio-Gol-3462`**

   (o la que tú hayas puesto en el paso 6 de la Parte 1). Da clic en **"Entrar como admin"**.

5. **Para abrir una nueva jornada:**
   - En "Crear nueva jornada", escribe el número (ej. `5`) y da clic en **"Crear jornada"**.
   - Selecciónala en el menú desplegable "Administrar jornada".
   - En "Agregar partido", escribe equipo local y visitante (texto libre, sin lista fija) y da clic en **"Agregar"** por cada partido de la jornada.
   - Los participantes ya pueden ver esta jornada en su pestaña "Predicciones" y capturar sus marcadores.

6. **Antes de que empiecen los partidos:**
   - Selecciona la jornada y da clic en **"Cerrar predicciones"**. A partir de ahí nadie puede editar ni agregar predicciones, y las predicciones de todos se vuelven visibles en "Jornadas" (historial).

7. **Cuando terminen los partidos:**
   - Con la jornada seleccionada (ya "Cerrada"), captura el marcador real de cada partido en los campos que aparecen debajo de cada uno, y da clic en **"Guardar resultado"** por cada uno.
   - Cuando ya tengas todos los resultados cargados, da clic en **"Finalizar jornada (calcular puntos)"**. Esto calcula automáticamente los puntos de todos (3 / 1 / 0) y actualiza la Tabla General.

8. **Si necesitas eliminar una jornada** (por ejemplo la creaste por error), selecciónala y da clic en **"Eliminar jornada"**. Esto borra también sus partidos y predicciones — no se puede deshacer.

### Cambiar la clave de administrador más adelante

Ve a Supabase → SQL Editor → nueva query, y corre (reemplazando `tu_nueva_clave`):

```sql
update admin_config
set admin_key_hash = crypt('tu_nueva_clave', gen_salt('bf'))
where id = 1;
```

---

## Resumen de lo que ya está resuelto

- **Sin cuentas para participantes**: solo nombre + PIN de 4 dígitos, guardado en la base de datos (hasheado, nunca en texto plano).
- **Predicciones ocultas** mientras la jornada está abierta — solo se revelan cuando el admin la cierra.
- **Puntos automáticos**: 3 exacto, 1 solo resultado (gana/pierde/empate), 0 si fallas.
- **Datos reales en base de datos** (Supabase/Postgres), no localStorage — se ve igual desde cualquier celular o computadora, y sobrevive a que cierres el navegador.
- **Responsive**: funciona bien en celular, que es como la mayoría de tus amigos la van a usar.
- **Costo**: $0. Los planes gratuitos de Supabase y Netlify son más que suficientes para un grupo de amigos jugando una temporada de Liga MX.
