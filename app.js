// ============================================================
// QUINIELA LIGA MX — lógica de la aplicación (vanilla JS)
// ============================================================

const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const LS_USER = "quiniela_user"; // {id, nombre, pin}
const LS_ADMIN = "quiniela_admin_key";

let currentUser = JSON.parse(localStorage.getItem(LS_USER) || "null");
let adminKey = sessionStorage.getItem(LS_ADMIN) || null;

// ------------------------------------------------------------
// UTILIDADES
// ------------------------------------------------------------
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
function pillClass(estado) {
  return { abierta: "estado-abierta", cerrada: "estado-cerrada", finalizada: "estado-finalizada" }[estado] || "";
}
function estadoLabel(estado) {
  return { abierta: "Abierta", cerrada: "Cerrada", finalizada: "Finalizada" }[estado] || estado;
}

// ------------------------------------------------------------
// LOGIN
// ------------------------------------------------------------
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre = $("#loginNombre").value.trim();
  const pin = $("#loginPin").value.trim();
  const msg = $("#loginMsg");
  msg.textContent = "Entrando...";
  msg.classList.remove("error");

  const { data, error } = await supabase.rpc("login_participante", { p_nombre: nombre, p_pin: pin });
  if (error) {
    msg.textContent = "Error de conexión. Intenta de nuevo.";
    msg.classList.add("error");
    return;
  }
  const row = data && data[0];
  if (!row || !row.ok) {
    msg.textContent = (row && row.mensaje) || "No se pudo entrar";
    msg.classList.add("error");
    return;
  }
  currentUser = { id: row.id, nombre: row.nombre, pin };
  localStorage.setItem(LS_USER, JSON.stringify(currentUser));
  showApp();
});

$("#logoutBtn").addEventListener("click", () => {
  currentUser = null;
  localStorage.removeItem(LS_USER);
  location.reload();
});

function showApp() {
  $("#loginScreen").classList.add("hidden");
  $("#mainApp").classList.remove("hidden");
  $("#userBox").classList.remove("hidden");
  $("#userName").textContent = currentUser.nombre;
  loadPredicciones();
  loadTablaGeneral();
  loadJornadasHistorial();
}

// ------------------------------------------------------------
// TABS
// ------------------------------------------------------------
$all(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $all(".tab-btn").forEach((b) => b.classList.remove("active"));
    $all(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $("#tab-" + btn.dataset.tab).classList.add("active");
  });
});

// ------------------------------------------------------------
// TAB: PREDICCIONES
// ------------------------------------------------------------
async function loadPredicciones() {
  const container = $("#prediccionesContainer");
  container.innerHTML = "Cargando...";

  const { data: jornadas } = await supabase
    .from("jornadas")
    .select("*")
    .eq("estado", "abierta")
    .order("numero", { ascending: true });

  if (!jornadas || jornadas.length === 0) {
    container.innerHTML = '<p class="muted">No hay jornadas abiertas por ahora. Vuelve pronto.</p>';
    return;
  }

  container.innerHTML = "";
  for (const j of jornadas) {
    const { data: partidos } = await supabase
      .from("partidos")
      .select("*")
      .eq("jornada_id", j.id)
      .order("orden", { ascending: true });

    const { data: mias } = await supabase.rpc("mis_predicciones", {
      p_participante_id: currentUser.id,
      p_pin: currentUser.pin,
      p_jornada_id: j.id,
    });
    const misMap = {};
    (mias || []).forEach((m) => (misMap[m.partido_id] = m));

    const card = el("div", "card");
    card.appendChild(el("div", "jornada-header", `<h3>Jornada ${j.numero}</h3><span class="estado-pill ${pillClass(j.estado)}">${estadoLabel(j.estado)}</span>`));

    (partidos || []).forEach((p) => {
      const prev = misMap[p.id];
      const row = el("div", "partido");
      row.innerHTML = `
        <span class="equipo local">${p.local}</span>
        <div class="marcador-inputs">
          <input type="number" min="0" max="20" class="pred-local" data-partido="${p.id}" value="${prev ? prev.pred_local : ""}">
          <span class="marcador-sep">-</span>
          <input type="number" min="0" max="20" class="pred-visitante" data-partido="${p.id}" value="${prev ? prev.pred_visitante : ""}">
        </div>
        <span class="equipo visitante">${p.visitante}</span>
      `;
      card.appendChild(row);
    });

    const guardarRow = el("div", "guardar-row");
    const btn = el("button", "btn-secondary", "Guardar predicciones de esta jornada");
    btn.addEventListener("click", () => guardarJornadaPredicciones(j.id, card, btn));
    guardarRow.appendChild(btn);
    card.appendChild(guardarRow);
    const status = el("p", "form-msg");
    status.id = `pred-status-${j.id}`;
    card.appendChild(status);

    container.appendChild(card);
  }
}

async function guardarJornadaPredicciones(jornadaId, card, btn) {
  const status = card.querySelector(`#pred-status-${jornadaId}`);
  btn.disabled = true;
  status.textContent = "Guardando...";
  status.classList.remove("error");

  const inputsLocal = card.querySelectorAll(".pred-local");
  let errores = 0;
  for (const inp of inputsLocal) {
    const partidoId = inp.dataset.partido;
    const visInp = card.querySelector(`.pred-visitante[data-partido="${partidoId}"]`);
    const l = inp.value;
    const v = visInp.value;
    if (l === "" || v === "") continue; // se permite dejar partidos sin llenar
    const { data, error } = await supabase.rpc("guardar_prediccion", {
      p_participante_id: currentUser.id,
      p_pin: currentUser.pin,
      p_partido_id: Number(partidoId),
      p_local: Number(l),
      p_visitante: Number(v),
    });
    const row = data && data[0];
    if (error || !row || !row.ok) errores++;
  }

  btn.disabled = false;
  if (errores > 0) {
    status.textContent = `Se guardaron con ${errores} error(es). Revisa tu conexión.`;
    status.classList.add("error");
  } else {
    status.textContent = "¡Predicciones guardadas!";
  }
}

// ------------------------------------------------------------
// TAB: TABLA GENERAL
// ------------------------------------------------------------
async function loadTablaGeneral() {
  const container = $("#tablaGeneralContainer");
  container.innerHTML = "Cargando...";
  const { data, error } = await supabase.rpc("tabla_general");
  if (error || !data || data.length === 0) {
    container.innerHTML = '<p class="muted">Aún no hay jornadas finalizadas.</p>';
    return;
  }
  const table = el("table", "ranking");
  table.innerHTML = `<thead><tr><th>#</th><th>Jugador</th><th>Jornadas</th><th style="text-align:right">Puntos</th></tr></thead>`;
  const tbody = el("tbody");
  data.forEach((row, i) => {
    const tr = el("tr");
    tr.innerHTML = `
      <td class="rank-pos ${i < 3 ? "gold" : ""}">${i + 1}</td>
      <td>${row.nombre}</td>
      <td>${row.jornadas_jugadas}</td>
      <td class="rank-pts">${row.puntos_totales}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.innerHTML = "";
  container.appendChild(table);
}

// ------------------------------------------------------------
// TAB: JORNADAS (historial)
// ------------------------------------------------------------
async function loadJornadasHistorial() {
  const { data: jornadas } = await supabase.from("jornadas").select("*").order("numero", { ascending: false });
  const select = $("#jornadaSelect");
  select.innerHTML = "";
  (jornadas || []).forEach((j) => {
    const opt = el("option", "", `Jornada ${j.numero} (${estadoLabel(j.estado)})`);
    opt.value = j.id;
    opt.dataset.estado = j.estado;
    select.appendChild(opt);
  });
  select.onchange = () => renderJornadaDetalle(select.value);
  if (jornadas && jornadas.length > 0) renderJornadaDetalle(jornadas[0].id);
  else $("#jornadaDetalle").innerHTML = '<p class="muted">Todavía no hay jornadas creadas.</p>';
}

async function renderJornadaDetalle(jornadaId) {
  const container = $("#jornadaDetalle");
  container.innerHTML = "Cargando...";
  jornadaId = Number(jornadaId);

  const { data: jornadaArr } = await supabase.from("jornadas").select("*").eq("id", jornadaId);
  const jornada = jornadaArr && jornadaArr[0];
  if (!jornada) { container.innerHTML = ""; return; }

  const { data: partidos } = await supabase.from("partidos").select("*").eq("jornada_id", jornadaId).order("orden");

  container.innerHTML = "";

  if (jornada.estado === "abierta") {
    const card = el("div", "card", `<p class="muted">Esta jornada sigue abierta. Los partidos y predicciones se revelan cuando el administrador la cierre.</p>`);
    container.appendChild(card);
    const listCard = el("div", "card");
    listCard.appendChild(el("h3", "", "Partidos"));
    (partidos || []).forEach((p) => {
      listCard.appendChild(el("div", "partido", `<span class="equipo local">${p.local}</span><span class="marcador-sep">vs</span><span class="equipo visitante">${p.visitante}</span>`));
    });
    container.appendChild(listCard);
    return;
  }

  const partidosCard = el("div", "card");
  partidosCard.appendChild(el("h3", "", "Resultados"));
  (partidos || []).forEach((p) => {
    const tieneResultado = p.resultado_local !== null && p.resultado_visitante !== null;
    const row = el("div", "partido");
    row.innerHTML = `
      <span class="equipo local">${p.local}</span>
      <span class="resultado-score">${tieneResultado ? p.resultado_local + " - " + p.resultado_visitante : "vs"}</span>
      <span class="equipo visitante">${p.visitante}</span>
    `;
    partidosCard.appendChild(row);
  });
  container.appendChild(partidosCard);

  if (jornada.estado === "finalizada") {
    const { data: ranking } = await supabase.rpc("tabla_jornada", { p_jornada_id: jornadaId });
    const rankCard = el("div", "card");
    rankCard.appendChild(el("h3", "", "Puntos de esta jornada"));
    if (ranking && ranking.length > 0) {
      const table = el("table", "ranking");
      table.innerHTML = `<thead><tr><th>#</th><th>Jugador</th><th style="text-align:right">Puntos</th></tr></thead>`;
      const tbody = el("tbody");
      ranking.forEach((r, i) => {
        const tr = el("tr");
        tr.innerHTML = `<td class="rank-pos ${i < 3 ? "gold" : ""}">${i + 1}</td><td>${r.nombre}</td><td class="rank-pts">${r.puntos}</td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      rankCard.appendChild(table);
    } else {
      rankCard.appendChild(el("p", "muted", "Nadie registró predicciones en esta jornada."));
    }
    container.appendChild(rankCard);
  } else {
    container.appendChild(el("p", "muted", "Los resultados están cerrados a nuevas predicciones. El ranking de la semana aparecerá cuando el admin finalice la jornada."));
  }
}

// ------------------------------------------------------------
// TAB: ADMIN
// ------------------------------------------------------------
if (adminKey) {
  $("#adminLogin").classList.add("hidden");
  $("#adminPanel").classList.remove("hidden");
  loadAdminJornadas();
}

$("#adminLoginBtn").addEventListener("click", async () => {
  const key = $("#adminKeyInput").value.trim();
  const msg = $("#adminLoginMsg");
  msg.textContent = "Verificando...";
  msg.classList.remove("error");

  const { data, error } = await supabase.rpc("admin_verificar", { p_admin_key: key });
  if (error) {
    msg.textContent = "Error de conexión";
    msg.classList.add("error");
    return;
  }
  if (!data) {
    msg.textContent = "Clave incorrecta";
    msg.classList.add("error");
    return;
  }
  adminKey = key;
  sessionStorage.setItem(LS_ADMIN, key);
  $("#adminLogin").classList.add("hidden");
  $("#adminPanel").classList.remove("hidden");
  msg.textContent = "";
  loadAdminJornadas();
});

async function loadAdminJornadas() {
  const { data, error } = await supabase.rpc("admin_listar_jornadas", { p_admin_key: adminKey });
  const select = $("#adminJornadaSelect");
  select.innerHTML = "";
  if (error || !data) return;
  data.forEach((j) => {
    const opt = el("option", "", `Jornada ${j.numero} (${estadoLabel(j.estado)})`);
    opt.value = j.id;
    opt.dataset.estado = j.estado;
    select.appendChild(opt);
  });
  select.onchange = () => renderAdminJornada(select.value, data);
  if (data.length > 0) renderAdminJornada(select.value, data);
  else {
    $("#adminJornadaEstado").innerHTML = "";
    $("#adminPartidosList").innerHTML = '<p class="muted">Crea una jornada para empezar.</p>';
  }
}

async function renderAdminJornada(jornadaId, jornadasData) {
  jornadaId = Number(jornadaId);
  const jornada = jornadasData.find((j) => j.id === jornadaId);
  if (!jornada) return;

  $("#adminJornadaEstado").innerHTML = `<span class="estado-pill ${pillClass(jornada.estado)}">${estadoLabel(jornada.estado)}</span>`;
  $("#agregarPartidoBox").classList.toggle("hidden", jornada.estado !== "abierta");
  $("#cerrarJornadaBtn").disabled = jornada.estado !== "abierta";
  $("#finalizarJornadaBtn").disabled = jornada.estado !== "cerrada";

  const { data: partidos } = await supabase.from("partidos").select("*").eq("jornada_id", jornadaId).order("orden");
  const list = $("#adminPartidosList");
  list.innerHTML = "";
  (partidos || []).forEach((p) => {
    const row = el("div", "card");
    const puedeCapturar = jornada.estado === "cerrada" || jornada.estado === "finalizada";
    row.innerHTML = `
      <div class="partido">
        <span class="equipo local">${p.local}</span>
        <span class="marcador-sep">vs</span>
        <span class="equipo visitante">${p.visitante}</span>
      </div>
      ${puedeCapturar ? `
      <div class="row" style="margin-top:8px">
        <div class="resultado-inputs">
          <input type="number" min="0" class="res-local" value="${p.resultado_local ?? ""}">
          <span class="marcador-sep">-</span>
          <input type="number" min="0" class="res-visitante" value="${p.resultado_visitante ?? ""}">
        </div>
        <button class="btn-secondary btn-guardar-resultado">Guardar resultado</button>
      </div>` : ""}
    `;
    if (puedeCapturar) {
      row.querySelector(".btn-guardar-resultado").addEventListener("click", async () => {
        const l = row.querySelector(".res-local").value;
        const v = row.querySelector(".res-visitante").value;
        if (l === "" || v === "") return;
        const { data } = await supabase.rpc("admin_cargar_resultado", {
          p_admin_key: adminKey,
          p_partido_id: p.id,
          p_local: Number(l),
          p_visitante: Number(v),
        });
        $("#adminAccionMsg").textContent = (data && data[0] && data[0].mensaje) || "Listo";
      });
    }
    list.appendChild(row);
  });
}

$("#crearJornadaBtn").addEventListener("click", async () => {
  const numero = $("#nuevaJornadaNum").value;
  const msg = $("#crearJornadaMsg");
  if (!numero) return;
  const { data, error } = await supabase.rpc("admin_crear_jornada", { p_admin_key: adminKey, p_numero: Number(numero) });
  const row = data && data[0];
  msg.textContent = (row && row.mensaje) || "Error";
  msg.classList.toggle("error", !(row && row.ok));
  if (row && row.ok) {
    $("#nuevaJornadaNum").value = "";
    loadAdminJornadas();
  }
});

$("#agregarPartidoBtn").addEventListener("click", async () => {
  const jornadaId = Number($("#adminJornadaSelect").value);
  const local = $("#partidoLocal").value.trim();
  const visitante = $("#partidoVisitante").value.trim();
  const msg = $("#agregarPartidoMsg");
  if (!local || !visitante || !jornadaId) return;
  const { data, error } = await supabase.rpc("admin_agregar_partido", {
    p_admin_key: adminKey, p_jornada_id: jornadaId, p_local: local, p_visitante: visitante,
  });
  const row = data && data[0];
  msg.textContent = (row && row.mensaje) || "Error";
  msg.classList.toggle("error", !(row && row.ok));
  if (row && row.ok) {
    $("#partidoLocal").value = "";
    $("#partidoVisitante").value = "";
    loadAdminJornadas();
  }
});

$("#cerrarJornadaBtn").addEventListener("click", async () => {
  const jornadaId = Number($("#adminJornadaSelect").value);
  if (!jornadaId) return;
  if (!confirm("¿Cerrar esta jornada? Nadie podrá editar predicciones después de esto.")) return;
  const { data } = await supabase.rpc("admin_cerrar_jornada", { p_admin_key: adminKey, p_jornada_id: jornadaId });
  $("#adminAccionMsg").textContent = (data && data[0] && data[0].mensaje) || "Listo";
  loadAdminJornadas();
});

$("#finalizarJornadaBtn").addEventListener("click", async () => {
  const jornadaId = Number($("#adminJornadaSelect").value);
  if (!jornadaId) return;
  if (!confirm("¿Finalizar jornada y calcular puntos? Asegúrate de haber cargado todos los resultados.")) return;
  const { data } = await supabase.rpc("admin_finalizar_jornada", { p_admin_key: adminKey, p_jornada_id: jornadaId });
  const row = data && data[0];
  $("#adminAccionMsg").textContent = (row && row.mensaje) || "Error";
  $("#adminAccionMsg").classList.toggle("error", !(row && row.ok));
  loadAdminJornadas();
  loadTablaGeneral();
  loadJornadasHistorial();
});

$("#eliminarJornadaBtn").addEventListener("click", async () => {
  const jornadaId = Number($("#adminJornadaSelect").value);
  if (!jornadaId) return;
  if (!confirm("¿Eliminar esta jornada por completo? Esta acción no se puede deshacer.")) return;
  const { data } = await supabase.rpc("admin_eliminar_jornada", { p_admin_key: adminKey, p_jornada_id: jornadaId });
  $("#adminAccionMsg").textContent = (data && data[0] && data[0].mensaje) || "Listo";
  loadAdminJornadas();
  loadJornadasHistorial();
});

// ------------------------------------------------------------
// INIT
// ------------------------------------------------------------
if (currentUser) {
  showApp();
}
