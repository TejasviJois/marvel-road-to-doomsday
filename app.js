const STORAGE_KEY = "marvel-watchlist-v1";

const state = {
  watched: {},
  custom: [],
  customEras: [],
  filter: "all",
  query: "",
  pendingPoster: "",
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.watched = raw.watched || {};
    state.custom = raw.custom || [];
    state.customEras = raw.customEras || [];
  } catch {
    state.watched = {};
    state.custom = [];
    state.customEras = [];
  }
}

function save() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      watched: state.watched,
      custom: state.custom,
      customEras: state.customEras,
    })
  );
}

function eras() {
  const dest = ERAS.filter((era) => era.id === "destination");
  const rest = ERAS.filter((era) => era.id !== "destination");
  return rest.concat(state.customEras).concat(dest);
}

function catalog() {
  return CATALOG.concat(state.custom);
}

function uniqueKeys(list) {
  return [...new Set(list.map((item) => item.watchKey))];
}

function isWatched(item) {
  return Boolean(state.watched[item.watchKey]);
}

function toggleWatched(watchKey) {
  state.watched[watchKey] = !state.watched[watchKey];
  if (!state.watched[watchKey]) delete state.watched[watchKey];
  save();
  render();
}

function daysUntilDoomsday() {
  const now = new Date();
  const ms = DOOMSDAY.getTime() - now.getTime();
  if (ms <= 0) return { done: true, text: "It's here." };
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return { done: false, text: days + "d " + hours + "h", days };
}

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function matchesFilter(item) {
  const done = isWatched(item);
  if (state.filter === "left" && done) return false;
  if (state.filter === "done" && !done) return false;
  if (state.query) {
    const q = state.query.toLowerCase();
    const hay = [item.title, item.year, item.note, item.rec, item.type].join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function renderCountdown() {
  const el = document.getElementById("countdown-value");
  const info = daysUntilDoomsday();
  el.textContent = info.text;
}

function renderProgress() {
  const items = catalog();
  const keys = uniqueKeys(items);
  const done = keys.filter((key) => state.watched[key]).length;
  const total = keys.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById("progress-label").textContent = done + " / " + total;
  document.getElementById("progress-pct").textContent = pct + "% of the universe";
  document.getElementById("progress-fill").style.width = pct + "%";
  document.getElementById("progress-bar").setAttribute("aria-valuenow", String(pct));
}

function renderNextUp() {
  const box = document.getElementById("next-up");
  const next = catalog().find((item) => !isWatched(item) && !item.rewatch);
  if (!next) {
    box.hidden = false;
    box.innerHTML =
      '<div></div><div><p class="next-kicker">Status</p><h2>The list is clear.</h2><p>Everything on the road to Doomsday is marked watched. Add the next title when it drops.</p></div>';
    return;
  }
  const era = eras().find((e) => e.id === next.era);
  box.hidden = false;
  box.innerHTML =
    '<img src="' +
    escapeAttr(next.poster) +
    '" alt="" decoding="async" />' +
    '<div><p class="next-kicker">Next up</p><h2>' +
    escapeHtml(next.title) +
    "</h2><p>" +
    escapeHtml((era && era.name) || "") +
    " · " +
    (next.year || "") +
    " · " +
    (next.type === "series" ? "Series" : "Movie") +
    "</p></div>" +
    '<button class="btn-add" type="button" data-watch="' +
    escapeAttr(next.watchKey) +
    '">Mark watched</button>';
}

function renderRail() {
  const rail = document.getElementById("era-rail");
  const items = catalog();
  rail.innerHTML = eras()
    .map((era) => {
      const inEra = items.filter((item) => item.era === era.id);
      const keys = uniqueKeys(inEra);
      const done = keys.filter((key) => state.watched[key]).length;
      const pct = keys.length ? Math.round((done / keys.length) * 100) : 0;
      return (
        '<a class="era-pill" href="#era-' +
        era.id +
        '" style="--era:' +
        era.color +
        '"><strong>' +
        escapeHtml(era.name) +
        "</strong><span>" +
        done +
        " / " +
        keys.length +
        "</span><div class='mini'><i style='width:" +
        pct +
        "%'></i></div></a>"
      );
    })
    .join("");
}

function renderTimeline() {
  const root = document.getElementById("timeline");
  const items = catalog();
  root.innerHTML = eras()
    .map((era) => {
      const inEra = items.filter((item) => item.era === era.id);
      const visible = inEra.filter(matchesFilter);
      const keys = uniqueKeys(inEra);
      const done = keys.filter((key) => state.watched[key]).length;
      if (!visible.length && state.query) return "";
      return (
        '<section class="era" id="era-' +
        era.id +
        '" style="--era:' +
        era.color +
        '">' +
        '<div class="era-head"><div><p class="eyebrow">' +
        escapeHtml(era.tag) +
        "</p><h2>" +
        escapeHtml(era.name) +
        "</h2><p>" +
        escapeHtml(era.blurb) +
        '</p></div><div class="era-count">' +
        done +
        " / " +
        keys.length +
        " watched</div></div>" +
        '<div class="grid">' +
        visible.map(cardHtml).join("") +
        "</div></section>"
      );
    })
    .join("");
}

function cardHtml(item) {
  const done = isWatched(item);
  const dest = item.destination ? " is-destination" : "";
  const cls = "card" + (done ? " is-done" : "") + dest;
  const rec = item.rec ? '<span class="badge">' + escapeHtml(item.rec) + "</span>" : "";
  const note = item.note ? '<span class="note">' + escapeHtml(item.note) + "</span>" : "";
  const del = item.custom
    ? '<button class="del" type="button" data-del="' + escapeAttr(item.id) + '" aria-label="Remove">×</button>'
    : "";
  const extra = item.destination
    ? "<p class='note'>Theatrical release · December 18, 2026. The last stop on this list.</p>"
    : "";
  return (
    '<article class="' +
    cls +
    '" data-watch="' +
    escapeAttr(item.watchKey) +
    '">' +
    del +
    '<div class="poster-wrap"><img src="' +
    escapeAttr(item.poster) +
    '" alt="' +
    escapeAttr(item.title) +
    ' poster" loading="lazy" decoding="async" /><div class="check">' +
    (done ? "✓" : "") +
    '</div><div class="stamp">WATCHED</div></div>' +
    '<div class="meta"><h3>' +
    escapeHtml(item.title) +
    (item.rewatch ? " <span class='badge'>Rewatch</span>" : "") +
    '</h3><p class="sub">' +
    (item.year || "—") +
    " · " +
    (item.type === "series" ? "Series" : "Movie") +
    "</p>" +
    rec +
    note +
    extra +
    "</div></article>"
  );
}

function fillEraSelect() {
  const select = document.getElementById("era-select");
  const options = eras()
    .map((era) => '<option value="' + escapeAttr(era.id) + '">' + escapeHtml(era.name) + "</option>")
    .concat('<option value="__new">+ New era…</option>');
  select.innerHTML = options.join("");
}

function render() {
  renderCountdown();
  renderProgress();
  renderNextUp();
  renderRail();
  renderTimeline();
  fillEraSelect();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function bind() {
  document.addEventListener("click", (event) => {
    const del = event.target.closest("[data-del]");
    if (del) {
      event.stopPropagation();
      state.custom = state.custom.filter((item) => item.id !== del.dataset.del);
      save();
      render();
      return;
    }
    const watch = event.target.closest("[data-watch]");
    if (watch) toggleWatched(watch.dataset.watch);
  });

  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filter = btn.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((el) => el.classList.toggle("is-on", el === btn));
      renderTimeline();
    });
  });

  document.getElementById("search").addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    renderTimeline();
  });

  const modal = document.getElementById("add-modal");
  document.getElementById("open-add").addEventListener("click", () => {
    document.getElementById("add-form").reset();
    state.pendingPoster = "";
    document.getElementById("poster-preview").hidden = true;
    document.getElementById("form-status").hidden = true;
    document.getElementById("new-era-wrap").hidden = true;
    modal.showModal();
  });
  document.getElementById("cancel-add").addEventListener("click", () => modal.close());
  document.getElementById("era-select").addEventListener("change", (event) => {
    document.getElementById("new-era-wrap").hidden = event.target.value !== "__new";
  });

  document.getElementById("find-poster").addEventListener("click", findPoster);
  document.getElementById("poster-file").addEventListener("change", onPosterFile);
  document.getElementById("poster-url").addEventListener("input", (event) => {
    if (event.target.value) showPreview(event.target.value);
  });

  document.getElementById("add-form").addEventListener("submit", onAdd);

  document.getElementById("reset-progress").addEventListener("click", () => {
    if (!confirm("Clear every watched check? Custom titles stay on the list.")) return;
    state.watched = {};
    save();
    render();
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.close();
  });

  const hud = document.querySelector(".hud");
  let compact = false;
  window.addEventListener(
    "scroll",
    () => {
      const shouldCompact = window.scrollY > 80;
      if (shouldCompact !== compact) {
        compact = shouldCompact;
        hud.classList.toggle("is-compact", compact);
      }
    },
    { passive: true }
  );
}

function showPreview(src) {
  state.pendingPoster = src;
  const wrap = document.getElementById("poster-preview");
  document.getElementById("poster-preview-img").src = src;
  wrap.hidden = !src;
}

async function findPoster() {
  const title = document.querySelector('[name="title"]').value.trim();
  const year = document.querySelector('[name="year"]').value.trim();
  const status = document.getElementById("form-status");
  if (!title) {
    status.hidden = false;
    status.textContent = "Type a title first, then search.";
    return;
  }
  status.hidden = false;
  status.textContent = "Looking for a poster…";
  const q = title + (year ? " " + year : "");
  try {
    const search = await fetch(
      "https://en.wikipedia.org/w/api.php?action=opensearch&limit=1&namespace=0&format=json&origin=*&search=" +
        encodeURIComponent(q)
    );
    if (search.ok) {
      const result = await search.json();
      const page = result[1] && result[1][0];
      if (page) {
        const wiki = await fetch(
          "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(page)
        );
        if (wiki.ok) {
          const data = await wiki.json();
          const src =
            (data.originalimage && data.originalimage.source) ||
            (data.thumbnail && data.thumbnail.source);
          if (src) {
            document.getElementById("poster-url").value = src;
            showPreview(src);
            status.textContent = "Poster found.";
            return;
          }
        }
      }
    }
    const tv = await fetch("https://api.tvmaze.com/singlesearch/shows?q=" + encodeURIComponent(title));
    if (tv.ok) {
      const show = await tv.json();
      const src = show.image && (show.image.original || show.image.medium);
      if (src) {
        document.getElementById("poster-url").value = src;
        showPreview(src);
        status.textContent = "Series poster found.";
        return;
      }
    }
    status.textContent = "No poster found. Paste a URL or upload one.";
  } catch {
    status.textContent = "Search needs a browser with network access. Paste a poster URL or upload a file.";
  }
}

function onPosterFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => compressImage(reader.result).then((dataUrl) => {
    document.getElementById("poster-url").value = "";
    showPreview(dataUrl);
    const status = document.getElementById("form-status");
    status.hidden = false;
    status.textContent = "Poster attached.";
  });
  reader.readAsDataURL(file);
}

function compressImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const max = 400;
      const scale = Math.min(1, max / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function field(form, name) {
  return form.elements[name];
}

function onAdd(event) {
  event.preventDefault();
  const form = event.target;
  const title = field(form, "title").value.trim();
  if (!title) return;

  let eraId = field(form, "era").value;
  if (eraId === "__new") {
    const name = field(form, "newEra").value.trim();
    if (!name) {
      document.getElementById("form-status").hidden = false;
      document.getElementById("form-status").textContent = "Name the new era.";
      return;
    }
    eraId = slug(name) || "era-" + Date.now();
    if (!eras().some((era) => era.id === eraId)) {
      state.customEras.push({
        id: eraId,
        name,
        tag: "Custom era",
        color: "#e8c547",
        blurb: "Added by you.",
      });
    }
  }

  const id = slug(title) + "-" + Date.now();
  const poster = state.pendingPoster || field(form, "posterUrl").value.trim() || "";
  state.custom.push({
    id,
    watchKey: id,
    title,
    year: field(form, "year").value ? Number(field(form, "year").value) : "",
    type: field(form, "type").value,
    era: eraId,
    poster: poster || placeholderPoster(title),
    note: field(form, "note").value.trim(),
    custom: true,
  });
  save();
  document.getElementById("add-modal").close();
  render();
  const node = document.getElementById("era-" + eraId);
  if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
}

function placeholderPoster(title) {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 600'><rect fill='%2314141c' width='400' height='600'/><rect fill='%23e62429' y='250' width='400' height='90'/><text x='200' y='305' text-anchor='middle' fill='white' font-size='28' font-family='Arial'>" +
    escapeHtml(title).slice(0, 22) +
    "</text></svg>";
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function jumpToHash() {
  if (!location.hash) return;
  try {
    const target = document.querySelector(location.hash);
    if (target) target.scrollIntoView({ behavior: "instant", block: "start" });
  } catch {
    /* malformed hash */
  }
}

load();
bind();
render();
jumpToHash();
setInterval(renderCountdown, 60000);
