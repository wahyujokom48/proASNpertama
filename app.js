// ProASN Prep — Statistisi Ahli Pertama BPS (v2)
const STORAGE_KEY = "proasn_statistisi_v2";

// Merge 600 curated questions across 2 Versions: BKN General (10 Packs @ 50) & Khusus BPS (2 Packs @ 50)
function initQuestionBank() {
  const base = window.PROASN_QUESTIONS || [];
  const extra = window.PROASN_QUESTIONS_EXTRA || [];
  const packs3to10 = (window.PROASN_QUESTIONS_PACKS || []).map(q => ({ ...q, scope: "bkn" }));
  const bknGeneral = window.PROASN_QUESTIONS_BKN_GENERAL || [];

  const bpsAll = [...base, ...extra];
  const cats = ["Manajerial", "Sosial Kultural", "Potensi", "Literasi Digital", "Preferensi Karier"];
  let cursor = 0;
  cats.forEach(cat => {
    bpsAll.filter(q => q.category === cat).forEach(q => {
      q.pack = (cursor % 2) + 1; // Pack 1 & 2 (Khusus BPS)
      q.scope = "bps";
      q.tier = 1;
      q.tierLabel = "Tier 1 • Khusus BPS 2026";
      cursor++;
    });
  });

  // Add sample Tripatha RIASEC (30) & Talent DNA ESQ (18) to Bank Soal (BKN General) so all 5 Official Aspects are browsable
  const likertOpts = ["A. Sangat Sesuai", "B. Sesuai", "C. Kurang Sesuai", "D. Tidak Sesuai"];
  const riasecBank = (window.PROASN_RIASEC_ITEMS || []).map((item, idx) => ({
    id: 701 + idx,
    pack: idx < 15 ? 11 : 12,
    scope: "bkn",
    tier: 1,
    tierLabel: "Tier 1 • BKN General (RIASEC)",
    category: "04. Tripatha Karier (RIASEC)",
    subtopic: `Tipe ${item.riasec} (Teori Holland)`,
    isPreference: true,
    question: item.text,
    options: likertOpts,
    answer: 0,
    explanation: `Instrumen Tripatha Karier (Teori Holland RIASEC — Tipe ${item.riasec}). Tidak ada jawaban benar/salah; jawab spontan dan konsisten sesuai minat aslimu.`
  }));

  const dnaBank = (window.PROASN_TALENT_DNA_ITEMS || []).map((item, idx) => ({
    id: 751 + idx,
    pack: idx < 9 ? 11 : 12,
    scope: "bkn",
    tier: 1,
    tierLabel: "Tier 1 • BKN General (Talent DNA)",
    category: "05. Talent DNA (ESQ)",
    subtopic: `${item.dim} • ${item.talent}`,
    isPreference: true,
    question: item.text,
    options: likertOpts,
    answer: 0,
    explanation: `Instrumen Talent DNA ESQ (Talenta ${item.talent} — Dimensi ${item.dim}). Tidak ada jawaban benar/salah; jawab jujur sesuai kekuatan alamu.`
  }));

  // Normalize all categories to the exact 5 Official ProASN 2026 Aspects
  const normalizeCat = q => {
    if (q.category === "Potensi") q.category = "01. Potensi";
    else if (q.category === "Manajerial" || q.category === "Sosial Kultural") q.category = "02. Mansoskul";
    else if (q.category === "Literasi Digital") q.category = "03. Literasi Digital";
    else if (q.category === "Preferensi Karier") q.category = "04. Tripatha Karier (RIASEC)";
    return q;
  };

  const hotsPotensi = window.PROASN_QUESTIONS_HOTS_POTENSI || [];
  const hotsMD = window.PROASN_QUESTIONS_HOTS_MD || [];

  window.PROASN_QUESTIONS = [...hotsPotensi, ...hotsMD, ...bknGeneral, ...packs3to10, ...bpsAll]
    .map(normalizeCat)
    .concat(riasecBank, dnaBank);
}

const state = {
  theme: "light",
  completedMaterials: [],
  practiceAnswers: {}, // Mode Belajar: { questionId: selectedIndex }
  bookmarks: [],
  checklist: [],
  catHistory: [],      // [{ date, total, correct, pct }]
  materialFilter: "Semua",
  materialMode: "full", // "full" | "summary" | "flashcard"
  practiceScope: "bkn", // "bkn" (General) | "bps" (Khusus BPS) | "all"
  catScope: "bkn",      // "bkn" | "bps"
  practicePack: 11,     // Default Paket G1 (50 soal BKN General Tier 1)
  practiceFilter: "Semua",
  practiceMode: "study" // "study" | "exam"
};

// Ephemeral state for Practice Exam Mode & Flashcards
let practiceExamAnswers = {};
let practiceExamGraded = false;
let fcIndex = 0;
let fcFlipped = false;

let catSession = null;
let catInterval = null;

// ==================== INIT & STORAGE ====================
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) Object.assign(state, saved);
  } catch (e) {
    console.warn("Gagal memuat state:", e);
  }
  applyTheme();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Gagal menyimpan state:", e);
  }
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  const icon = document.getElementById("themeIcon");
  if (icon) icon.textContent = state.theme === "dark" ? "☀️" : "🌙";
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
  saveState();
}

function resetProgress() {
  if (!confirm("Reset semua progres belajar, jawaban latihan, bookmark, riwayat CAT, dan checklist?")) return;
  state.completedMaterials = [];
  state.practiceAnswers = {};
  state.bookmarks = [];
  state.checklist = [];
  state.catHistory = [];
  practiceExamAnswers = {};
  practiceExamGraded = false;
  saveState();
  renderAll();
}

// ==================== NAVIGATION ====================
function navigateTo(tabId) {
  document.querySelectorAll(".tab-section").forEach(sec => sec.classList.remove("active"));
  const target = document.getElementById(`tab-${tabId}`);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav-btn, .m-nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
  if (tabId === "home") {
    renderHomeStats();
    renderAspectAnalysis();
    renderCatHistory();
  }
}

// ==================== COUNTDOWN ====================
function updateCountdown() {
  const targetDate = new Date("2026-12-09T08:00:00+07:00").getTime();
  const diff = targetDate - Date.now();
  const daysEl = document.getElementById("cd-days");
  const hoursEl = document.getElementById("cd-hours");
  const minsEl = document.getElementById("cd-mins");
  if (!daysEl) return;

  if (diff <= 0) {
    daysEl.textContent = "0";
    hoursEl.textContent = "0";
    minsEl.textContent = "0";
    return;
  }

  daysEl.textContent = Math.floor(diff / (1000 * 60 * 60 * 24));
  hoursEl.textContent = Math.floor((diff / (1000 * 60 * 60)) % 24);
  minsEl.textContent = Math.floor((diff / (1000 * 60)) % 60);
}

// ==================== HOME STATS & ANALYSIS ====================
function renderHomeStats() {
  const container = document.getElementById("homeStatsGrid");
  if (!container) return;

  const totalQ = window.PROASN_QUESTIONS.length;
  const answeredIds = Object.keys(state.practiceAnswers).map(Number);
  const answeredCount = answeredIds.length;
  let correctCount = 0;
  answeredIds.forEach(id => {
    const q = window.PROASN_QUESTIONS.find(x => x.id === id);
    if (q && state.practiceAnswers[id] === q.answer) correctCount++;
  });

  const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
  const totalMat = window.PROASN_MATERIALS.length;
  const doneMat = state.completedMaterials.length;
  const totalChk = window.PROASN_CHECKLIST.length;
  const doneChk = state.checklist.length;

  const cards = [
    { label: "Soal Dikerjakan", value: `${answeredCount}/${totalQ}`, pct: Math.round((answeredCount / totalQ) * 100) },
    { label: "Akurasi Jawaban", value: `${accuracy}%`, pct: accuracy },
    { label: "Materi Dipelajari", value: `${doneMat}/${totalMat}`, pct: Math.round((doneMat / totalMat) * 100) },
    { label: "Checklist Hari-H", value: `${doneChk}/${totalChk}`, pct: Math.round((doneChk / totalChk) * 100) }
  ];

  container.innerHTML = cards.map(c => `
    <div class="stat-card">
      <div class="stat-label">${c.label}</div>
      <div class="stat-value">${c.value}</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${c.pct}%"></div></div>
    </div>
  `).join("");
}

function getAspectStats() {
  const cats = ["01. Potensi", "02. Mansoskul", "03. Literasi Digital", "04. Tripatha Karier (RIASEC)", "05. Talent DNA (ESQ)"];
  return cats.map(cat => {
    const qs = window.PROASN_QUESTIONS.filter(q => q.category === cat);
    let answered = 0;
    let correct = 0;
    qs.forEach(q => {
      if (state.practiceAnswers[q.id] !== undefined) {
        answered++;
        if (state.practiceAnswers[q.id] === q.answer) correct++;
      }
    });
    const pct = qs.length ? Math.round((correct / qs.length) * 100) : 0;
    return { cat, total: qs.length, answered, correct, pct };
  });
}

function renderAspectAnalysis() {
  const el = document.getElementById("aspectAnalysisList");
  if (!el) return;
  const stats = getAspectStats();
  el.innerHTML = stats.map(s => `
    <div class="aspect-row">
      <div class="aspect-row-head">
        <span>${s.cat}</span>
        <span class="muted">${s.correct}/${s.total} benar (${s.pct}%)</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${s.pct}%"></div></div>
    </div>
  `).join("");
}

function practiceWeakest() {
  const stats = getAspectStats().sort((a, b) => a.pct - b.pct);
  const weakest = stats[0]?.cat || "Manajerial";
  state.practiceFilter = weakest;
  renderPracticeFilters();
  renderPracticeList();
  navigateTo("practice");
}

function renderCatHistory() {
  const el = document.getElementById("catHistoryList");
  if (!el) return;
  if (!state.catHistory || state.catHistory.length === 0) {
    el.innerHTML = `<p class="muted">Belum ada riwayat Simulasi CAT. Coba kerjakan Mini Tryout atau Tryout Standar!</p>`;
    return;
  }
  el.innerHTML = state.catHistory.slice(0, 5).map(h => `
    <div class="history-item">
      <div>
        <strong>${h.label || "Simulasi CAT"}</strong>
        <div class="muted" style="font-size:12px;">${h.date}</div>
      </div>
      <span class="${h.pct >= 80 ? "badge-green" : "badge-orange"}">${h.pct}% (${h.correct}/${h.total})</span>
    </div>
  `).join("");
}

// ==================== MATERIALS (FULL / SUMMARY / FLASHCARD) ====================
function setMaterialMode(mode) {
  state.materialMode = mode;
  document.querySelectorAll("#materialModeToggle .seg-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  const stdView = document.getElementById("materialStandardView");
  const fcView = document.getElementById("flashcardView");

  if (mode === "flashcard") {
    stdView.classList.add("hidden");
    fcView.classList.remove("hidden");
    renderFlashcard();
  } else {
    fcView.classList.add("hidden");
    stdView.classList.remove("hidden");
    renderMaterials();
  }
}

function renderMaterials() {
  const filterEl = document.getElementById("materialFilter");
  const listEl = document.getElementById("materialsContainer");
  if (!filterEl || !listEl) return;

  const categories = ["Semua", ...new Set(window.PROASN_MATERIALS.map(m => m.category))];
  filterEl.innerHTML = categories.map(cat => `
    <button class="pill-btn ${state.materialFilter === cat ? "active" : ""}" onclick="setMaterialFilter('${cat}')">${cat}</button>
  `).join("");

  const filtered = state.materialFilter === "Semua"
    ? window.PROASN_MATERIALS
    : window.PROASN_MATERIALS.filter(m => m.category === state.materialFilter);

  const isSummary = state.materialMode === "summary";

  listEl.innerHTML = filtered.map((m, idx) => {
    const isDone = state.completedMaterials.includes(m.id);

    const bodyHtml = isSummary
      ? `
        <ul class="summary-chip-list">
          ${m.quickSummary.map(item => `<li>⚡ ${item}</li>`).join("")}
        </ul>
        <div class="dodont-grid">
          <div class="dodont-box do"><strong>✅ DO:</strong> ${m.doDont.do}</div>
          <div class="dodont-box dont"><strong>❌ DON'T:</strong> ${m.doDont.dont}</div>
        </div>
      `
      : `
        ${m.fullContent.map(sec => `
          <div class="material-section">
            <h4>${sec.heading}</h4>
            ${(sec.paragraphs || []).map(p => `<p class="material-para">${p}</p>`).join("")}
            ${sec.points ? `<ul>${sec.points.map(pt => `<li>${pt}</li>`).join("")}</ul>` : ""}
          </div>
        `).join("")}

        <div class="example-grid">
          <div class="example-box bps">
            <h5>🏢 Contoh Nyata di BPS (Statistisi)</h5>
            <ul>${m.bpsExamples.map(ex => `<li>${ex}</li>`).join("")}</ul>
          </div>
          <div class="example-box around">
            <h5>🌍 Contoh di Sekitar & Kerja ASN</h5>
            <ul>${m.aroundExamples.map(ex => `<li>${ex}</li>`).join("")}</ul>
          </div>
        </div>

        <div class="dodont-grid">
          <div class="dodont-box do"><strong>✅ DO (Lakukan):</strong> ${m.doDont.do}</div>
          <div class="dodont-box dont"><strong>❌ DON'T (Hindari):</strong> ${m.doDont.dont}</div>
        </div>
      `;

    return `
      <article class="material-card ${idx === 0 || isSummary ? "open" : ""}" id="card-${m.id}">
        <div class="material-head" onclick="toggleMaterialCard('${m.id}')">
          <div>
            <span class="${isDone ? "badge-green" : "badge-blue"}">${isDone ? "✓ Sudah Dipelajari" : m.badge}</span>
            <h3>${m.title}</h3>
            <p>${m.summary}</p>
          </div>
          <span style="font-size:18px; color:var(--text-muted)">▾</span>
        </div>
        <div class="material-body">
          ${bodyHtml}
          <div class="material-footer">
            <button class="btn ${isDone ? "btn-ghost" : "btn-secondary"} btn-sm" onclick="toggleMaterialDone('${m.id}')">
              ${isDone ? "Batalkan Selesai" : "✓ Tandai Sudah Dipelajari"}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function setMaterialFilter(cat) {
  state.materialFilter = cat;
  renderMaterials();
}

function toggleMaterialCard(id) {
  const card = document.getElementById(`card-${id}`);
  if (card) card.classList.toggle("open");
}

function toggleMaterialDone(id) {
  const idx = state.completedMaterials.indexOf(id);
  if (idx >= 0) state.completedMaterials.splice(idx, 1);
  else state.completedMaterials.push(id);
  saveState();
  renderMaterials();
  renderHomeStats();
}

// Flashcard Logic
function renderFlashcard() {
  const cards = window.PROASN_FLASHCARDS || [];
  if (!cards.length) return;
  const card = cards[fcIndex];
  document.getElementById("fcCounter").textContent = `Kartu ${fcIndex + 1} / ${cards.length}`;
  const box = document.getElementById("flashcardBox");
  box.classList.toggle("flipped", fcFlipped);
  document.getElementById("fcLabel").textContent = fcFlipped ? "JAWABAN / KATA KUNCI" : "PERTANYAAN / KONSEP";
  document.getElementById("fcText").textContent = fcFlipped ? card.back : card.front;
}

function flipFlashcard() {
  fcFlipped = !fcFlipped;
  renderFlashcard();
}

function nextFlashcard() {
  const len = (window.PROASN_FLASHCARDS || []).length;
  fcIndex = (fcIndex + 1) % len;
  fcFlipped = false;
  renderFlashcard();
}

function prevFlashcard() {
  const len = (window.PROASN_FLASHCARDS || []).length;
  fcIndex = (fcIndex - 1 + len) % len;
  fcFlipped = false;
  renderFlashcard();
}

// ==================== BANK SOAL (MODE BELAJAR vs MODE UJIAN) ====================
function setPracticeMode(mode) {
  state.practiceMode = mode;
  document.querySelectorAll("#practiceModeToggle .seg-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.pmode === mode);
  });

  const examBar = document.getElementById("examModeBar");
  const scoreBanner = document.getElementById("examScoreBanner");
  if (mode === "exam") {
    examBar.classList.remove("hidden");
  } else {
    examBar.classList.add("hidden");
    scoreBanner.classList.add("hidden");
  }
  renderPracticeList();
}

function setPracticeScope(scope) {
  state.practiceScope = scope;
  document.querySelectorAll("#practiceScopeToggle .seg-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.scope === scope);
  });
  // Set sensible default pack for selected scope
  if (scope === "bkn") state.practicePack = 11;
  else if (scope === "bps") state.practicePack = 1;
  else state.practicePack = "Semua";

  renderPracticeFilters();
  renderPracticeList();
}

function renderPracticeFilters() {
  const packEl = document.getElementById("practicePackFilter");
  if (packEl) {
    let packDefs = [];
    if (state.practiceScope === "bkn") {
      packDefs = [
        { id: 11, label: "🔥 Paket 1 (Tier 1 BKN)" },
        { id: 12, label: "🔥 Paket 2 (Tier 1 BKN)" },
        { id: 3, label: "⭐ Paket 3 (Tier 2)" },
        { id: 4, label: "⭐ Paket 4 (Tier 2)" },
        { id: 5, label: "⭐ Paket 5 (Tier 2)" },
        { id: 6, label: "📘 Paket 6 (Tier 3)" },
        { id: 7, label: "📘 Paket 7 (Tier 3)" },
        { id: 8, label: "📘 Paket 8 (Tier 3)" },
        { id: 9, label: "📂 Paket 9 (Arsip)" },
        { id: 10, label: "📂 Paket 10 (Arsip)" },
        { id: "Semua", label: "📦 Semua BKN (500)" }
      ];
    } else if (state.practiceScope === "bps") {
      packDefs = [
        { id: 1, label: "📊 BPS Paket 1 (50)" },
        { id: 2, label: "📊 BPS Paket 2 (50)" },
        { id: "Semua", label: "📦 Semua BPS (100)" }
      ];
    } else {
      packDefs = [
        { id: "Semua", label: "📦 Semua Versi (600)" },
        { id: 11, label: "🏛️ BKN Paket 1" },
        { id: 12, label: "🏛️ BKN Paket 2" },
        { id: 1, label: "📊 BPS Paket 1" },
        { id: 2, label: "📊 BPS Paket 2" }
      ];
    }
    packEl.innerHTML = packDefs.map(p => {
      const active = state.practicePack === p.id ? "active" : "";
      const arg = p.id === "Semua" ? "'Semua'" : p.id;
      return `<button class="pill-btn ${active}" onclick="setPracticePack(${arg})">${p.label}</button>`;
    }).join("");
  }

  const filterEl = document.getElementById("practiceCategoryFilter");
  if (!filterEl) return;
  const categories = ["Semua", "01. Potensi", "02. Mansoskul", "03. Literasi Digital", "04. Tripatha Karier (RIASEC)", "05. Talent DNA (ESQ)"];
  filterEl.innerHTML = categories.map(cat => `
    <button class="pill-btn ${state.practiceFilter === cat ? "active" : ""}" onclick="setPracticeFilter('${cat}')">${cat}</button>
  `).join("");
}

function setPracticePack(pack) {
  state.practicePack = pack;
  renderPracticeFilters();
  renderPracticeList();
}

function setPracticeFilter(cat) {
  state.practiceFilter = cat;
  renderPracticeFilters();
  renderPracticeList();
}

function getFilteredPracticeList() {
  const onlyBookmark = document.getElementById("onlyBookmarkCheck")?.checked;
  const onlyUnanswered = document.getElementById("onlyUnansweredCheck")?.checked;
  const onlyWrong = document.getElementById("onlyWrongCheck")?.checked;
  const query = (document.getElementById("practiceSearchInput")?.value || "").trim().toLowerCase();

  const ansSource = state.practiceMode === "exam" ? practiceExamAnswers : state.practiceAnswers;

  let list = window.PROASN_QUESTIONS.slice();
  if (state.practiceScope !== "all") {
    list = list.filter(q => q.scope === state.practiceScope);
  }
  if (state.practicePack !== "Semua") {
    list = list.filter(q => q.pack === state.practicePack);
  }
  if (state.practiceFilter !== "Semua") {
    list = list.filter(q => q.category === state.practiceFilter);
  }
  if (onlyBookmark) {
    list = list.filter(q => state.bookmarks.includes(q.id));
  }
  if (onlyUnanswered) {
    list = list.filter(q => ansSource[q.id] === undefined);
  }
  if (onlyWrong) {
    list = list.filter(q => !q.isPreference && ansSource[q.id] !== undefined && ansSource[q.id] !== q.answer);
  }
  if (query) {
    list = list.filter(q =>
      q.question.toLowerCase().includes(query) ||
      q.subtopic.toLowerCase().includes(query) ||
      q.category.toLowerCase().includes(query) ||
      q.explanation.toLowerCase().includes(query)
    );
  }
  return list;
}

function renderPracticeList() {
  const container = document.getElementById("practiceContainer");
  const summaryEl = document.getElementById("practiceSummary");
  if (!container) return;

  const list = getFilteredPracticeList();
  const isExam = state.practiceMode === "exam";
  const ansSource = isExam ? practiceExamAnswers : state.practiceAnswers;

  if (isExam) {
    const answeredInList = list.filter(q => practiceExamAnswers[q.id] !== undefined).length;
    const statusEl = document.getElementById("examModeStatus");
    if (statusEl) {
      statusEl.textContent = practiceExamGraded
        ? `Mode Ujian Selesai Dikoreksi (${answeredInList}/${list.length} terjawab)`
        : `Mode Ujian Aktif — ${answeredInList}/${list.length} soal dijawab (pembahasan disembunyikan)`;
    }
  }

  summaryEl.textContent = `Menampilkan ${list.length} dari ${window.PROASN_QUESTIONS.length} soal terkurasi`;

  if (list.length === 0) {
    container.innerHTML = `<div class="info-card" style="text-align:center; padding:32px;"><p class="muted">Tidak ada soal yang cocok dengan filter/pencarian saat ini.</p></div>`;
    return;
  }

  container.innerHTML = list.map((q, listIdx) => {
    const userAns = ansSource[q.id];
    const hasAnswered = userAns !== undefined;
    const showFeedback = isExam ? practiceExamGraded : hasAnswered;
    const isBookmarked = state.bookmarks.includes(q.id);

    return `
      <div class="question-card" id="qcard-${q.id}">
        <div class="q-meta-row">
          <div class="q-badges">
            <span class="badge-blue">No. ${listIdx + 1} • #${q.id} • ${q.category}</span>
            <span class="badge-orange">${q.subtopic}</span>
          </div>
          <button class="bookmark-btn ${isBookmarked ? "saved" : ""}" onclick="toggleBookmark(${q.id})">
            ${isBookmarked ? "★ Tersimpan" : "☆ Bookmark"}
          </button>
        </div>
        <div class="q-text">${q.question}</div>
        <div class="options-list">
          ${q.options.map((opt, idx) => {
            let cls = "option-btn";
            if (showFeedback) {
              if (idx === q.answer) cls += " correct";
              else if (idx === userAns && userAns !== q.answer) cls += " wrong";
            } else if (idx === userAns) {
              cls += " selected";
            }
            const letter = opt.slice(0, 2);
            const body = opt.slice(3);
            return `
              <button class="${cls}" onclick="answerPractice(${q.id}, ${idx})">
                <span class="option-key">${letter}</span>
                <span>${body}</span>
              </button>
            `;
          }).join("")}
        </div>
        ${showFeedback ? `
          <div class="explanation-box">
            <strong>${userAns === q.answer ? "✅ Tepat!" : (q.isPreference ? "📊 Analisis Profil:" : (hasAnswered ? "❌ Kurang Tepat" : "⚪ Tidak Dijawab") + " — Jawaban Terbaik: " + ["A","B","C","D"][q.answer])}</strong>
            <div>${q.explanation}</div>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

function answerPractice(qId, optIdx) {
  if (state.practiceMode === "exam") {
    if (practiceExamGraded) return;
    practiceExamAnswers[qId] = optIdx;
    renderPracticeList();
  } else {
    state.practiceAnswers[qId] = optIdx;
    saveState();
    renderPracticeList();
    renderHomeStats();
    renderAspectAnalysis();
  }
}

function gradePracticeExam() {
  const list = getFilteredPracticeList();
  if (!list.length) return;
  practiceExamGraded = true;

  let correct = 0;
  list.forEach(q => {
    if (practiceExamAnswers[q.id] === q.answer) correct++;
  });
  const pct = Math.round((correct / list.length) * 100);

  const banner = document.getElementById("examScoreBanner");
  banner.classList.remove("hidden");
  banner.innerHTML = `
    <div class="info-card" style="margin-bottom:16px; border-color:var(--primary);">
      <span class="${pct >= 80 ? "badge-green" : "badge-orange"}">Hasil Mode Ujian Bank Soal</span>
      <h3 style="margin-top:6px;">Skor Kamu: ${pct}% (${correct} benar dari ${list.length} soal)</h3>
      <p class="muted" style="margin-top:4px;">Semua kunci jawaban dan pembahasan di bawah sudah dibuka. Gulir ke bawah untuk mereview soal yang masih salah.</p>
    </div>
  `;
  renderPracticeList();
}

function resetPracticeExam() {
  practiceExamAnswers = {};
  practiceExamGraded = false;
  document.getElementById("examScoreBanner")?.classList.add("hidden");
  renderPracticeList();
}

function toggleBookmark(qId) {
  const idx = state.bookmarks.indexOf(qId);
  if (idx >= 0) state.bookmarks.splice(idx, 1);
  else state.bookmarks.push(qId);
  saveState();
  renderPracticeList();
}

// ==================== SIMULASI CAT ====================
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function setCatScope(scope) {
  state.catScope = scope;
  document.querySelectorAll("#catScopeToggle .seg-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.cscope === scope);
  });
  renderCatPackCards();
}

function renderCatPackCards() {
  const el = document.getElementById("catPackCards");
  if (!el) return;

  const bknPacks = [
    { num: 11, label: "BKN Paket 1", tier: "Tier 1 • BKN General (Wajib)", badge: "badge-orange", title: "Paket 1 — ProASN BKN General (A)", desc: "50 soal murni ASN Ahli Pertama Umum: Integritas, Pelayanan Publik, SPBE, MyASN & Silogisme." },
    { num: 12, label: "BKN Paket 2", tier: "Tier 1 • BKN General (Wajib)", badge: "badge-orange", title: "Paket 2 — ProASN BKN General (B)", desc: "50 soal murni ASN Ahli Pertama Umum: Kolaborasi Lintas Unit, Netralitas, UU PDP & Tripatha." },
    { num: 3, label: "BKN Paket 3", tier: "Tier 2 • Sangat Relevan CACT", badge: "badge-blue", title: "Paket 3 — Standar CACT BKN (A)", desc: "50 soal Mansoskul Level 2 instansi pemerintah, silogisme & keamanan siber." },
    { num: 4, label: "BKN Paket 4", tier: "Tier 2 • Sangat Relevan CACT", badge: "badge-blue", title: "Paket 4 — Standar CACT BKN (B)", desc: "50 soal kolaborasi lintas unit, pelayanan publik inklusif & numerik praktis." },
    { num: 5, label: "BKN Paket 5", tier: "Tier 2 • Sangat Relevan CACT", badge: "badge-blue", title: "Paket 5 — Standar CACT BKN (C)", desc: "50 soal pengambilan keputusan berbasis data, adaptasi sistem & AI etis." },
    { num: 6, label: "BKN Paket 6", tier: "Tier 3 • Pengayaan HOTS", badge: "badge-green", title: "Paket 6 — Pengayaan Analitis (A)", desc: "50 soal pengayaan penalaran deduktif, rata-rata tertimbang & problem solving." },
    { num: 7, label: "BKN Paket 7", tier: "Tier 3 • Pengayaan HOTS", badge: "badge-green", title: "Paket 7 — Pengayaan Smart ASN (B)", desc: "50 soal pengayaan literasi digital lanjutan, cloud 3-2-1 & etika medsos." },
    { num: 8, label: "BKN Paket 8", tier: "Tier 3 • Pengayaan HOTS", badge: "badge-green", title: "Paket 8 — Pengayaan EQ & Karier (C)", desc: "50 soal kecerdasan emosional, manajemen konflik & konsistensi karier." },
    { num: 9, label: "BKN Paket 9", tier: "Tier 4 • Referensi Arsip Lama", badge: "badge-purple", title: "Paket 9 — Arsip Klasik BKN (A)", desc: "50 soal referensi pola lama (TKP/Mansoskul & TIU klasik) untuk latihan variasi." },
    { num: 10, label: "BKN Paket 10", tier: "Tier 4 • Referensi Arsip Lama", badge: "badge-purple", title: "Paket 10 — Arsip Klasik BKN (B)", desc: "50 soal referensi arsip untuk melatih stamina membaca & kecepatan CAT." }
  ];

  const bpsPacks = [
    { num: 1, label: "BPS Paket 1", tier: "Tier 1 • Khusus BPS 2026", badge: "badge-orange", title: "BPS Paket 1 — Statistisi Ahli Pertama (A)", desc: "50 soal konteks BPS: Sensus Ekonomi 2026, Mitra Statistik, PST, KBLI & FASIH/CAPI." },
    { num: 2, label: "BPS Paket 2", tier: "Tier 1 • Khusus BPS 2026", badge: "badge-orange", title: "BPS Paket 2 — Statistisi Ahli Pertama (B)", desc: "50 soal konteks BPS: Embargo BRS, Kerahasiaan Mikrodata, Inflasi & TTE BSrE." }
  ];

  const list = state.catScope === "bps" ? bpsPacks : bknPacks;
  el.innerHTML = list.map(p => `
    <div class="tryout-card ${p.tier.includes("Tier 1") ? "featured" : ""}">
      <span class="${p.badge}">${p.tier} • 50 Soal</span>
      <h3>${p.title}</h3>
      <p>${p.desc}</p>
      <button class="btn ${p.tier.includes("Tier 1") ? "btn-primary" : "btn-secondary"} full-width" onclick="startPackTryout(${p.num}, '${p.label}')">Mulai CAT ${p.label} (55 Mnt)</button>
    </div>
  `).join("");
}

function startPackTryout(packNum, customLabel) {
  const pool = window.PROASN_QUESTIONS.filter(q => q.pack === packNum);
  catSession = {
    label: `CAT ${customLabel || "Paket " + packNum} (${pool.length} Soal)`,
    questions: pool,
    answers: {},
    flagged: new Set(),
    currentIndex: 0,
    remainingSec: 55 * 60
  };

  document.getElementById("tryoutLobby").classList.add("hidden");
  document.getElementById("tryoutResult").classList.add("hidden");
  document.getElementById("tryoutActive").classList.remove("hidden");

  renderCatQuestion();
  startCatTimer();
}

function startTryout(count, minutes) {
  // Gunakan 100% soal murni BKN General / ASN Umum (ID >= 501, bebas istilah khusus BPS)
  const pureBkn = (window.PROASN_QUESTIONS || []).filter(q => q.scope === "bkn" && q.id >= 501 && !q.isPreference);
  const pool = shuffle(pureBkn).slice(0, Math.min(count, pureBkn.length));
  const label = count <= 15 ? "Mini Tryout BKN General (15 Soal)" : count <= 30 ? "Tryout Standar BKN (30 Soal)" : `Full Tryout BKN (${pool.length} Soal)`;
  catSession = {
    is5Stage: false,
    label,
    questions: pool,
    answers: {},
    flagged: new Set(),
    currentIndex: 0,
    remainingSec: minutes * 60
  };

  document.getElementById("tryoutLobby").classList.add("hidden");
  document.getElementById("tryoutResult").classList.add("hidden");
  document.getElementById("tryoutActive").classList.remove("hidden");

  renderCatQuestion();
  startCatTimer();
}

// ==================== SIMULASI RESMI 5-TAHAP PROASN 2026 (100% BKN GENERAL + AUTO-NEXT TIMER) ====================
function startOfficial5Stage(mode) {
  const isExact = mode === "exact531";
  // Strictly use pure BKN General / ASN Umum questions (ID >= 501, zero BPS-specific terms)
  const pureBkn = (window.PROASN_QUESTIONS || []).filter(q => q.scope === "bkn" && q.id >= 501);
  const fallbackBkn = (window.PROASN_QUESTIONS || []).filter(q => q.scope === "bkn");

  const potensiPool = isExact
    ? (window.PROASN_OFFICIAL_POTENSI_270 || []).slice()
    : shuffle(window.PROASN_OFFICIAL_POTENSI_270 || pureBkn.filter(q => q.category === "01. Potensi")).slice(0, 30);

  const mansoskulPure = shuffle(pureBkn.filter(q => q.category === "02. Mansoskul"));
  const mansoskulPool = mansoskulPure.length >= (isExact ? 45 : 25)
    ? mansoskulPure.slice(0, isExact ? 45 : 25)
    : [...mansoskulPure, ...shuffle(fallbackBkn.filter(q => q.category === "02. Mansoskul" && q.id < 501))].slice(0, isExact ? 45 : 25);

  const digitalPure = shuffle(pureBkn.filter(q => q.category === "03. Literasi Digital"));
  const digitalPool = digitalPure.length >= (isExact ? 48 : 20)
    ? digitalPure.slice(0, isExact ? 48 : 20)
    : [...digitalPure, ...shuffle(fallbackBkn.filter(q => q.category === "03. Literasi Digital" && q.id < 501))].slice(0, isExact ? 48 : 20);

  const likertOpts = ["A. Sangat Sesuai", "B. Sesuai", "C. Kurang Sesuai", "D. Tidak Sesuai"];
  const riasecPool = isExact
    ? (window.PROASN_OFFICIAL_RIASEC_168 || []).slice()
    : (window.PROASN_RIASEC_ITEMS || []).map(item => ({
        id: item.id,
        category: "Tripatha Karier (RIASEC)",
        subtopic: `Tipe ${item.riasec} (Teori Holland)`,
        riasec: item.riasec,
        isLikert: true,
        question: item.text,
        options: likertOpts
      }));

  const dnaPool = isExact
    ? (window.PROASN_OFFICIAL_DNA_90 || []).slice()
    : (window.PROASN_TALENT_DNA_ITEMS || []).map(item => ({
        id: item.id,
        category: "Talent DNA (ESQ)",
        subtopic: `${item.dim} • ${item.talent}`,
        talent: item.talent,
        dim: item.dim,
        isLikert: true,
        question: item.text,
        options: likertOpts
      }));

  const stages = [
    { name: "Tahap 1/5: Potensi", minutes: isExact ? 56 : 7, questions: potensiPool },
    { name: "Tahap 2/5: Mansoskul (Level 2)", minutes: isExact ? 39 : 16, questions: mansoskulPool },
    { name: "Tahap 3/5: Literasi Digital (Komdigi)", minutes: isExact ? 24 : 10, questions: digitalPool },
    { name: "Tahap 4/5: Tripatha Karier (RIASEC)", minutes: isExact ? 18 : 3, questions: riasecPool },
    { name: "Tahap 5/5: Talent DNA (ESQ)", minutes: isExact ? 15 : 3, questions: dnaPool }
  ];

  catSession = {
    is5Stage: true,
    label: isExact ? "Ujian Resmi ProASN 2026 (531 Soal)" : "Simulasi 5-Tahap Proporsional (123 Soal)",
    stages,
    stageIndex: 0,
    stageAnswers: [{}, {}, {}, {}, {}],
    questions: stages[0].questions,
    answers: {},
    flagged: new Set(),
    currentIndex: 0,
    remainingSec: stages[0].minutes * 60
  };

  document.getElementById("tryoutLobby").classList.add("hidden");
  document.getElementById("tryoutResult").classList.add("hidden");
  document.getElementById("tryoutActive").classList.remove("hidden");

  renderCatQuestion();
  startCatTimer();
}

function advanceOfficialStage(autoTriggered) {
  catSession.stageAnswers[catSession.stageIndex] = { ...catSession.answers };
  if (catSession.stageIndex < catSession.stages.length - 1) {
    catSession.stageIndex++;
    const nextStage = catSession.stages[catSession.stageIndex];
    catSession.questions = nextStage.questions;
    catSession.answers = {};
    catSession.flagged = new Set();
    catSession.currentIndex = 0;
    catSession.remainingSec = nextStage.minutes * 60;
    if (autoTriggered) {
      alert(`⏰ Waktu subtes habis! Sistem otomatis berpindah ke ${nextStage.name}.`);
    }
    renderCatQuestion();
    startCatTimer();
  } else {
    finishOfficial5Stage();
  }
}

function finishOfficial5Stage() {
  clearInterval(catInterval);
  catSession.stageAnswers[catSession.stageIndex] = { ...catSession.answers };
  document.getElementById("tryoutActive").classList.add("hidden");
  const resultEl = document.getElementById("tryoutResult");
  resultEl.classList.remove("hidden");

  // 1. Potensi
  const s0 = catSession.stages[0].questions;
  const a0 = catSession.stageAnswers[0];
  let c0 = 0;
  s0.forEach(q => { if (a0[q.id] === q.answer) c0++; });
  const potPct = s0.length ? Math.round((c0 / s0.length) * 100) : 0;
  const potCat = potPct >= 80 ? "Tinggi" : potPct >= 60 ? "Menengah" : "Rendah";

  // 2. Mansoskul (JPM)
  const s1 = catSession.stages[1].questions;
  const a1 = catSession.stageAnswers[1];
  let c1 = 0;
  s1.forEach(q => { if (a1[q.id] === q.answer) c1++; });
  const mansosPct = s1.length ? Math.round((c1 / s1.length) * 100) : 0;
  const mansosCat = mansosPct >= 90 ? "Optimal (JPM ≥ 90%)" : mansosPct >= 78 ? "Cukup Optimal (78–<90%)" : "Kurang Optimal (<78%)";

  // 3. Literasi Digital (JPM)
  const s2 = catSession.stages[2].questions;
  const a2 = catSession.stageAnswers[2];
  let c2 = 0;
  s2.forEach(q => { if (a2[q.id] === q.answer) c2++; });
  const digPct = s2.length ? Math.round((c2 / s2.length) * 100) : 0;
  const digCat = digPct >= 90 ? "Optimal (JPM ≥ 90%)" : digPct >= 78 ? "Cukup Optimal (78–<90%)" : "Kurang Optimal (<78%)";

  // 4. Tripatha Karier (RIASEC)
  const rScores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  const s3 = catSession.stages[3].questions;
  const a3 = catSession.stageAnswers[3];
  s3.forEach(q => {
    const val = a3[q.id] !== undefined ? (4 - a3[q.id]) : 0; // A=4, B=3, C=2, D=1
    rScores[q.riasec] += val;
  });
  const topRiasec = Object.entries(rScores).sort((x, y) => y[1] - x[1]);
  const riasecCode = topRiasec.slice(0, 3).map(x => x[0]).join(" - ");

  // Aggregate Talent DNA scores by talent name (handles 90-item 2x pass cleanly)
  const dnaMap = {};
  s4.forEach(q => {
    const val = a4[q.id] !== undefined ? (4 - a4[q.id]) : 0;
    if (!dnaMap[q.talent]) dnaMap[q.talent] = { talent: q.talent, dim: q.dim, score: 0 };
    dnaMap[q.talent].score += val;
  });
  const dnaRanked = Object.values(dnaMap).sort((x, y) => y.score - x.score).slice(0, 5);

  // Completion & Speed Analysis
  const totalAll = s0.length + s1.length + s2.length + s3.length + s4.length;
  const answeredAll = Object.keys(a0).length + Object.keys(a1).length + Object.keys(a2).length + Object.keys(a3).length + Object.keys(a4).length;
  const unansweredAll = totalAll - answeredAll;

  // Personal Recommendations Engine
  const recs = [];
  if (unansweredAll > 0) {
    recs.push(`⏱️ <strong>Manajemen Waktu:</strong> Masih ada <strong>${unansweredAll} soal kosong</strong> (bernilai 0 di CAT BKN). Latih ritme cepat: Potensi ~12 dtk/soal, Tripatha ~6 dtk/soal, Talent DNA ~10 dtk/soal.`);
  } else {
    recs.push(`✅ <strong>Kelengkapan Sempurna:</strong> Seluruh ${totalAll} soal berhasil kamu selesaikan tanpa ada yang kosong!`);
  }
  if (potPct < 80) {
    recs.push(`🧠 <strong>Tingkatkan Potensi (${potPct}% → Target Tinggi ≥80%):</strong> Perbanyak latihan Silogisme (Modus Tollens), Deret Bilangan, dan Penalaran Analitis di Bank Soal kategori Potensi.`);
  }
  if (mansosPct < 90) {
    recs.push(`🏛️ <strong>Kejar JPM Optimal Mansoskul (${mansosPct}% → Target ≥90%):</strong> Pelajari kembali Modul 3 (Standar Level 2 PermenPANRB 38/2017). Pilih opsi yang proaktif, persuasif, koordinatif, dan patuh SOP.`);
  }
  if (digPct < 90) {
    recs.push(`💻 <strong>Kejar JPM Optimal Literasi Digital (${digPct}% → Target ≥90%):</strong> Review Modul 4 (4 Pilar Komdigi: Skills, Culture, Ethics, Safety), terutama Zero-Trust phishing, UU PDP, dan etika AI.`);
  }
  if (potPct >= 80 && mansosPct >= 90 && digPct >= 90) {
    recs.push(`🌟 <strong>Kesiapan Sangat Prima!</strong> Seluruh aspek kognitif & kompetensi sudah mencapai kategori <strong>Tinggi / Optimal (JPM ≥ 90%)</strong>. Pertahankan stamina dan konsistensi menjelang Hari-H!`);
  }

  const riasecDesc = {
    R: "Realistic (Praktis/Lapangan)",
    I: "Investigative (Analitis/Data)",
    A: "Artistic (Kreatif/Visual)",
    S: "Social (Pelayanan/Coaching)",
    E: "Enterprising (Kepemimpinan)",
    C: "Conventional (Terstruktur/SOP)"
  };
  const topRiasecMeaning = topRiasec.slice(0, 3).map(x => riasecDesc[x[0]]).join(" • ");

  const avgCognitive = Math.round((potPct + mansosPct + digPct) / 3);
  const nowStr = new Date().toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  state.catHistory.unshift({ label: catSession.label, date: nowStr, total: s0.length + s1.length + s2.length, correct: c0 + c1 + c2, pct: avgCognitive });
  if (state.catHistory.length > 10) state.catHistory.pop();
  saveState();
  renderCatHistory();

  resultEl.innerHTML = `
    <div class="hero-card" style="margin-bottom:20px;">
      <div class="hero-pill">📊 Rapor Hasil & Analisis Resmi ProASN 2026</div>
      <h1>Rata-rata Kesiapan: <span class="accent-text">${avgCognitive}%</span></h1>
      <p class="hero-desc">Terjawab: <strong>${answeredAll}/${totalAll} soal</strong>. Acuan PerBKN No. 26/2019: Optimal (JPM ≥ 90%), Cukup Optimal (78–&lt;90%), Kurang Optimal (&lt; 78%).</p>
      <div class="hero-actions">
        <button class="btn btn-primary" onclick="backToTryoutLobby()">Kembali ke Lobby CAT</button>
        <button class="btn btn-secondary" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
        <button class="btn btn-ghost" onclick="navigateTo('materials')">Review Materi Resmi</button>
      </div>
    </div>

    <div class="stats-grid" style="margin-bottom:20px;">
      <div class="stat-card">
        <div class="stat-label">01. Potensi (${s0.length} Soal)</div>
        <div class="stat-value">${potCat} (${potPct}%)</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${potPct}%"></div></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">02. Mansoskul (${s1.length} Soal)</div>
        <div class="stat-value">${mansosPct}%</div>
        <div class="muted" style="font-size:12px; margin-bottom:6px;">${mansosCat}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${mansosPct}%"></div></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">03. Literasi Digital (${s2.length} Soal)</div>
        <div class="stat-value">${digPct}%</div>
        <div class="muted" style="font-size:12px; margin-bottom:6px;">${digCat}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${digPct}%"></div></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">04. Tripatha (RIASEC)</div>
        <div class="stat-value">${riasecCode}</div>
        <div class="muted" style="font-size:11px;">${topRiasec.map(x => `${x[0]}:${x[1]}`).join(" • ")}</div>
      </div>
    </div>

    <div class="info-card" style="margin-bottom:20px; border-left:4px solid var(--accent);">
      <span class="badge-orange">🎯 Analisis & Rekomendasi Personal Untukmu</span>
      <h3 style="margin:8px 0 10px;">Langkah Tindak Lanjut Sebelum Hari-H</h3>
      <ul style="padding-left:18px; font-size:13.5px; display:flex; flex-direction:column; gap:8px;">
        ${recs.map(r => `<li>${r}</li>`).join("")}
        <li>🧭 <strong>Interpretasi Profil RIASEC (${riasecCode}):</strong> Kecenderungan terkuatmu adalah <em>${topRiasecMeaning}</em>.</li>
      </ul>
    </div>

    <div class="info-card" style="margin-bottom:20px;">
      <span class="badge-green">05. Talent DNA (ESQ) — Top 5 Talenta Dominan</span>
      <h3 style="margin:8px 0 10px;">Kekuatan Alami Dominan Kamu</h3>
      <div class="aspect-list">
        ${dnaRanked.map((t, i) => `
          <div class="history-item">
            <strong>#${i + 1} ${t.talent}</strong>
            <span class="badge-blue">${t.dim}</span>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="section-header" style="margin-top:24px;">
      <h2>Pembahasan & Evaluasi Soal Selesai</h2>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-primary btn-sm" onclick="renderOfficialReview(true)">❌ Hanya yang Salah</button>
        <button class="btn btn-ghost btn-sm" style="border-color:var(--border);" onclick="renderOfficialReview(false)">📋 Semua Soal</button>
      </div>
    </div>
    <div id="officialReviewStack" class="questions-stack"></div>
  `;
  renderOfficialReview(true);
}

function startCatTimer() {
  clearInterval(catInterval);
  updateCatTimerDisplay();
  catInterval = setInterval(() => {
    catSession.remainingSec--;
    updateCatTimerDisplay();
    if (catSession.remainingSec <= 0) {
      clearInterval(catInterval);
      if (catSession.is5Stage) advanceOfficialStage(true);
      else finishTryout();
    }
  }, 1000);
}

function updateCatTimerDisplay() {
  const el = document.getElementById("catTimer");
  if (!el || !catSession) return;
  const m = Math.floor(catSession.remainingSec / 60);
  const s = catSession.remainingSec % 60;
  el.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function renderCatQuestion() {
  const q = catSession.questions[catSession.currentIndex];
  const total = catSession.questions.length;

  const stagePrefix = catSession.is5Stage ? `${catSession.stages[catSession.stageIndex].name} • ` : "";
  document.getElementById("catProgressText").textContent = `${stagePrefix}Soal ${catSession.currentIndex + 1} / ${total}`;

  // Update Pace Hint
  const paceEl = document.getElementById("catPaceHint");
  if (paceEl) {
    const remainingQ = Math.max(1, total - Object.keys(catSession.answers).length);
    const secPerQ = Math.max(1, Math.round(catSession.remainingSec / remainingQ));
    paceEl.textContent = `⚡ Sisa ritme ideal: ~${secPerQ} dtk/soal`;
  }
  document.getElementById("catMetaRow").innerHTML = `
    <div class="q-badges">
      <span class="badge-blue">${q.category}</span>
      <span class="badge-orange">${q.subtopic}</span>
    </div>
  `;
  document.getElementById("catQuestionText").textContent = q.question;

  const selected = catSession.answers[q.id];
  document.getElementById("catOptionsList").innerHTML = q.options.map((opt, idx) => `
    <button class="option-btn ${selected === idx ? "selected" : ""}" onclick="selectCatOption(${q.id}, ${idx})">
      <span class="option-key">${opt.slice(0, 2)}</span>
      <span>${opt.slice(3)}</span>
    </button>
  `).join("");

  document.getElementById("catPrevBtn").disabled = catSession.currentIndex === 0;
  const isLastOfStage = catSession.currentIndex === total - 1;
  document.getElementById("catNextBtn").textContent = isLastOfStage
    ? (catSession.is5Stage && catSession.stageIndex < catSession.stages.length - 1 ? "Lanjut Subtes Berikutnya →" : "Selesai & Lihat Rapor")
    : "Selanjutnya →";

  renderCatGrid();
}

function renderCatGrid() {
  const grid = document.getElementById("catNumGrid");
  grid.innerHTML = catSession.questions.map((q, idx) => {
    let cls = "cat-num-btn";
    if (idx === catSession.currentIndex) cls += " current";
    if (catSession.flagged.has(q.id)) cls += " flagged";
    else if (catSession.answers[q.id] !== undefined) cls += " answered";
    return `<button class="${cls}" onclick="catJump(${idx})">${idx + 1}</button>`;
  }).join("");
}

function selectCatOption(qId, optIdx) {
  catSession.answers[qId] = optIdx;
  renderCatQuestion();
}

function catToggleFlag() {
  const q = catSession.questions[catSession.currentIndex];
  if (catSession.flagged.has(q.id)) catSession.flagged.delete(q.id);
  else catSession.flagged.add(q.id);
  renderCatGrid();
}

function catPrev() {
  if (catSession.currentIndex > 0) {
    catSession.currentIndex--;
    renderCatQuestion();
  }
}

function catNext() {
  if (catSession.currentIndex < catSession.questions.length - 1) {
    catSession.currentIndex++;
    renderCatQuestion();
  } else {
    finishTryoutConfirm();
  }
}

function catJump(idx) {
  catSession.currentIndex = idx;
  renderCatQuestion();
}

function finishTryoutConfirm() {
  const answered = Object.keys(catSession.answers).length;
  const total = catSession.questions.length;
  if (catSession.is5Stage) {
    const isLastStage = catSession.stageIndex === catSession.stages.length - 1;
    const msg = isLastStage
      ? `Kamu menjawab ${answered}/${total} soal di tahap terakhir. Selesaikan dan lihat Rapor Resmi ProASN?`
      : `Kamu menjawab ${answered}/${total} soal di subtes ini. Lanjut ke subtes berikutnya? (Tidak bisa kembali ke subtes ini)`;
    if (!confirm(msg)) return;
    advanceOfficialStage(false);
    return;
  }
  if (answered < total) {
    if (!confirm(`Kamu baru menjawab ${answered} dari ${total} soal. Yakin ingin mengakhiri simulasi sekarang?`)) return;
  }
  finishTryout();
}

function finishTryout() {
  clearInterval(catInterval);
  document.getElementById("tryoutActive").classList.add("hidden");
  const resultEl = document.getElementById("tryoutResult");
  resultEl.classList.remove("hidden");

  let correct = 0;
  const byCat = {};
  catSession.questions.forEach(q => {
    if (!byCat[q.category]) byCat[q.category] = { total: 0, correct: 0 };
    byCat[q.category].total++;
    if (catSession.answers[q.id] === q.answer) {
      correct++;
      byCat[q.category].correct++;
    }
  });

  const total = catSession.questions.length;
  const scorePct = Math.round((correct / total) * 100);

  // Save to CAT history
  const nowStr = new Date().toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  state.catHistory.unshift({ label: catSession.label, date: nowStr, total, correct, pct: scorePct });
  if (state.catHistory.length > 10) state.catHistory.pop();
  saveState();
  renderCatHistory();

  const verdict = scorePct >= 85
    ? "🌟 Sangat Siap! Profil kamu sangat kuat untuk Kuadran Talenta Optimal."
    : scorePct >= 70
      ? "👍 Cukup Siap! Tingkatkan lagi akurasi pada aspek yang masih di bawah 80%."
      : "📚 Perlu Latihan Lagi! Pelajari kembali modul materi dan ulangi simulasi.";

  resultEl.innerHTML = `
    <div class="hero-card" style="margin-bottom:20px;">
      <div class="hero-pill">📊 Rapor Hasil Simulasi CAT</div>
      <h1>Skor Kesiapan: <span class="accent-text">${scorePct}%</span> (${correct}/${total})</h1>
      <p class="hero-desc">${verdict}</p>
      <div class="hero-actions">
        <button class="btn btn-primary" onclick="backToTryoutLobby()">Ulangi Simulasi</button>
        <button class="btn btn-ghost" onclick="navigateTo('materials')">Pelajari Materi</button>
      </div>
    </div>

    <div class="stats-grid" style="margin-bottom:20px;">
      ${Object.entries(byCat).map(([cat, stat]) => {
        const pct = Math.round((stat.correct / stat.total) * 100);
        return `
          <div class="stat-card">
            <div class="stat-label">${cat}</div>
            <div class="stat-value">${stat.correct}/${stat.total} (${pct}%)</div>
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          </div>
        `;
      }).join("")}
    </div>

    <div class="section-header"><h2>Pembahasan Lengkap Simulasi</h2></div>
    <div class="questions-stack">
      ${catSession.questions.map((q, idx) => {
        const uAns = catSession.answers[q.id];
        const isCorrect = uAns === q.answer;
        return `
          <div class="question-card">
            <div class="q-meta-row">
              <div class="q-badges">
                <span class="${isCorrect ? "badge-green" : "badge-orange"}">${isCorrect ? "✓ Benar" : "✗ Perlu Review"} • No. ${idx + 1}</span>
                <span class="badge-blue">${q.category}</span>
              </div>
            </div>
            <div class="q-text">${q.question}</div>
            <p style="font-size:13px; margin-bottom:8px;">
              <strong>Jawabanmu:</strong> ${uAns !== undefined ? q.options[uAns] : "<em>Tidak dijawab</em>"}<br/>
              <strong>Jawaban Terbaik:</strong> ${q.options[q.answer]}
            </p>
            <div class="explanation-box">
              <strong>Pembahasan:</strong>
              <div>${q.explanation}</div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function toggleScratchpad() {
  document.getElementById("catScratchpad")?.classList.toggle("hidden");
}

function renderOfficialReview(onlyWrong) {
  const container = document.getElementById("officialReviewStack");
  if (!container || !catSession) return;
  const reviewable = [];
  [0, 1, 2].forEach(sIdx => {
    const qs = catSession.stages[sIdx].questions;
    const ans = catSession.stageAnswers[sIdx];
    qs.forEach((q, i) => {
      const uAns = ans[q.id];
      const isCorrect = uAns === q.answer;
      if (onlyWrong && isCorrect) return;
      reviewable.push({ stage: catSession.stages[sIdx].name, num: i + 1, q, uAns, isCorrect });
    });
  });

  if (reviewable.length === 0) {
    container.innerHTML = `<div class="info-card" style="text-align:center;"><p class="muted">🎉 Tidak ada jawaban salah pada 3 aspek kognitif/kompetensi!</p></div>`;
    return;
  }

  container.innerHTML = reviewable.slice(0, 100).map(item => `
    <div class="question-card">
      <div class="q-meta-row">
        <div class="q-badges">
          <span class="${item.isCorrect ? "badge-green" : "badge-orange"}">${item.isCorrect ? "✓ Benar" : "✗ Perlu Review"} • ${item.stage} #${item.num}</span>
          <span class="badge-blue">${item.q.subtopic || item.q.category}</span>
        </div>
      </div>
      <div class="q-text">${item.q.question}</div>
      <p style="font-size:13px; margin-bottom:8px;">
        <strong>Jawabanmu:</strong> ${item.uAns !== undefined ? item.q.options[item.uAns] : "<em>Tidak dijawab (0)</em>"}<br/>
        <strong>Jawaban Terbaik:</strong> ${item.q.options[item.q.answer]}
      </p>
      <div class="explanation-box">
        <strong>Pembahasan:</strong>
        <div>${item.q.explanation || "Pilih opsi yang paling selaras dengan standar kompetensi Level 2 & logika premis."}</div>
      </div>
    </div>
  `).join("");
}

function backToTryoutLobby() {
  document.getElementById("tryoutResult").classList.add("hidden");
  document.getElementById("tryoutLobby").classList.remove("hidden");
}

// ==================== TIPS & CHECKLIST ====================
function renderTipsAndChecklist() {
  const tipsEl = document.getElementById("tipsContainer");
  if (tipsEl) {
    tipsEl.innerHTML = window.PROASN_TIPS.map(t => `
      <div class="tip-card">
        <span class="${t.badgeClass}">${t.badge}</span>
        <h3>${t.title}</h3>
        <ul>${t.points.map(p => `<li>${p}</li>`).join("")}</ul>
      </div>
    `).join("");
  }

  const chkEl = document.getElementById("checklistContainer");
  if (chkEl) {
    chkEl.innerHTML = window.PROASN_CHECKLIST.map(item => {
      const done = state.checklist.includes(item.id);
      return `
        <label class="check-row ${done ? "done" : ""}">
          <input type="checkbox" ${done ? "checked" : ""} onchange="toggleChecklist('${item.id}')" />
          <span>${item.text}</span>
        </label>
      `;
    }).join("");
  }
}

function toggleChecklist(id) {
  const idx = state.checklist.indexOf(id);
  if (idx >= 0) state.checklist.splice(idx, 1);
  else state.checklist.push(id);
  saveState();
  renderTipsAndChecklist();
  renderHomeStats();
}

// ==================== BOOT ====================
function renderAll() {
  renderHomeStats();
  renderAspectAnalysis();
  renderCatHistory();
  renderCatPackCards();
  setMaterialMode(state.materialMode || "full");
  renderPracticeFilters();
  setPracticeMode(state.practiceMode || "study");
  renderTipsAndChecklist();
}

// Enable smooth mouse drag-to-scroll & mouse-wheel horizontal scroll on .pill-filter
function initHorizontalDragScroll() {
  document.querySelectorAll(".pill-filter").forEach(el => {
    if (el.dataset.dragInit) return;
    el.dataset.dragInit = "1";

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let moved = false;

    el.addEventListener("mousedown", e => {
      isDown = true;
      moved = false;
      el.classList.add("dragging");
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
    });

    window.addEventListener("mouseup", () => {
      if (!isDown) return;
      isDown = false;
      el.classList.remove("dragging");
    });

    el.addEventListener("mousemove", e => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.4;
      if (Math.abs(walk) > 5) moved = true;
      el.scrollLeft = scrollLeft - walk;
    });

    // Prevent accidental click right after dragging
    el.addEventListener("click", e => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    }, true);

    // Support vertical mouse wheel to scroll horizontally
    el.addEventListener("wheel", e => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initQuestionBank();
  loadState();
  document.getElementById("themeToggle")?.addEventListener("click", toggleTheme);
  updateCountdown();
  setInterval(updateCountdown, 30000);
  renderAll();
  initHorizontalDragScroll();
});
