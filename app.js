"use strict";
/* نطبخ إيه؟ — منطق التطبيق (يعتمد على RECIPES من data.js) */

const KEY = "notbokhEh_state_v2";
const OLD_KEY = "notbokhEh_state_v1";
const CATS = ["اقتصادية", "فراخ", "لحوم", "خضار", "سمك", "سريعة", "بقوليات"];
const CAT_EMOJI = { "بقوليات": "🫘", "سريعة": "🍳", "لحوم": "🥩", "فراخ": "🍗", "خضار": "🥗", "سمك": "🐟", "اقتصادية": "🍲" };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- أدوات ---------- */
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toAr = v => String(v).replace(/[0-9]/g, d => AR_DIGITS[d]);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = s => String(s).toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").trim();
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const emojiOf = r => CAT_EMOJI[r.category] || "🍲";
const getRecipe = id => RECIPES.find(r => r.id === Number(id));
const inCat = (r, c) => c === "all" || r.category === c || r.tags.includes(c);

function monthKeyOf(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function daysIn(key) { const [y, m] = key.split("-").map(Number); return new Date(y, m, 0).getDate(); }
function dateOf(i) { const [y, m] = state.monthKey.split("-").map(Number); return new Date(y, m - 1, 1 + i); }
const fmtDay = (d, o) => new Intl.DateTimeFormat("ar-EG", o).format(d);
const dayName = d => fmtDay(d, { weekday: "long" });
const monthName = () => fmtDay(dateOf(0), { month: "long", year: "numeric" });
function todayIdx() {
  if (state.monthKey !== monthKeyOf()) return 0;
  return clamp(new Date().getDate() - 1, 0, state.plan.length - 1);
}
const isCurrentMonth = () => state.monthKey === monthKeyOf();

/* ---------- الحالة ---------- */
function shuffled(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function makePlan(n, cat = "all") {
  const pick = shuffled(RECIPES.filter(r => inCat(r, cat))).map(r => r.id);
  const rest = shuffled(RECIPES.filter(r => !pick.includes(r.id))).map(r => r.id);
  return [...pick, ...rest].slice(0, n); // لو النوع المفضل أقل من أيام الشهر نكمل من باقي الأكلات
}
function fixPlan(plan, n) {
  const seen = new Set(), out = [];
  (plan || []).forEach(id => { if (getRecipe(id) && !seen.has(id)) { seen.add(id); out.push(id); } });
  const extra = shuffled(RECIPES.map(r => r.id).filter(id => !seen.has(id)));
  while (out.length < n) out.push(extra.pop());
  return out.slice(0, n);
}
function freshState() {
  const k = monthKeyOf();
  return { v: 2, monthKey: k, plan: makePlan(daysIn(k)), done: {}, checked: {}, favs: [], servings: 4, pref: "all", theme: null };
}
function loadState() {
  try {
    let s = JSON.parse(localStorage.getItem(KEY));
    if (!s) { // ترحيل من النسخة الأولى
      const o = JSON.parse(localStorage.getItem(OLD_KEY));
      if (o && Array.isArray(o.plan)) s = { ...freshState(), monthKey: o.monthKey || monthKeyOf(), plan: o.plan, servings: o.servings, checked: o.checked || {} };
    }
    if (s && Array.isArray(s.plan)) {
      const base = freshState();
      s = { ...base, ...s };
      s.servings = clamp(Number(s.servings) || 4, 1, 12);
      s.plan = fixPlan(s.plan, daysIn(s.monthKey));
      s.done = s.done && typeof s.done === "object" ? s.done : {};
      s.checked = s.checked && typeof s.checked === "object" ? s.checked : {};
      s.favs = Array.isArray(s.favs) ? s.favs.filter(getRecipe) : [];
      return s;
    }
  } catch (e) { /* تجاهل: بيانات تالفة أو التخزين غير متاح */ }
  return freshState();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* وضع التصفح الخاص */ } }
let state = loadState();

function rollMonth() {
  const k = monthKeyOf();
  if (state.monthKey !== k) {
    state.monthKey = k; state.plan = makePlan(daysIn(k), state.pref); state.done = {}; state.checked = {};
    save(); setTimeout(() => toast("بدأ شهر جديد بخطة جديدة 🎉"), 600);
  }
}

/* ---------- المقادير والمشتريات ---------- */
function parseQty(s) {
  s = String(s);
  const f = { "½": .5, "¼": .25, "¾": .75 };
  for (const k in f) if (s.includes(k)) return (Number(s.replace(k, "")) || 0) + f[k];
  return Number(s) || 0;
}
function prettyNum(n) {
  if (Math.abs(n - Math.round(n)) < .001) return toAr(Math.round(n));
  const w = Math.floor(n), fr = n - w;
  const fs = [[.25, "¼"], [.333, "⅓"], [.5, "½"], [.667, "⅔"], [.75, "¾"]];
  const best = fs.reduce((a, b) => Math.abs(b[0] - fr) < Math.abs(a[0] - fr) ? b : a);
  if (Math.abs(best[0] - fr) < .05) return (w ? toAr(w) + " " : "") + best[1];
  return toAr(Math.round(n * 10) / 10);
}
const scaled = ing => parseQty(ing.qty) * state.servings / 4;
const COUNTABLE = new Set(["حبة", "فص", "ورقة", "رغيف", "رأس", "علبة", "سمكة", "ربطة"]);

const GROUPS = [
  { id: "veg", name: "خضار وفاكهة", emoji: "🥬", re: /طماطم|بصل|ثوم|فلفل|باذنجان|بطاطس|بطاطا|بامية|فاصوليا خضراء|بسلة|جزر|كرنب|كوسة|قرنبيط|خيار|خس|سبانخ|قلقاس|سلق|ملوخية|ليمون|مشروم|ذرة|بقدونس|شبت|نعناع|كزبرة خضراء|ورق عنب|زبيب/, not: /صلصة|أسود|بودرة|مخلل/ },
  { id: "meat", name: "لحوم وأسماك", emoji: "🥩", re: /لحم|كبدة|دجاج|صدور|حمام|سجق|سمك|جمبري|تونة|أرنب|منديل|موزة|كوارع|عكاوي|فيليه|بسطرمة/ },
  { id: "dairy", name: "ألبان وبيض", emoji: "🥚", re: /بيض|لبن|زبادي|زبدة|قشطة|جبنة|كريمة|سمن/ },
  { id: "bake", name: "مخبوزات", emoji: "🥖", re: /رقاق|عيش|بقسماط|فطير/ },
  { id: "pantry", name: "بقالة وتوابل", emoji: "🧂", re: /./ },
];
const groupOf = name => GROUPS.find(g => g.re.test(name) && !(g.not && g.not.test(name))) || GROUPS[GROUPS.length - 1];

function aggregate() {
  const map = new Map();
  state.plan.forEach(id => {
    const r = getRecipe(id); if (!r) return;
    r.ingredients.forEach(ing => {
      let q = scaled(ing), u = ing.unit;
      if (u === "كجم") { q *= 1000; u = "جم"; }
      if (u === "لتر") { q *= 1000; u = "مل"; }
      const key = ing.name + "|" + u;
      if (!map.has(key)) map.set(key, { key, name: ing.name, unit: u, qty: 0 });
      map.get(key).qty += q;
    });
  });
  return [...map.values()].map(i => {
    if (COUNTABLE.has(i.unit)) i.qty = Math.ceil(i.qty - 1e-9);
    return i;
  });
}
function fmtItem(i) {
  let q = i.qty, u = i.unit;
  if (u === "جم" && q >= 1000) { q /= 1000; u = "كجم"; }
  if (u === "مل" && q >= 1000) { q /= 1000; u = "لتر"; }
  return `${prettyNum(q)} ${u}`;
}
function shoppingStats() {
  const items = aggregate();
  const got = items.filter(i => state.checked[i.key]).length;
  return { items, got, total: items.length, pct: items.length ? Math.round(got / items.length * 100) : 0 };
}


/* ---------- لينك يوتيوب لكل أكلة ---------- */
// لو الأكلة ليها لينك فيديو معيّن في data.js (الحقل video) بنستخدمه، وإلا بنفتح بحث يوتيوب بطريقة عمل الأكلة.
const videoUrl = r => r.video || "https://www.youtube.com/results?search_query=" + encodeURIComponent("طريقة عمل " + r.name);
const videoHtml = r => `<a class="yt-link" href="${esc(videoUrl(r))}" target="_blank" rel="noopener noreferrer">${icon("play", "sm")}<span>شاهد طريقة عمل ${esc(r.name)} على يوتيوب</span></a>`;

/* ---------- خطوات التحضير (صياغة محايدة) ---------- */
function stepsFor(r) {
  if (r.name.includes("سلطة")) return ["غسل الخضار جيدًا وتقطيعها قطعًا مناسبة.", "خلط المكونات مع التتبيلة وعصير الليمون حسب الرغبة.", "التقديم طازجة بجانب الوجبة."];
  if (r.name.includes("شوربة")) return ["تجهيز المكونات وتقطيع الخضار قطعًا صغيرة.", "تشويح البصل أو الثوم قليلًا ثم إضافة باقي المكونات والمرقة.", "الترك على نار هادئة حتى تنضج، وضبط الملح والتوابل."];
  if (r.category === "سمك") return ["تنظيف السمك جيدًا وتتبيله بالليمون والثوم والتوابل.", "تجهيز الخضار أو خليط التغطية حسب الوصفة.", "الطهي في الفرن أو على النار حتى تمام النضج، ثم التقديم ساخنًا."];
  if (r.category === "فراخ") return ["تتبيل الدجاج بالمكونات والتوابل وتركه قليلًا ليتشرب النكهة.", "طهي الدجاج بالطريقة المناسبة للوصفة مع إضافة الخضار أو المرقة عند الحاجة.", "التأكد من تمام نضج الدجاج قبل التقديم."];
  if (r.category === "لحوم") return ["تتبيل اللحم وتجهيز البصل والخضار.", "تشويح اللحم مع البصل ثم إضافة باقي المكونات والسائل المناسب.", "الترك على نار هادئة حتى ينضج، والتقديم مع الأرز أو الخبز."];
  if (r.category === "بقوليات") return ["نقع البقوليات مسبقًا إن كانت جافة ثم سلقها حتى تقترب من النضج.", "إضافة البصل والثوم والطماطم والتوابل حسب الوصفة.", "الترك حتى تتسبك وتتماسك، ثم التقديم ساخنة."];
  return ["غسل وتجهيز المكونات وتقطيع الخضار.", "تشويح البصل أو الثوم في قليل من الزيت ثم إضافة المكونات الأساسية والتوابل.", "إضافة الماء أو المرقة عند الحاجة وترك المكونات حتى تنضج.", "تذوق وضبط الملح والتوابل، ثم التقديم ساخنة."];
}

/* ---------- واجهة: عام ---------- */
let toastT;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2400); }
const icon = (id, cls = "") => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;

let tab = "home", lastFocus = null;
function go(t, opts = {}) {
  if (!$("#tab-" + t)) return;
  tab = t;
  $$(".screen").forEach(s => s.classList.toggle("hidden", s.id !== "tab-" + t));
  $$(".nav-item").forEach(b => { const on = b.dataset.go === t; b.classList.toggle("active", on); on ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"); });
  render();
  window.scrollTo({ top: 0, behavior: opts.instant ? "auto" : "smooth" });
  if (t === "plan" && planFilter === "all") requestAnimationFrame(scrollToToday);
  try { history.replaceState(null, "", "#" + t); } catch (e) {}
}

function setTheme(t) {
  state.theme = t; save();
  document.documentElement.dataset.theme = t || "";
  if (!t) document.documentElement.removeAttribute("data-theme");
  applyThemeUi();
}
const isDark = () => document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
function applyThemeUi() {
  const dark = isDark();
  $("#themeIcon").setAttribute("href", dark ? "#i-sun" : "#i-moon");
  $("#themeSwitch").setAttribute("aria-checked", String(dark));
  $('meta[name="theme-color"]').setAttribute("content", dark ? "#0b6e54" : "#18a77f");
}

/* ---------- واجهة: الرئيسية ---------- */
function status(adherence) { return adherence >= .8 ? ["ok", "ممتاز، كمّل كده"] : adherence >= .45 ? ["warn", "محتاج انتباه"] : ["bad", "متأخر شوية"]; }
function renderHome() {
  const n = state.plan.length, ti = todayIdx();
  const doneCount = Object.keys(state.done).filter(k => state.done[k]).length;
  const pct = Math.round(doneCount / n * 100);
  const elapsed = isCurrentMonth() ? ti + 1 : n;
  const doneSoFar = Object.keys(state.done).filter(k => state.done[k] && Number(k) <= ti).length;
  const adherence = doneCount === 0 && ti === 0 ? 1 : doneSoFar / elapsed;
  const [cls, label] = status(adherence);

  const hp = $("#healthPill"); hp.className = "pill health " + cls;
  $("#healthPct").textContent = pct + "%";
  $("#scoreCard").className = "card score-card " + cls;
  const chip = $("#scoreChip"); chip.className = "status-chip " + cls; $("#scoreChipText").textContent = label;
  $("#scoreNum").textContent = pct;
  $("#scoreBar").style.width = pct + "%";
  $("#scoreDesc").textContent = `اطبخت ${toAr(doneCount)} من ${toAr(n)} أكلة في ${monthName()}`;

  const r = getRecipe(state.plan[ti]), done = !!state.done[ti];
  $("#bannerSub").textContent = r.name;
  $("#bannerTag").textContent = done ? "اتطبخت ✓" : "اضغط للوصفة";
  $("#todayDate").textContent = `${dayName(dateOf(ti))} ${toAr(ti + 1)} ${fmtDay(dateOf(ti), { month: "long" })}`;
  $("#todayName").textContent = r.name;
  $("#todayEmoji").textContent = emojiOf(r);
  $("#todayChips").innerHTML = r.ingredients.map(i => `<span class="mini-chip">${esc(i.name)}<b>${prettyNum(scaled(i))} ${esc(i.unit)}</b></span>`).join("");
  const db = $("#todayDone"); db.classList.toggle("done", done);
  db.innerHTML = `${icon("check")}<span>${done ? "اتطبخت — تراجع" : "تم الطبخ"}</span>`;

  const s = shoppingStats();
  $("#darkShopSub").textContent = s.total ? `${toAr(s.got)} من ${toAr(s.total)} مكوّن تم شراؤه` : "مفيش مشتريات";

  const up = [];
  for (let i = ti + 1; i < Math.min(n, ti + 8); i++) {
    const x = getRecipe(state.plan[i]);
    up.push(`<button class="up-card" role="listitem" data-open="${x.id}" data-idx="${i}"><span class="up-day">${dayName(dateOf(i))} ${toAr(i + 1)}</span><span class="up-emoji">${emojiOf(x)}</span><strong>${esc(x.name)}</strong></button>`);
  }
  $("#upcoming").innerHTML = up.join("") || `<p class="empty">خلصت أكلات الشهر 👏</p>`;
}

/* ---------- واجهة: الخطة ---------- */
let planFilter = "all";
function renderPlan() {
  const n = state.plan.length, ti = todayIdx();
  const doneCount = Object.keys(state.done).filter(k => state.done[k]).length;
  $("#planMonth").textContent = monthName();
  $("#stDone").textContent = toAr(doneCount); $("#stLeft").textContent = toAr(n - doneCount); $("#stServ").textContent = toAr(state.servings);
  $$("#planFilters .chip").forEach(c => { const on = c.dataset.f === planFilter; c.classList.toggle("selected", on); c.setAttribute("aria-pressed", String(on)); });
  const rows = state.plan.map((id, i) => ({ id, i })).filter(({ i }) => planFilter === "all" || (planFilter === "done" ? state.done[i] : !state.done[i]));
  $("#mealPlan").innerHTML = rows.map(({ id, i }) => {
    const r = getRecipe(id), d = dateOf(i), done = !!state.done[i], today = isCurrentMonth() && i === ti;
    return `<article class="meal ${today ? "today" : ""} ${done ? "done" : ""} ${isCurrentMonth() && i < ti ? "past" : ""}">
      <div class="day-pill"><small>${dayName(d).replace("ال", "")}</small><b>${toAr(i + 1)}</b></div>
      <button class="m-info" data-open="${r.id}" data-idx="${i}" aria-label="وصفة ${esc(r.name)}">
        <div class="m-name">${emojiOf(r)} ${esc(r.name)}</div>
        <div class="m-sub">${esc(r.ingredients.slice(0, 3).map(x => x.name).join(" • "))}</div>
        <div class="m-tags"><span class="cat-badge">${esc(r.category)}</span>${today ? '<span class="today-flag">النهارده</span>' : ""}</div>
      </button>
      <div class="m-actions">
        <button class="icon-sq" data-change="${i}" aria-label="تغيير أكلة يوم ${toAr(i + 1)}">${icon("refresh")}</button>
        <button class="icon-sq check ${done ? "on" : ""}" data-done="${i}" aria-pressed="${done}" aria-label="${done ? "إلغاء" : "تأكيد"} طبخ يوم ${toAr(i + 1)}">${icon("check")}</button>
      </div>
    </article>`;
  }).join("") || `<p class="empty">${planFilter === "done" ? "لسه ما طبختش حاجة من الخطة." : "كل الأكلات اتطبخت 🎉"}</p>`;
}

function scrollToToday() {
  const el = $("#mealPlan .meal.today"); if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 24;
  window.scrollTo({ top: Math.max(0, y), behavior: "auto" });
}

/* ---------- واجهة: المشتريات ---------- */
function renderShop() {
  const s = shoppingStats();
  $("#shopSub").textContent = monthName();
  $("#shopPct").textContent = toAr(s.pct) + "٪";
  $("#shopBar").style.width = s.pct + "%";
  $("#shopCount").textContent = `${toAr(s.got)} من ${toAr(s.total)} مكوّن`;
  $("#shopServ").textContent = toAr(state.servings);
  const by = new Map(GROUPS.map(g => [g.id, []]));
  s.items.forEach(i => by.get(groupOf(i.name).id).push(i));
  $("#shoppingList").innerHTML = GROUPS.map(g => {
    const list = by.get(g.id).sort((a, b) => a.name.localeCompare(b.name, "ar"));
    if (!list.length) return "";
    const got = list.filter(i => state.checked[i.key]).length;
    return `<section class="group"><h3 class="group-h"><span class="gi">${g.emoji}</span>${g.name}<em>${toAr(got)}/${toAr(list.length)}</em></h3><div class="group-body">${list.map(i => {
      const c = !!state.checked[i.key];
      return `<label class="shop-item ${c ? "checked" : ""}"><input type="checkbox" data-check="${esc(i.key)}" ${c ? "checked" : ""}><span class="tick">${icon("check")}</span><span class="si-name">${esc(i.name)}</span><span class="si-qty">${fmtItem(i)}</span></label>`;
    }).join("")}</div></section>`;
  }).join("");
  const left = s.total - s.got, b = $("#shopBadge");
  b.hidden = !left; b.textContent = left > 99 ? "٩٩+" : toAr(left);
}
function shoppingText() {
  const s = shoppingStats();
  const by = new Map(GROUPS.map(g => [g.id, []]));
  s.items.forEach(i => by.get(groupOf(i.name).id).push(i));
  let out = `🛒 مشتريات ${monthName()} (${toAr(state.servings)} أفراد)\n`;
  GROUPS.forEach(g => {
    const l = by.get(g.id).sort((a, b) => a.name.localeCompare(b.name, "ar")); if (!l.length) return;
    out += `\n${g.emoji} ${g.name}\n` + l.map(i => `${state.checked[i.key] ? "☑" : "☐"} ${i.name}: ${fmtItem(i)}`).join("\n") + "\n";
  });
  return out.trim();
}

/* ---------- واجهة: الأكلات ---------- */
let recCat = "all";
function renderRecipes() {
  const chips = ["all", "مفضلة", ...CATS];
  $("#recipeFilters").innerHTML = chips.map(c => `<button class="chip ${c === recCat ? "selected" : ""}" data-cat="${c}" aria-pressed="${c === recCat}">${c === "all" ? "الكل" : c === "مفضلة" ? "♥ المفضلة" : c}</button>`).join("");
  const q = norm($("#recipeSearch").value);
  const list = RECIPES.filter(r => (recCat === "مفضلة" ? state.favs.includes(r.id) : inCat(r, recCat)) && (!q || norm(r.name).includes(q) || r.ingredients.some(i => norm(i.name).includes(q))));
  $("#recCount").textContent = toAr(list.length);
  $("#recipeGrid").innerHTML = list.map(r => `<button class="r-card" data-open="${r.id}">
      ${state.favs.includes(r.id) ? `<span class="r-fav">${icon("heart")}</span>` : ""}
      <span class="r-emoji">${emojiOf(r)}</span><strong>${esc(r.name)}</strong>
      <p>${esc(r.ingredients.slice(0, 3).map(i => i.name).join(" • "))}</p><span class="cat-badge fit">${esc(r.category)}</span></button>`).join("")
    || `<p class="empty" style="grid-column:1/-1">${recCat === "مفضلة" ? "لسه ما ضفتش أكلات للمفضلة." : "مفيش نتيجة مطابقة. جرّب كلمة تانية."}</p>`;
}

/* ---------- واجهة: المزيد ---------- */
function renderMore() {
  $("#servVal").textContent = toAr(state.servings);
  $("#prefChips").innerHTML = ["all", ...CATS].map(c => `<button class="chip ${state.pref === c ? "selected" : ""}" data-pref="${c}" aria-pressed="${state.pref === c}">${c === "all" ? "الكل" : c}</button>`).join("");
  applyThemeUi();
}

function render() {
  ({ home: renderHome, plan: renderPlan, shop: renderShop, recipes: renderRecipes, more: renderMore })[tab]();
  renderShopBadgeOnly();
}
function renderShopBadgeOnly() { const s = shoppingStats(), b = $("#shopBadge"), l = s.total - s.got; b.hidden = !l; b.textContent = l > 99 ? "٩٩+" : toAr(l); }

/* ---------- النوافذ ---------- */
function openSheet(html, focusSel) {
  lastFocus = document.activeElement;
  $("#sheetBody").innerHTML = html;
  $("#sheetBackdrop").classList.remove("hidden"); document.body.classList.add("locked");
  $("#sheet").scrollTop = 0;
  (focusSel && $(focusSel)) ? $(focusSel).focus() : $("#sheetClose").focus();
}
function closeSheet() {
  if ($("#sheetBackdrop").classList.contains("hidden")) return;
  $("#sheetBackdrop").classList.add("hidden"); document.body.classList.remove("locked");
  current = null; if (lastFocus && lastFocus.isConnected) lastFocus.focus();
}
let dialogResolve = null;
function confirmDlg(title, text, okLabel = "تأكيد", danger = false) {
  return new Promise(res => {
    dialogResolve = res; lastFocus = document.activeElement;
    $("#dlgTitle").textContent = title; $("#dlgText").textContent = text;
    const ok = $("#dlgOk"); ok.textContent = okLabel; ok.classList.toggle("danger-ok", danger);
    $("#dialogBackdrop").classList.remove("hidden"); document.body.classList.add("locked"); $("#dlgCancel").focus();
  });
}
function closeDialog(v) {
  $("#dialogBackdrop").classList.add("hidden");
  if (!$("#sheetBackdrop").classList.contains("hidden")) {} else document.body.classList.remove("locked");
  if (dialogResolve) { dialogResolve(v); dialogResolve = null; }
  if (lastFocus && lastFocus.isConnected) lastFocus.focus();
}

/* ---------- الوصفة ---------- */
let current = null; // { id, idx }
function openRecipe(id, idx = null) {
  const r = getRecipe(id); if (!r) return;
  current = { id: r.id, idx };
  const fav = state.favs.includes(r.id);
  const inPlan = state.plan.indexOf(r.id);
  openSheet(`
    <div class="sh-head"><span class="cat-badge">${esc(r.category)}</span><h2 id="sheetTitle">${emojiOf(r)} ${esc(r.name)}</h2>
      <p class="sh-meta">المقادير محسوبة حسب عدد الأفراد${inPlan >= 0 ? ` • في الخطة يوم ${toAr(inPlan + 1)}` : ""}</p></div>
    <div class="sh-tools">
      <button class="tool-pill ${fav ? "on" : ""}" id="favBtn" aria-pressed="${fav}">${icon("heart", "sm")}${fav ? "في المفضلة" : "أضف للمفضلة"}</button>
      <button class="tool-pill" id="shareRecipe">${icon("share", "sm")}مشاركة</button>
    </div>
    <div class="serv-row"><span>عدد الأفراد</span>
      <div class="stepper"><button class="round-btn" id="shMinus" aria-label="تقليل الأفراد">${icon("minus")}</button><b id="shServ">${toAr(state.servings)}</b><button class="round-btn" id="shPlus" aria-label="زيادة الأفراد">${icon("plus")}</button></div></div>
    <h3 class="sh-h3">🧺 المكونات</h3>
    <div class="ing-grid" id="shIng">${ingHtml(r)}</div>
    ${videoHtml(r)}
    <h3 class="sh-h3">👩‍🍳 طريقة التحضير</h3>
    <ol class="steps">${stepsFor(r).map(s => `<li>${esc(s)}</li>`).join("")}</ol>
    <div class="sheet-actions">
      ${idx !== null ? `<button class="btn primary wide" id="markDone">${icon("check")}${state.done[idx] ? "إلغاء علامة الطبخ" : "تم الطبخ"}</button>` : ""}
      <button class="btn ghost wide" id="pickDay">${icon("swap")}${inPlan >= 0 ? "انقلها ليوم تاني" : "حطها في الخطة بدل أكلة"}</button>
    </div>`);
  $("#sheet").setAttribute("aria-labelledby", "sheetTitle");
}
const ingHtml = r => r.ingredients.map(i => `<div class="ing"><span>${esc(i.name)}</span><b>${prettyNum(scaled(i))} ${esc(i.unit)}</b></div>`).join("");

function openDayPicker() {
  const r = getRecipe(current.id), ti = todayIdx(), from = isCurrentMonth() ? ti : 0;
  const rows = [];
  for (let i = from; i < state.plan.length; i++) {
    const x = getRecipe(state.plan[i]), d = dateOf(i);
    rows.push(`<button class="day-opt" data-swap="${i}"><span class="d"><small>${dayName(d).replace("ال", "")}</small><b>${toAr(i + 1)}</b></span><span class="n">${emojiOf(x)} ${esc(x.name)}</span>${state.done[i] ? "<em>اتطبخت</em>" : ""}</button>`);
  }
  openSheet(`<div class="sh-head"><h2 id="sheetTitle">اختار اليوم</h2><p class="sh-meta">هتحل «${esc(r.name)}» مكان أكلة اليوم اللي تختاره</p></div><div class="day-list">${rows.join("")}</div>`);
  $("#sheet").setAttribute("aria-labelledby", "sheetTitle");
}
function placeRecipe(id, day) {
  const old = state.plan.indexOf(id);
  const prev = state.plan[day];
  if (old === day) return closeSheet();
  if (old >= 0) { state.plan[old] = prev; state.done[old] = false; } // تبديل بين يومين لضمان عدم التكرار
  state.plan[day] = id; state.done[day] = false;
  save(); closeSheet(); render();
  toast(old >= 0 ? `اتبدلت الأكلة مع يوم ${toAr(old + 1)}` : `اتحطت في يوم ${toAr(day + 1)}`);
}

/* ---------- أفعال ---------- */
function changeMeal(i) {
  const used = new Set(state.plan);
  let pool = RECIPES.filter(r => !used.has(r.id) && inCat(r, state.pref));
  if (!pool.length) pool = RECIPES.filter(r => !used.has(r.id));
  if (!pool.length) return toast("مفيش أكلة بديلة من غير تكرار");
  const r = pool[Math.floor(Math.random() * pool.length)];
  state.plan[i] = r.id; state.done[i] = false; save(); render();
  toast(`يوم ${toAr(i + 1)} بقى: ${r.name}`);
}
function toggleDone(i) {
  state.done[i] = !state.done[i]; save(); render();
  toast(state.done[i] ? "تسلم إيدك 👩‍🍳" : "اتشالت علامة الطبخ");
}
function suggest() {
  const used = new Set(state.plan);
  const pool = RECIPES.filter(r => !used.has(r.id));
  const r = (pool.length ? pool : RECIPES)[Math.floor(Math.random() * (pool.length || RECIPES.length))];
  openRecipe(r.id, null);
}
async function newPlan() {
  if (!(await confirmDlg("خطة جديدة؟", "هتتبدل أكلات الشهر كلها وهتتمسح علامات الطبخ والشراء.", "خطة جديدة"))) return;
  state.plan = makePlan(daysIn(state.monthKey), state.pref); state.done = {}; state.checked = {};
  save(); render(); toast("اتعملت خطة جديدة ✨");
}
async function resetAll() {
  if (!(await confirmDlg("مسح كل البيانات؟", "الخطة والمفضلة والإعدادات هتتمسح من الجهاز ومش هينفع ترجعها.", "امسح", true))) return;
  try { localStorage.removeItem(KEY); localStorage.removeItem(OLD_KEY); } catch (e) {}
  state = freshState(); document.documentElement.removeAttribute("data-theme"); save(); go("home", { instant: true }); toast("اتمسحت البيانات");
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    try { const t = document.createElement("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return ok; } catch (e2) { return false; }
  }
}
async function share(title, text) {
  if (navigator.share) { try { await navigator.share({ title, text }); return; } catch (e) { if (e.name === "AbortError") return; } }
  toast((await copyText(text)) ? "اتنسخ — الصقه في أي مكان" : "تعذر النسخ");
}
function setServings(n) { state.servings = clamp(n, 1, 12); save(); render(); }

/* ---------- الأحداث ---------- */
document.addEventListener("click", e => {
  const t = e.target;
  const goBtn = t.closest("[data-go]"); if (goBtn) return go(goBtn.dataset.go);
  const sw = t.closest("[data-swap]"); if (sw && current) return placeRecipe(current.id, Number(sw.dataset.swap));
  const op = t.closest("[data-open]"); if (op) return openRecipe(Number(op.dataset.open), op.dataset.idx !== undefined ? Number(op.dataset.idx) : null);
  const ch = t.closest("[data-change]"); if (ch) return changeMeal(Number(ch.dataset.change));
  const dn = t.closest("[data-done]"); if (dn) return toggleDone(Number(dn.dataset.done));
  const pf = t.closest("#planFilters [data-f]"); if (pf) { planFilter = pf.dataset.f; return renderPlan(); }
  const rc = t.closest("#recipeFilters [data-cat]"); if (rc) { recCat = rc.dataset.cat; return renderRecipes(); }
  const pr = t.closest("[data-pref]"); if (pr) { state.pref = pr.dataset.pref; save(); return renderMore(); }
});
$("#bannerToday").addEventListener("click", () => openRecipe(state.plan[todayIdx()], todayIdx()));
$("#todayOpen").addEventListener("click", () => openRecipe(state.plan[todayIdx()], todayIdx()));
$("#todayDone").addEventListener("click", () => toggleDone(todayIdx()));
$("#spinBtn").addEventListener("click", suggest);
$("#newPlanBtn").addEventListener("click", newPlan);
$("#themeBtn").addEventListener("click", () => setTheme(isDark() ? "light" : "dark"));
$("#themeSwitch").addEventListener("click", () => setTheme(isDark() ? "light" : "dark"));
$("#searchBtn").addEventListener("click", () => { go("recipes"); setTimeout(() => $("#recipeSearch").focus(), 250); });
$("#recipeSearch").addEventListener("input", renderRecipes);
$("#servPlus").addEventListener("click", () => setServings(state.servings + 1));
$("#servMinus").addEventListener("click", () => setServings(state.servings - 1));
$("#resetAllBtn").addEventListener("click", resetAll);
$("#shoppingList").addEventListener("change", e => {
  const k = e.target.dataset.check; if (!k) return;
  e.target.checked ? state.checked[k] = true : delete state.checked[k];
  save(); const y = window.scrollY; renderShop(); window.scrollTo(0, y);
});
$("#resetCheckedBtn").addEventListener("click", () => { state.checked = {}; save(); renderShop(); toast("اتشالت علامات الشراء"); });
$("#copyListBtn").addEventListener("click", async () => toast((await copyText(shoppingText())) ? "اتنسخت قائمة المشتريات" : "تعذر النسخ"));
$("#shareListBtn").addEventListener("click", () => share("قائمة مشتريات نطبخ إيه؟", shoppingText()));

// داخل نافذة الوصفة
$("#sheet").addEventListener("click", e => {
  if (!current) return;
  const r = getRecipe(current.id), t = e.target;
  if (t.closest("#favBtn")) {
    const i = state.favs.indexOf(r.id); i >= 0 ? state.favs.splice(i, 1) : state.favs.push(r.id); save();
    const keep = current; openRecipe(keep.id, keep.idx); $("#favBtn").focus(); toast(i >= 0 ? "اتشالت من المفضلة" : "اتضافت للمفضلة ♥");
  } else if (t.closest("#shareRecipe")) {
    share(r.name, `${r.name} (${toAr(state.servings)} أفراد)\n\nالمكونات:\n${r.ingredients.map(i => `- ${i.name}: ${prettyNum(scaled(i))} ${i.unit}`).join("\n")}\n\nفيديو الطريقة: ${videoUrl(r)}\n\nالطريقة:\n${stepsFor(r).map((s, n) => `${toAr(n + 1)}. ${s}`).join("\n")}`);
  } else if (t.closest("#shPlus") || t.closest("#shMinus")) {
    setServings(state.servings + (t.closest("#shPlus") ? 1 : -1));
    $("#shServ").textContent = toAr(state.servings); $("#shIng").innerHTML = ingHtml(r);
  } else if (t.closest("#markDone")) {
    toggleDone(current.idx); closeSheet();
  } else if (t.closest("#pickDay")) {
    openDayPicker();
  }
});
$("#sheetClose").addEventListener("click", closeSheet);
$("#sheetBackdrop").addEventListener("click", e => { if (e.target.id === "sheetBackdrop") closeSheet(); });
$("#dlgOk").addEventListener("click", () => closeDialog(true));
$("#dlgCancel").addEventListener("click", () => closeDialog(false));
$("#dialogBackdrop").addEventListener("click", e => { if (e.target.id === "dialogBackdrop") closeDialog(false); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { if (!$("#dialogBackdrop").classList.contains("hidden")) closeDialog(false); else closeSheet(); }
  if (e.key === "Tab") { // حبس التركيز داخل النافذة المفتوحة
    const open = !$("#dialogBackdrop").classList.contains("hidden") ? $("#dialog") : !$("#sheetBackdrop").classList.contains("hidden") ? $("#sheet") : null;
    if (!open) return;
    const f = $$("button, [href], input, [tabindex]:not([tabindex='-1'])", open).filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});

// تثبيت التطبيق
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; $("#installCard").hidden = false; });
$("#installBtn").addEventListener("click", async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $("#installCard").hidden = true; });
window.addEventListener("appinstalled", () => { $("#installCard").hidden = true; toast("اتثبت التطبيق ✓"); });

// لو التطبيق فضل مفتوح وعدّى يوم/شهر
document.addEventListener("visibilitychange", () => { if (!document.hidden) { rollMonth(); render(); } });
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyThemeUi);

/* ---------- بدء ---------- */
if (state.theme) document.documentElement.dataset.theme = state.theme;
rollMonth();
{ const h = location.hash.slice(1); go(["home", "plan", "shop", "recipes", "more"].includes(h) ? h : "home", { instant: true }); }
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}
