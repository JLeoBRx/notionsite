/* Central InclusiVR — site de consulta visual dos dados exportados do Notion. */
(function () {
  "use strict";

  const DATA = window.NOTION_DATA;
  const ITEMS = DATA.itens;
  const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
  const view = document.getElementById("view");

  // ---------- Configuração visual ----------
  const TIPOS = {
    Projetos: { icone: "💡", nome: "Projeto", plural: "Projetos" },
    Tarefas: { icone: "📋", nome: "Tarefa", plural: "Tarefas" },
    Ata: { icone: "📝", nome: "Ata", plural: "Atas" },
    Contato: { icone: "📞", nome: "Contato", plural: "Contatos" },
    Documento: { icone: "📂", nome: "Documento", plural: "Documentos" },
    Evento: { icone: "🗓️", nome: "Evento", plural: "Eventos" },
    Cronograma: { icone: "🕝", nome: "Cronograma", plural: "Cronogramas" },
  };
  const AREAS = {
    "Desenvolvimento e Inovação": { cor: "#15b0ff", icone: "🧪" },
    "Marketing e Vendas": { cor: "#ac2fed", icone: "📣" },
    "Editais e Captação": { cor: "#65a30d", icone: "🏆" },
    "Parcerias e Relacionamentos": { cor: "#e8418f", icone: "🤝" },
    "Backoffice e Gestão": { cor: "#4f46e5", icone: "🗂️" },
  };
  const STATUS = ["Não iniciada", "Aguardando", "Em andamento", "Contínuas", "Concluído"];
  const STATUS_COR = { "Não iniciada": "#9aa3b8", Aguardando: "#f5a524", "Em andamento": "#15b0ff", "Contínuas": "#ac2fed", "Concluído": "#7cc423" };
  const PRIORIDADE_ICONE = { "Prioridade Alta": "🔥", "Prioridade da Semana": "⚡", "Prioridade Média": "▲", Acompanhar: "👀", Congelado: "❄️" };
  const PESSOA_CORES = ["#ac2fed", "#15b0ff", "#280eaa", "#e8418f", "#65a30d", "#f5a524", "#0ea5a5"];
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  // pessoas na ordem de quem tem mais itens
  const PESSOAS = (() => {
    const c = new Map();
    ITEMS.forEach((i) => i.pessoas.forEach((p) => p !== "Todos" && c.set(p, (c.get(p) || 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  })();
  const pessoaCor = (p) => PESSOA_CORES[PESSOAS.indexOf(p) % PESSOA_CORES.length] || "#7a7191";

  // ---------- Utilidades ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const toDate = (iso) => (iso ? new Date(iso + "T00:00:00") : null);
  const dueOf = (i) => (i.prazo && (i.prazo.end || i.prazo.start) ? toDate(i.prazo.end || i.prazo.start) : null);
  const startOf = (i) => (i.prazo && i.prazo.start ? toDate(i.prazo.start) : null);
  const diasAte = (d) => Math.round((d - hoje) / 86400000);
  const isDone = (i) => i.status === "Concluído";
  const isLate = (i) => !isDone(i) && dueOf(i) && diasAte(dueOf(i)) < 0;

  function fmtData(i) {
    if (!i.prazo) return "";
    if (!i.prazo.start) return i.prazo.raw;
    const a = toDate(i.prazo.start), b = toDate(i.prazo.end);
    const d = (x) => `${x.getDate()} ${MESES[x.getMonth()]}`;
    if (!b) return d(a);
    return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MESES[b.getMonth()]}` : `${d(a)} – ${d(b)}`;
  }

  function dueBadge(i) {
    const d = dueOf(i);
    if (isDone(i)) return d ? `<span class="due done">✓ ${esc(fmtData(i))}</span>` : `<span class="due done">✓ Feito</span>`;
    if (!d) return "";
    const n = diasAte(d), s = startOf(i), ns = s ? diasAte(s) : n;
    let txt, cls = "";
    if (n < 0) { txt = `Atrasado há ${plural(-n, "dia", "dias")}`; cls = "late"; }
    else if (ns <= 0 && i.prazo.end) { txt = n === 0 ? "Termina hoje" : "Acontecendo"; cls = "soon"; }
    else if (ns === 0) { txt = "Hoje"; cls = "soon"; }
    else if (ns === 1) { txt = "Amanhã"; cls = "soon"; }
    else { txt = `Em ${ns} dias`; cls = ns <= 7 ? "soon" : ""; }
    return `<span class="due ${cls}" title="${esc(fmtData(i))}">${txt}</span>`;
  }

  function dateBox(i) {
    const d = startOf(i);
    if (!d) return `<span class="date-box none" aria-hidden="true">${TIPOS[i.tipo]?.icone || "•"}</span>`;
    return `<span class="date-box${isLate(i) ? " late" : ""}"><b>${d.getDate()}</b><small>${MESES[d.getMonth()]}</small></span>`;
  }

  const statusPill = (s) => (s ? `<span class="pill st-${slug(s)}">${esc(s)}</span>` : "");
  const prioPill = (p) => (p ? `<span class="pill pr-${slug(p)}">${PRIORIDADE_ICONE[p] || ""} ${esc(p.replace("Prioridade ", ""))}</span>` : "");
  const areaColor = (a) => (AREAS[a] || {}).cor || "#ac2fed";
  const areaChip = (a, link) =>
    `<${link ? `a href="#tarefas?area=${encodeURIComponent(a)}&tipo=todos"` : "span"} class="chip area" style="--c:${areaColor(a)}"><span class="dot"></span>${esc(a)}</${link ? "a" : "span"}>`;
  const areaChips = (i, link) => (i.areas.length ? `<div class="chips">${i.areas.map((a) => areaChip(a, link)).join("")}</div>` : "");
  const iniciais = (n) => n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const avatar = (p, cls = "") =>
    p === "Todos"
      ? `<span class="avatar all ${cls}" title="Todos">Todos</span>`
      : `<span class="avatar ${cls}" style="--c:${pessoaCor(p)}" title="${esc(p)}">${esc(iniciais(p))}</span>`;
  const avatars = (i) => (i.pessoas.length ? `<span class="avatars">${i.pessoas.map(avatar).join("")}</span>` : "");
  const bandFor = (i) => {
    const cores = i.areas.map(areaColor);
    if (!cores.length) return "";
    if (cores.length === 1) return `--band:${cores[0]}`;
    return `--band:linear-gradient(90deg,${cores.join(",")})`;
  };

  // ---------- Projetos e relações ----------
  const PROJETOS = ITEMS.filter((i) => i.tipo === "Projetos");
  const PROJETO_POR_CHAVE = new Map();
  PROJETOS.forEach((p) => {
    PROJETO_POR_CHAVE.set(norm(p.titulo), p);
    p.projetos.forEach((k) => PROJETO_POR_CHAVE.set(norm(k), p));
  });
  const chavesDoProjeto = (p) => new Set([norm(p.titulo), ...p.projetos.map(norm)]);
  function relacionados(p) {
    const ch = chavesDoProjeto(p);
    return ITEMS.filter((i) => i !== p && i.projetos.some((k) => ch.has(norm(k))));
  }
  const projetoChip = (nome) => {
    const p = PROJETO_POR_CHAVE.get(norm(nome));
    return p && p.id ? `<a class="chip" href="#item/${p.id}">💡 ${esc(nome)}</a>` : `<span class="chip">${esc(nome)}</span>`;
  };

  const porPrazo = (a, b) => {
    const da = dueOf(a), db = dueOf(b);
    if (da && db) return da - db;
    if (da) return -1;
    if (db) return 1;
    return a.titulo.localeCompare(b.titulo, "pt");
  };

  // ---------- Componentes ----------
  function listItem(i) {
    const sub = [TIPOS[i.tipo]?.nome || i.tipo, i.projetos[0]].filter(Boolean).join(" · ");
    return `<a class="list-item" href="#item/${i.id}">
      ${dateBox(i)}
      <span><span class="t">${esc(i.titulo)}</span><span class="s">${esc(sub)}</span></span>
      <span class="right">${dueBadge(i)}${avatars(i)}</span>
    </a>`;
  }

  function projectCard(p) {
    const rel = relacionados(p);
    const feitos = rel.filter(isDone).length;
    const pct = rel.length ? Math.round((feitos / rel.length) * 100) : 0;
    return `<a class="card" href="#item/${p.id}" style="${bandFor(p)}">
      <div class="row"><span class="chips">${statusPill(p.status)}${prioPill(p.prioridade)}</span>${dueBadge(p)}</div>
      <h3>${esc(p.titulo)}</h3>
      ${p.descricao ? `<p class="desc">${esc(p.descricao)}</p>` : ""}
      ${areaChips(p)}
      <div>
        <div class="progress-label"><span>${plural(rel.length, "item ligado", "itens ligados")}</span><span>${feitos}/${rel.length} concluídos</span></div>
        <div class="progress" role="img" aria-label="${pct}% concluído"><span style="width:${pct}%"></span></div>
      </div>
      <div class="foot">${avatars(p)}<span class="meta">${TIPOS.Projetos.icone} Projeto</span></div>
    </a>`;
  }

  function miniCard(i) {
    return `<a class="mini" href="#item/${i.id}" style="--c:${i.areas.length ? areaColor(i.areas[0]) : "#ac2fed"}">
      <b>${esc(i.titulo)}</b>
      ${i.projetos.length ? `<span class="proj">💡 ${esc(i.projetos.join(", "))}</span>` : ""}
      <span class="row">${dueBadge(i) || prioPill(i.prioridade) || "<span></span>"}${avatars(i)}</span>
    </a>`;
  }

  function genericCard(i) {
    return `<a class="card" href="#item/${i.id}" style="${bandFor(i)}">
      <div class="row"><span class="meta">${TIPOS[i.tipo]?.icone || ""} ${esc(TIPOS[i.tipo]?.nome || i.tipo)}</span>${statusPill(i.status)}</div>
      <h3>${esc(i.titulo)}</h3>
      ${i.descricao ? `<p class="desc">${esc(i.descricao)}</p>` : ""}
      ${areaChips(i)}
      <div class="foot">${avatars(i) || "<span></span>"}${dueBadge(i)}</div>
    </a>`;
  }

  function contactCard(i) {
    return `<a class="card" href="#item/${i.id}" style="${bandFor(i)}">
      <div class="contact-top">
        <span class="avatar" style="--c:linear-gradient(135deg,${areaColor(i.areas[0])},#280eaa)">${esc(iniciais(i.titulo))}</span>
        <div><h3>${esc(i.titulo)}</h3><span class="meta">${i.pessoas.length ? "Responsável: " + esc(i.pessoas.join(", ")) : "Sem responsável"}</span></div>
      </div>
      ${i.descricao ? `<p class="desc">${esc(i.descricao)}</p>` : ""}
      <div class="foot">${areaChips(i) || "<span></span>"}${statusPill(i.status)}</div>
    </a>`;
  }

  function pageHead(eyebrow, titulo, texto) {
    return `<section class="page-head">${linesSvg()}<div class="wrap">
      <span class="eyebrow">${esc(eyebrow)}</span><h1>${titulo}</h1><p>${texto}</p></div></section>`;
  }

  // Linhas de "circuito" no estilo dos fundos do site
  function linesSvg() {
    return `<svg class="hero-lines" viewBox="0 0 1200 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d="M1200 34 H1090 L1056 0" stroke="rgba(255,255,255,.45)"/>
      <path d="M0 330 L28 368 V472 L56 500" stroke="rgba(255,255,255,.35)"/>
      <path d="M1112 70 L1140 96 V250 L1168 278 V500" stroke="#15b0ff" stroke-opacity=".6"/>
      <path d="M1140 160 H1186" stroke="#15b0ff" stroke-opacity=".6"/><circle cx="1186" cy="160" r="4"/>
      <path d="M1168 380 H1196" stroke="#15b0ff" stroke-opacity=".6"/>
      <path d="M1140 214 H1096" stroke="#15b0ff" stroke-opacity=".6"/><circle cx="1096" cy="214" r="4"/>
    </svg>`;
  }

  // ---------- Filtros reutilizáveis ----------
  function filterBar(params, opts) {
    const sel = (name, label, values, current) =>
      `<select name="${name}" aria-label="${label}"><option value="">${label}</option>${values
        .map((v) => `<option value="${esc(v.value ?? v)}"${(v.value ?? v) === current ? " selected" : ""}>${esc(v.label ?? v)}</option>`)
        .join("")}</select>`;
    const parts = [`<input type="search" name="q" placeholder="Filtrar por texto…" value="${esc(params.q || "")}" aria-label="Filtrar por texto">`];
    if (opts.tipo) parts.push(sel("tipo", "Só tarefas", [{ value: "todos", label: "Todos os tipos" }, ...Object.keys(TIPOS).filter((t) => t !== "Tarefas").map((t) => ({ value: t, label: TIPOS[t].plural }))], params.tipo || ""));
    if (opts.area) parts.push(sel("area", "Todas as áreas", Object.keys(AREAS), params.area || ""));
    if (opts.pessoa) parts.push(sel("pessoa", "Todas as pessoas", PESSOAS, params.pessoa || ""));
    if (opts.status) parts.push(sel("status", "Todos os status", STATUS, params.status || ""));
    if (opts.prazo) parts.push(sel("prazo", "Qualquer prazo", [{ value: "atrasados", label: "Atrasados" }, { value: "semana", label: "Próximos 7 dias" }, { value: "mes", label: "Próximos 30 dias" }, { value: "sem", label: "Sem prazo" }], params.prazo || ""));
    parts.push(`<button type="button" class="clear">Limpar</button><span class="result-count" aria-live="polite"></span>`);
    return `<form class="filters" onsubmit="return false">${parts.join("")}</form>`;
  }

  function applyFilters(list, f) {
    const q = norm(f.q);
    return list.filter((i) =>
      (!q || norm(i.titulo + " " + i.descricao + " " + i.projetos.join(" ")).includes(q)) &&
      (!f.area || i.areas.includes(f.area)) &&
      (!f.pessoa || i.pessoas.includes(f.pessoa)) &&
      (!f.status || i.status === f.status) &&
      (!f.prazo || matchPrazo(i, f.prazo)));
  }

  function matchPrazo(i, filtro) {
    const d = dueOf(i);
    if (filtro === "atrasados") return isLate(i);
    if (filtro === "semana") return !isDone(i) && d && diasAte(d) >= 0 && diasAte(startOf(i)) <= 7;
    if (filtro === "mes") return !isDone(i) && d && diasAte(d) >= 0 && diasAte(startOf(i)) <= 31;
    if (filtro === "sem") return !d;
    return true;
  }

  function wireFilters(name, params, onChange) {
    const form = view.querySelector(".filters");
    const read = () => Object.fromEntries([...new FormData(form).entries()].filter(([, v]) => v));
    const update = () => {
      const f = read();
      const qs = new URLSearchParams(f).toString();
      history.replaceState(null, "", `#${name}${qs ? "?" + qs : ""}`);
      state.lastView = state.rendered = location.hash;
      onChange(f);
    };
    form.addEventListener("input", update);
    form.querySelector(".clear").addEventListener("click", () => {
      form.reset();
      form.querySelectorAll("input,select").forEach((el) => (el.value = ""));
      update();
    });
    onChange(params);
  }

  // ---------- Views ----------
  const views = {};

  views.inicio = function () {
    const abertos = ITEMS.filter((i) => !isDone(i));
    const tarefasAbertas = abertos.filter((i) => i.tipo === "Tarefas");
    const atrasados = abertos.filter(isLate).sort(porPrazo);
    const proximos = abertos.filter((i) => dueOf(i) && !isLate(i)).sort(porPrazo).slice(0, 7);
    const prioridades = ITEMS.filter((i) => /Prioridade (Alta|da Semana|Média)/.test(i.prioridade) && !isDone(i))
      .sort((a, b) => ["Prioridade da Semana", "Prioridade Alta", "Prioridade Média"].indexOf(a.prioridade) - ["Prioridade da Semana", "Prioridade Alta", "Prioridade Média"].indexOf(b.prioridade));
    const conquistas = ITEMS.filter((i) => /⭐\s*Resultado/i.test(i.descricao));
    const count = (t) => ITEMS.filter((i) => i.tipo === t).length;

    const stats = [
      ["#projetos", PROJETOS.filter((p) => !isDone(p)).length, "projetos ativos"],
      ["#tarefas", tarefasAbertas.length, "tarefas abertas"],
      ["#atas", count("Ata"), "atas de reunião"],
      ["#contatos", count("Contato"), "contatos"],
      ["#tarefas?tipo=todos&prazo=atrasados", atrasados.length, "itens atrasados", atrasados.length ? "alert" : ""],
    ];

    const areaCards = Object.entries(AREAS).map(([a, cfg]) => {
      const its = ITEMS.filter((i) => i.areas.includes(a));
      const abertos = its.filter((i) => !isDone(i)).length;
      const stack = STATUS.map((s) => {
        const n = its.filter((i) => i.status === s).length;
        return n ? `<span style="flex:${n};background:${STATUS_COR[s]}" title="${esc(s)}: ${n}"></span>` : "";
      }).join("");
      return `<a class="area-card" href="#tarefas?area=${encodeURIComponent(a)}&tipo=todos" style="--c:${cfg.cor}">
        <span class="ico" aria-hidden="true">${cfg.icone}</span>
        <h3>${esc(a)}</h3>
        <span class="n">${its.length}</span> <span class="s">itens · ${abertos} em aberto</span>
        <div class="stack" aria-hidden="true">${stack}</div>
      </a>`;
    }).join("");

    const tools = (DATA.ferramentas || []).map((t) =>
      `<a class="tool" href="${esc(t.url)}" target="_blank" rel="noopener"><span aria-hidden="true">${esc(t.icone)}</span><span>${esc(t.nome)}<small>${esc(new URL(t.url).hostname.replace("www.", ""))}</small></span></a>`).join("");

    view.innerHTML = `
      <section class="hero">${linesSvg()}
        <div class="wrap hero-inner">
          <img class="hero-logo" src="assets/logo.png" alt="Logo InclusiVR">
          <div>
            <span class="eyebrow">Workspace ${esc(DATA.workspace)} no Notion</span>
            <h1>Tudo da Inclusi<span>VR</span> em um só lugar.</h1>
            <p class="lead">Projetos, tarefas, atas, contatos e documentos do Notion, organizados para consulta rápida.</p>
            <div class="hero-actions">
              <a class="btn btn-blue" href="#projetos">Ver projetos</a>
              <a class="btn btn-purple" href="#tarefas">Quadro de tarefas</a>
            </div>
            <div class="stats">${stats.map(([h, n, l, c]) => `<a class="stat ${c || ""}" href="${h}"><strong>${n}</strong><span>${l}</span></a>`).join("")}</div>
          </div>
        </div>
      </section>

      <div class="wrap">
        <section class="section grid grid-2">
          <div class="panel">
            <h3>⏰ Próximos prazos <span class="count">${proximos.length}</span></h3>
            <div class="list">${proximos.map(listItem).join("") || `<p class="empty">Nada com prazo pela frente.</p>`}</div>
          </div>
          <div class="panel">
            <h3>🚨 Atrasados <span class="count">${atrasados.length}</span></h3>
            <div class="list">${atrasados.map(listItem).join("") || `<p class="empty">Nenhum item atrasado. 🎉</p>`}</div>
            <h3 style="margin-top:22px">🔥 Prioridades <span class="count">${prioridades.length}</span></h3>
            <div class="list">${prioridades.map(listItem).join("") || `<p class="empty">Sem prioridades marcadas.</p>`}</div>
          </div>
        </section>

        <section class="section">
          <div class="section-title"><h2>Áreas</h2><a href="#tarefas?tipo=todos">Ver tudo no quadro →</a></div>
          <div class="grid grid-cards" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">${areaCards}</div>
        </section>

        <section class="section grid grid-2" style="align-items:start">
          <div class="panel wins">
            <h3>⭐ Conquistas</h3>
            ${conquistas.map((i) => `<a class="win" href="#item/${i.id}"><span class="star" aria-hidden="true">⭐</span><span><b>${esc(i.titulo)}</b><span>${esc(i.descricao.replace(/⭐\s*Resultado:\s*/i, "").split("\n")[0])}</span></span></a>`).join("") || `<p>Nenhum resultado registrado ainda.</p>`}
          </div>
          <div class="panel">
            <h3>👥 Equipe</h3>
            <div class="list">${PESSOAS.map((p) => {
              const its = ITEMS.filter((i) => i.pessoas.includes(p));
              const ab = its.filter((i) => !isDone(i)).length;
              return `<a class="list-item" href="#equipe" style="grid-template-columns:44px 1fr auto">${avatar(p)}<span><span class="t">${esc(p)}</span><span class="s">${plural(its.length, "item atribuído", "itens atribuídos")}</span></span><span class="count">${ab} em aberto</span></a>`;
            }).join("")}</div>
            ${tools ? `<h3 style="margin-top:22px">🔧 Ferramentas</h3><div class="tools">${tools}</div>` : ""}
          </div>
        </section>
      </div>`;
  };

  views.projetos = function (params) {
    view.innerHTML = pageHead("💡 Projetos", "Projetos", "Cada projeto com seu status, prioridade, áreas envolvidas e o andamento dos itens ligados a ele.") +
      `<div class="wrap">${filterBar(params, { area: true, pessoa: true, status: true })}
        <section class="section"><div class="grid grid-cards" id="list"></div></section></div>`;
    const ordem = (p) => (p.prioridade === "Prioridade da Semana" ? 0 : p.prioridade === "Prioridade Alta" ? 1 : 2) * 10 + STATUS.indexOf(p.status) + (p.prioridade === "Congelado" ? 50 : 0);
    wireFilters("projetos", params, (f) => {
      const list = applyFilters(PROJETOS, f).sort((a, b) => ordem(a) - ordem(b) || porPrazo(a, b));
      view.querySelector("#list").innerHTML = list.map(projectCard).join("") || `<p class="empty">Nenhum projeto com esses filtros.</p>`;
      view.querySelector(".result-count").textContent = plural(list.length, "projeto", "projetos");
    });
  };

  views.tarefas = function (params) {
    view.innerHTML = pageHead("📋 Organização de tarefas", "Quadro de tarefas", "Quadro por status no estilo kanban. Use os filtros para ver por pessoa, área ou incluir outros tipos de item.") +
      `<div class="wrap">${filterBar(params, { tipo: true, area: true, pessoa: true, prazo: true })}
        <section class="section"><div class="board" id="board"></div></section></div>`;
    wireFilters("tarefas", params, (f) => {
      let base = ITEMS;
      if (!f.tipo) base = ITEMS.filter((i) => i.tipo === "Tarefas");
      else if (f.tipo !== "todos") base = ITEMS.filter((i) => i.tipo === f.tipo);
      const list = applyFilters(base, f);
      view.querySelector("#board").innerHTML = STATUS.map((s) => {
        const col = list.filter((i) => i.status === s).sort(porPrazo);
        return `<div class="column"><div class="column-head">${statusPill(s)}<span class="count">${col.length}</span></div>
          <div class="cards">${col.map(miniCard).join("") || `<p class="empty">—</p>`}</div></div>`;
      }).join("");
      view.querySelector(".result-count").textContent = plural(list.length, "item", "itens");
    });
  };

  views.atas = function (params) {
    const atas = ITEMS.filter((i) => i.tipo === "Ata");
    view.innerHTML = pageHead("📝 Atas", "Atas de reunião", "Linha do tempo das reuniões registradas, da mais recente para a mais antiga.") +
      `<div class="wrap">${filterBar(params, { area: true })}<section class="section"><div class="timeline" id="list"></div></section></div>`;
    wireFilters("atas", params, (f) => {
      const list = applyFilters(atas, f).sort((a, b) => (startOf(b) || 0) - (startOf(a) || 0));
      let mes = null;
      view.querySelector("#list").innerHTML = list.map((i) => {
        const d = startOf(i);
        const m = d ? `${MESES_LONGOS[d.getMonth()]} ${d.getFullYear()}` : "Sem data";
        const head = m !== mes ? `<div class="tl-month">${esc(m)}</div>` : "";
        mes = m;
        return `${head}<div class="tl-item"><a class="card tl-card" href="#item/${i.id}" style="${bandFor(i)}">
          ${dateBox(i)}
          <div class="body"><h3>${esc(i.titulo)}</h3>${i.descricao ? `<p class="desc">${esc(i.descricao)}</p>` : ""}
          ${i.projetos.length ? `<div class="chips">${i.projetos.map((p) => `<span class="chip">💡 ${esc(p)}</span>`).join("")}</div>` : ""}
          ${areaChips(i)}</div></a></div>`;
      }).join("") || `<p class="empty">Nenhuma ata com esses filtros.</p>`;
      view.querySelector(".result-count").textContent = plural(list.length, "ata", "atas");
    });
  };

  views.contatos = function (params) {
    const contatos = ITEMS.filter((i) => i.tipo === "Contato");
    view.innerHTML = pageHead("📞 Contatos", "Contatos e relacionamentos", "Pessoas e organizações acompanhadas pela equipe, com responsável e situação do relacionamento.") +
      `<div class="wrap">${filterBar(params, { area: true, pessoa: true, status: true })}<section class="section"><div class="grid grid-cards" id="list"></div></section></div>`;
    wireFilters("contatos", params, (f) => {
      const list = applyFilters(contatos, f).sort((a, b) => a.titulo.localeCompare(b.titulo, "pt"));
      view.querySelector("#list").innerHTML = list.map(contactCard).join("") || `<p class="empty">Nenhum contato com esses filtros.</p>`;
      view.querySelector(".result-count").textContent = plural(list.length, "contato", "contatos");
    });
  };

  views.documentos = function (params) {
    const grupos = ["Evento", "Cronograma", "Documento"];
    view.innerHTML = pageHead("📂 Documentos", "Documentos, eventos e cronogramas", "Materiais de apoio, listas de referência, eventos no calendário e cronogramas da equipe.") +
      `<div class="wrap">${filterBar(params, { area: true })}<div id="list"></div></div>`;
    wireFilters("documentos", params, (f) => {
      let total = 0;
      view.querySelector("#list").innerHTML = grupos.map((g) => {
        const list = applyFilters(ITEMS.filter((i) => i.tipo === g), f).sort(porPrazo);
        total += list.length;
        if (!list.length) return "";
        return `<section class="section"><div class="section-title"><h2>${TIPOS[g].icone} ${TIPOS[g].plural}</h2><span class="count">${list.length}</span></div>
          <div class="grid grid-cards">${list.map(genericCard).join("")}</div></section>`;
      }).join("") || `<p class="empty section">Nada encontrado com esses filtros.</p>`;
      view.querySelector(".result-count").textContent = plural(total, "item", "itens");
    });
  };

  views.equipe = function () {
    const cards = PESSOAS.map((p) => {
      const its = ITEMS.filter((i) => i.pessoas.includes(p));
      const abertos = its.filter((i) => !isDone(i)).sort(porPrazo);
      const late = abertos.filter(isLate).length;
      const stack = STATUS.map((s) => {
        const n = its.filter((i) => i.status === s).length;
        return n ? `<span style="flex:${n};background:${STATUS_COR[s]}" title="${esc(s)}: ${n}"></span>` : "";
      }).join("");
      return `<article class="card member">
        <div class="member-head"><span class="avatar lg" style="--c:${pessoaCor(p)}">${esc(iniciais(p))}</span>
          <div><h3>${esc(p)}</h3><span class="meta">${plural(its.length, "item atribuído", "itens atribuídos")}</span></div></div>
        <div class="member-nums">
          <div><b>${abertos.length}</b><span>em aberto</span></div>
          <div class="${late ? "late" : ""}"><b>${late}</b><span>atrasados</span></div>
          <div><b>${its.length - abertos.length}</b><span>concluídos</span></div>
        </div>
        <div class="stack" aria-hidden="true">${stack}</div>
        <ul>${abertos.slice(0, 6).map((i) => `<li><a href="#item/${i.id}"><span>${TIPOS[i.tipo]?.icone || ""} ${esc(i.titulo)}</span>${dueBadge(i)}</a></li>`).join("")}</ul>
        <a class="btn btn-ghost" href="#tarefas?pessoa=${encodeURIComponent(p)}&tipo=todos" style="justify-content:center">Ver no quadro</a>
      </article>`;
    }).join("");
    const legenda = STATUS.map((s) => `<span class="chip"><span class="dot" style="--c:${STATUS_COR[s]}"></span>${esc(s)}</span>`).join("");
    const todos = ITEMS.filter((i) => i.pessoas.includes("Todos")).length;
    view.innerHTML = pageHead("👥 Membros", "Equipe", `Quem está com o quê. Além dos itens individuais, ${todos} itens estão atribuídos a “Todos”.`) +
      `<div class="wrap"><section class="section"><div class="chips" style="margin-bottom:16px">${legenda}</div>
        <div class="grid grid-cards">${cards}</div></section></div>`;
  };

  // ---------- Painel de detalhes ----------
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("overlay");
  const drawerBody = document.getElementById("drawer-body");
  let lastFocus = null;

  function openItem(id) {
    const i = BY_ID.get(id);
    if (!i) return closeDrawer();
    const tipo = TIPOS[i.tipo] || { icone: "•", nome: i.tipo };
    const props = [];
    if (i.status) props.push(["Status", statusPill(i.status)]);
    if (i.prioridade) props.push(["Prioridade", prioPill(i.prioridade)]);
    if (i.prazo) props.push(["Prazo", `<span>${esc(fmtData(i))}</span>${isDone(i) ? "" : dueBadge(i)}`]);
    if (i.pessoas.length) props.push(["Atribuição", i.pessoas.map((p) => (p === "Todos" ? `<span class="chip">👥 Todos</span>` : `<span class="chip">${avatar(p, "xs")} ${esc(p)}</span>`)).join("")]);
    if (i.areas.length) props.push(["Área", i.areas.map((a) => areaChip(a, true)).join("")]);
    if (i.projetos.length && i.tipo !== "Projetos") props.push(["Projeto", i.projetos.map(projetoChip).join("")]);

    let relHtml = "";
    if (i.tipo === "Projetos") {
      const rel = relacionados(i).sort((a, b) => (isDone(a) - isDone(b)) || porPrazo(a, b));
      if (rel.length) {
        relHtml = `<section class="drawer-section"><h3>🔗 Itens deste projeto <span class="count">${rel.length}</span></h3><div class="related">${rel.map((r) =>
          `<a href="#item/${r.id}"><span class="l"><span aria-hidden="true">${TIPOS[r.tipo]?.icone || "•"}</span><span>${esc(r.titulo)}</span></span>${dueBadge(r) || statusPill(r.status)}</a>`).join("")}</div></section>`;
      }
    }

    drawerBody.innerHTML = `
      <header class="drawer-head">
        <div class="top"><span class="kind">${tipo.icone} ${esc(tipo.nome)}</span>
          <button class="close-btn" type="button" aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
        <h2 id="drawer-title">${esc(i.titulo)}</h2>
        ${i.descricao ? `<p>${esc(i.descricao)}</p>` : ""}
      </header>
      ${props.length ? `<dl class="props">${props.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>` : ""}
      ${relHtml}
      <section class="drawer-section"><div class="md">${i.corpo ? window.renderMarkdown(i.corpo) : `<p class="empty">Esta página não tem conteúdo além das propriedades.</p>`}</div></section>`;

    if (drawer.hidden) lastFocus = document.activeElement;
    drawer.hidden = false;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    drawerBody.scrollTop = 0;
    drawerBody.querySelector(".close-btn").addEventListener("click", closeDrawer);
    drawerBody.querySelector(".close-btn").focus();
    document.title = `${i.titulo} · Central InclusiVR`;
  }

  function closeDrawer() {
    if (location.hash.startsWith("#item/")) {
      location.hash = state.lastView || "#inicio";
      return;
    }
    hideDrawer();
  }
  function hideDrawer() {
    if (drawer.hidden) return;
    drawer.hidden = true;
    overlay.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  overlay.addEventListener("click", closeDrawer);
  drawer.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const f = [...drawer.querySelectorAll("a[href],button")];
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  // ---------- Busca global ----------
  const search = document.getElementById("search");
  const results = document.getElementById("search-results");
  const INDEX = ITEMS.map((i) => ({ i, t: norm(i.titulo), d: norm(i.descricao + " " + i.projetos.join(" ") + " " + i.pessoas.join(" ")), c: norm(i.corpo) }));
  let active = 0;

  function highlight(text, q) {
    const n = norm(text), k = n.indexOf(q);
    if (!q || k < 0) return esc(text);
    return esc(text.slice(0, k)) + "<mark>" + esc(text.slice(k, k + q.length)) + "</mark>" + esc(text.slice(k + q.length));
  }
  function snippet(i, q) {
    const n = norm(i.corpo), k = n.indexOf(q);
    if (k < 0) return esc(i.descricao || TIPOS[i.tipo]?.nome || "");
    const a = Math.max(0, k - 40);
    const raw = i.corpo.slice(a, k + q.length + 60).replace(/[#*\[\]()|>-]+/g, " ").replace(/\s+/g, " ");
    return (a ? "…" : "") + highlight(raw, q) + "…";
  }
  function runSearch() {
    const q = norm(search.value);
    if (!q) { results.hidden = true; search.setAttribute("aria-expanded", "false"); return; }
    const hits = INDEX.map((x) => ({ ...x, s: (x.t.includes(q) ? 3 : 0) + (x.d.includes(q) ? 2 : 0) + (x.c.includes(q) ? 1 : 0) }))
      .filter((x) => x.s).sort((a, b) => b.s - a.s || a.i.titulo.localeCompare(b.i.titulo, "pt")).slice(0, 8);
    active = 0;
    results.innerHTML = hits.length
      ? hits.map((x, k) => `<a href="#item/${x.i.id}" role="option" class="${k === 0 ? "active" : ""}"><span class="sr-icon" aria-hidden="true">${TIPOS[x.i.tipo]?.icone || "•"}</span><span><span class="sr-title">${highlight(x.i.titulo, q)}</span><span class="sr-sub">${x.s >= 3 ? esc(TIPOS[x.i.tipo]?.nome || "") + (x.i.descricao ? " · " + esc(x.i.descricao.slice(0, 80)) : "") : snippet(x.i, q)}</span></span></a>`).join("")
      : `<div class="search-empty">Nada encontrado para “${esc(search.value)}”.</div>`;
    results.hidden = false;
    search.setAttribute("aria-expanded", "true");
  }
  search.addEventListener("input", runSearch);
  search.addEventListener("focus", () => search.value && runSearch());
  search.addEventListener("keydown", (e) => {
    const links = [...results.querySelectorAll("a")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!links.length) return;
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
      links.forEach((l, k) => l.classList.toggle("active", k === active));
    } else if (e.key === "Enter" && links[active]) {
      location.hash = links[active].getAttribute("href");
      results.hidden = true;
      search.blur();
    } else if (e.key === "Escape") {
      search.value = "";
      results.hidden = true;
      search.blur();
    }
  });
  results.addEventListener("click", () => { results.hidden = true; });
  document.addEventListener("click", (e) => { if (!e.target.closest(".search")) results.hidden = true; });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/input|select|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); search.focus(); }
    if (e.key === "Escape" && !drawer.hidden) closeDrawer();
  });

  // ---------- Menu mobile ----------
  const nav = document.getElementById("nav");
  const menuBtn = document.getElementById("menu-btn");
  menuBtn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); } });

  // ---------- Roteamento por hash ----------
  const state = { lastView: "#inicio", rendered: null };

  function route() {
    const hash = location.hash || "#inicio";
    if (hash.startsWith("#item/")) {
      if (!state.rendered) renderView("#inicio");
      openItem(decodeURIComponent(hash.slice(6)));
      return;
    }
    hideDrawer();
    renderView(hash);
  }

  function renderView(hash) {
    const [name, qs] = hash.slice(1).split("?");
    const key = views[name] ? name : "inicio";
    const params = Object.fromEntries(new URLSearchParams(qs || ""));
    if (state.rendered !== hash) {
      views[key](params);
      state.rendered = hash;
      window.scrollTo(0, 0);
    }
    state.lastView = hash;
    nav.querySelectorAll("a").forEach((a) => (a.dataset.view === key ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    const titulo = nav.querySelector(`a[data-view="${key}"]`)?.textContent.trim();
    document.title = key === "inicio" ? "Central InclusiVR" : `${titulo} · Central InclusiVR`;
  }

  window.addEventListener("hashchange", route);

  // rodapé
  if (DATA.exportadoEm) {
    const d = toDate(DATA.exportadoEm);
    document.getElementById("footer-meta").textContent =
      `Dados exportados do Notion em ${d.getDate()} de ${MESES_LONGOS[d.getMonth()]} de ${d.getFullYear()} · ${ITEMS.length} itens`;
  }

  route();
})();
