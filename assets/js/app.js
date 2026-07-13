/* =====================================================================
   推しビジュ6選 — アプリ本体
   ・プレビューと保存画像は「同じ描画関数(drawDesign)」を共用
     → プレビューCanvas(1200×1200)をCSSで縮小表示しているだけなので、
       写真位置・ラベル位置・名前位置が保存画像とズレることはない
   ・結果画像デザインは scrap / archive / idcard の3種類
   ・背景テーマ選択・ポエム風テキスト・白手書きラベルは削除済み
   ===================================================================== */
(function () {
"use strict";

/* ---------- データ ---------- */
/* 公式番号は最終審査の呼び出し順(公式サイト掲載順)。bday は誕生日 MMDD。 */
var members = [
  { id: "kairyu", name: "KAIRYU", no: "01", bday: "1022" },
  { id: "naoya",  name: "NAOYA",  no: "02", bday: "0428" },
  { id: "ran",    name: "RAN",    no: "03", bday: "0823" },
  { id: "seito",  name: "SEITO",  no: "04", bday: "1226" },
  { id: "ryuki",  name: "RYUKI",  no: "05", bday: "1004" },
  { id: "takuto", name: "TAKUTO", no: "06", bday: "1028" },
  { id: "hayato", name: "HAYATO", no: "07", bday: "0101" },
  { id: "eiki",   name: "EIKI",   no: "08", bday: "1206" }
];

/* テーマの並び順(固定):
   上段左: 沼落ち / 上段中央: 最愛 / 上段右: かわいい
   下段左: かっこいい / 下段中央: ずるい / 下段右: 殿堂入り */
var themes = [
  { id: "numa",   label: "沼落ちビジュ" },
  { id: "best",   label: "今の最愛ビジュ" },
  { id: "cute",   label: "かわいい" },
  { id: "cool",   label: "かっこいい" },
  { id: "zurui",  label: "ずるい" },
  { id: "legend", label: "殿堂入り" }
];

/* 結果画像デザイン(3種類) */
var designs = [
  { id: "scrap",   label: "スクラップ",  hint: "紙もの・マステ・推し活ノートっぽい甘めデザイン" },
  { id: "archive", label: "アーカイブ",  hint: "雑誌の誌面みたいな、きれいめアーカイブカード" },
  { id: "idcard",  label: "証明写真",    hint: "プロフィール登録シート風のドキュメントデザイン" }
];

var IMAGE_COUNT = 20;
var IMAGE_ORDER_DESCENDING = true;

/* ---------- 状態 ---------- */
var currentMemberId = "kairyu";
var currentDesignId = "scrap";
var currentThemeId = null;
var selectedImages = createEmptySelection();
var lastFocused = null;

/* ---------- 要素 ---------- */
var memberTags = document.getElementById("memberTags");
var designChips = document.getElementById("designChips");
var designHint = document.getElementById("designHint");
var themeList = document.getElementById("themeList");
var previewCanvas = document.getElementById("previewCanvas");
var saveBtn = document.getElementById("saveBtn");
var statusEl = document.getElementById("status");
var progressEl = document.getElementById("progress");
var photoModal = document.getElementById("photoModal");
var modalTitle = document.getElementById("modalTitle");
var modalPhotoGrid = document.getElementById("modalPhotoGrid");
var uploadInput = document.getElementById("uploadInput");
var modalUploadBtn = document.getElementById("modalUploadBtn");
var closeButton = photoModal.querySelector(".close-button");
var tapeB = document.getElementById("tapeB");
var userNameInput = document.getElementById("userNameInput");
var saveFallback = document.getElementById("saveFallback");
var fallbackImage = document.getElementById("fallbackImage");
var fallbackClose = document.getElementById("fallbackClose");

init();

function init() {
  renderMemberTags();
  renderDesignChips();
  renderThemeCards();
  schedulePreview();

  userNameInput.addEventListener("input", schedulePreview);
  saveBtn.addEventListener("click", saveResultImage);
  modalUploadBtn.addEventListener("click", function(){ uploadInput.click(); });
  uploadInput.addEventListener("change", handleUploadFromInput);
  closeButton.addEventListener("click", closeModal);
  photoModal.addEventListener("click", function (e) {
    if (e.target === photoModal) closeModal();
  });
  fallbackClose.addEventListener("click", function(){ saveFallback.classList.remove("active"); });
  saveFallback.addEventListener("click", function (e) {
    if (e.target === saveFallback) saveFallback.classList.remove("active");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (photoModal.classList.contains("active")) closeModal();
    if (saveFallback.classList.contains("active")) saveFallback.classList.remove("active");
  });

  // フォントが読み込めたらプレビューを描き直す(字形が変わるため)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(schedulePreview);
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: .1 });
    document.querySelectorAll(".settle").forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll(".settle").forEach(function (el) { el.classList.add("in"); });
  }
}

function createEmptySelection() {
  var empty = {};
  themes.forEach(function (t) { empty[t.id] = null; });
  return empty;
}
function getCurrentMember() {
  return members.find(function (m) { return m.id === currentMemberId; }) || members[0];
}
/* 表示名: 自由入力があればそれを優先。空欄なら選択中のメンバー名。 */
function getDisplayName() {
  var free = userNameInput.value.trim();
  return free || getCurrentMember().name;
}
function isFreeNameUsed() {
  return userNameInput.value.trim().length > 0;
}

/* ---------- メンバー名札 ---------- */
function renderMemberTags() {
  memberTags.innerHTML = "";
  members.forEach(function (m) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "tag";
    b.textContent = m.name;
    b.setAttribute("aria-pressed", m.id === currentMemberId ? "true" : "false");
    b.addEventListener("click", function () {
      if (m.id === currentMemberId) return;
      currentMemberId = m.id;
      currentThemeId = null;
      selectedImages = createEmptySelection(); // 切替でリセット(現行仕様)
      renderMemberTags();
      renderThemeCards();
      schedulePreview();
      setStatus(m.name + " の6枚をつくる", true);
    });
    memberTags.appendChild(b);
  });
}

/* ---------- デザインチップ ---------- */
function renderDesignChips() {
  designChips.innerHTML = "";
  designs.forEach(function (d) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = d.label;
    b.setAttribute("aria-pressed", d.id === currentDesignId ? "true" : "false");
    b.addEventListener("click", function () {
      currentDesignId = d.id;
      renderDesignChips();
      schedulePreview();
    });
    designChips.appendChild(b);
  });
  var cur = designs.find(function (d) { return d.id === currentDesignId; });
  designHint.textContent = cur ? cur.hint : "";
}

/* ---------- 位置調整(プレビューと保存で同じ値を使用) ---------- */
function adjustDefaults(s) {
  s = s || {};
  return {
    posX: s.posX !== undefined ? s.posX : 50,
    posY: s.posY !== undefined ? s.posY : 20,
    scale: s.scale !== undefined ? s.scale : 100
  };
}
function getImageAdjustStyle(selected) {
  if (!selected || selected.type !== "upload") return "";
  var a = adjustDefaults(selected);
  return "object-position:" + a.posX + "% " + a.posY + "%;transform:scale(" + (a.scale / 100) + ");";
}

/* ---------- 台紙(6枠) ---------- */
function renderThemeCards() {
  themeList.innerHTML = "";
  themes.forEach(function (theme) {
    var selected = selectedImages[theme.id];
    var card = document.createElement("article");
    card.className = "frame";

    var slot = document.createElement("div");
    slot.className = "frame-slot";
    if (selected && selected.src) {
      var mp = document.createElement("button");
      mp.type = "button";
      mp.className = "mini-print";
      mp.setAttribute("aria-label", theme.label + " の写真を変える");
      var im = document.createElement("img");
      im.src = selected.src;
      im.alt = theme.label + " 選択中";
      var st = getImageAdjustStyle(selected);
      if (st) im.style.cssText = st;
      mp.appendChild(im);
      mp.addEventListener("click", function(){ openModal(theme.id); });
      slot.appendChild(mp);
    } else {
      var emp = document.createElement("button");
      emp.type = "button";
      emp.className = "empty";
      emp.innerHTML = "ここに<br>1枚";
      emp.setAttribute("aria-label", theme.label + " の写真を選ぶ");
      emp.addEventListener("click", function(){ openModal(theme.id); });
      slot.appendChild(emp);
    }

    var body = document.createElement("div");
    body.className = "frame-body";
    body.innerHTML =
      "<h3>" + theme.label + "</h3>" +
      '<p class="state">' + (selected ? (selected.type === "upload" ? "アップロード画像を選択中" : "選択中") : "まだえらんでない") + "</p>";

    var actions = document.createElement("div");
    actions.className = "frame-actions";

    var pick = document.createElement("button");
    pick.type = "button";
    pick.className = "btn primary";
    pick.textContent = "候補から選ぶ";
    pick.addEventListener("click", function(){ openModal(theme.id); });

    var up = document.createElement("button");
    up.type = "button";
    up.className = "btn";
    up.textContent = "画像をアップロード";
    up.addEventListener("click", function(){
      currentThemeId = theme.id;
      uploadInput.click();
    });

    actions.appendChild(pick);
    actions.appendChild(up);

    if (selected) {
      var clr = document.createElement("button");
      clr.type = "button";
      clr.className = "btn quiet";
      clr.textContent = "リセット";
      clr.addEventListener("click", function(){
        selectedImages[theme.id] = null;
        renderThemeCards();
        schedulePreview();
      });
      actions.appendChild(clr);
    }
    body.appendChild(actions);

    var adjust = document.createElement("div");
    adjust.className = "adjust" + (selected && selected.type === "upload" ? " is-visible" : "");
    if (selected && selected.type === "upload") {
      buildSliders(adjust, theme.id);
    }
    body.appendChild(adjust);

    card.appendChild(slot);
    card.appendChild(body);
    themeList.appendChild(card);
  });
  updateProgress();
}

function buildSliders(container, themeId) {
  var rows = [
    { key: "posX",  label: "左右位置",  min: 0,  max: 100 },
    { key: "posY",  label: "上下位置",  min: 0,  max: 100 },
    { key: "scale", label: "拡大・縮小", min: 80, max: 180 }
  ];
  rows.forEach(function (row) {
    var wrap = document.createElement("div");
    var label = document.createElement("label");
    var name = document.createElement("span");
    name.textContent = row.label;
    var val = document.createElement("span");
    var input = document.createElement("input");
    input.type = "range";
    input.min = row.min;
    input.max = row.max;
    input.setAttribute("aria-label", row.label);
    var cur = adjustDefaults(selectedImages[themeId])[row.key];
    input.value = cur;
    val.textContent = cur + "%";
    input.addEventListener("input", function () {
      var v = Number(input.value);
      val.textContent = v + "%";
      if (selectedImages[themeId]) {
        selectedImages[themeId][row.key] = v;
        updateThumbFor(themeId);
        schedulePreview();
      }
    });
    label.appendChild(name);
    label.appendChild(val);
    wrap.appendChild(label);
    wrap.appendChild(input);
    container.appendChild(wrap);
  });
}

function updateThumbFor(themeId) {
  var idx = themes.findIndex(function (t) { return t.id === themeId; });
  var card = themeList.children[idx];
  if (!card) return;
  var img = card.querySelector(".mini-print img");
  var s = selectedImages[themeId];
  if (img && s) img.style.cssText = getImageAdjustStyle(s);
}

function updateProgress() {
  var filled = themes.filter(function (t) { return !!selectedImages[t.id]; }).length;
  var left = themes.length - filled;
  if (left === 0) {
    progressEl.textContent = "ぜんぶ揃った！";
    progressEl.classList.add("done");
  } else {
    progressEl.textContent = "あと" + left + "枠";
    progressEl.classList.remove("done");
  }
}

/* ---------- 候補モーダル ---------- */
function openModal(themeId) {
  currentThemeId = themeId;
  lastFocused = document.activeElement;
  var theme = themes.find(function (t) { return t.id === themeId; });
  modalTitle.textContent = theme.label + "を選ぶ";
  renderModalPhotoGrid();
  photoModal.classList.add("active");
  closeButton.focus();
}
function closeModal() {
  photoModal.classList.remove("active");
  modalPhotoGrid.innerHTML = "";
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}
function renderModalPhotoGrid() {
  if (!currentThemeId) return;
  modalPhotoGrid.innerHTML = "";
  var selected = selectedImages[currentThemeId];
  var numbers = [];
  for (var i = 1; i <= IMAGE_COUNT; i++) numbers.push(String(i).padStart(2, "0"));
  if (IMAGE_ORDER_DESCENDING) numbers.reverse();

  numbers.forEach(function (number) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "photo-option";
    var img = document.createElement("img");
    img.src = "images/" + currentMemberId + "/" + number + ".jpg";
    img.alt = getCurrentMember().name + " " + number;
    img.loading = "lazy";
    img.onerror = function () {
      if (!img.dataset.fallbackTried) {
        img.dataset.fallbackTried = "true";
        img.src = "images/" + currentMemberId + "/" + number + ".png";
      } else {
        button.style.display = "none";
      }
    };
    if (selected && selected.src && selected.src.indexOf("/images/" + currentMemberId + "/" + number + ".") !== -1) {
      button.classList.add("is-selected");
    }
    button.appendChild(img);
    button.addEventListener("click", function () {
      selectedImages[currentThemeId] = { src: img.currentSrc || img.src, type: "preset" };
      renderThemeCards();
      schedulePreview();
      closeModal();
    });
    modalPhotoGrid.appendChild(button);
  });
}

/* ---------- アップロード(自動縮小つき: 長辺2048px) ---------- */
function handleUploadFromInput(event) {
  var file = event.target.files && event.target.files[0];
  uploadInput.value = "";
  if (!file || !currentThemeId) return;
  if (!file.type || file.type.indexOf("image/") !== 0) {
    setStatus("画像ファイルを選んでください。");
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    setStatus("画像が大きすぎます（20MBまで）。");
    return;
  }
  var reader = new FileReader();
  reader.onerror = function () { setStatus("画像の読み込みに失敗しました。"); };
  reader.onload = function () {
    var img = new Image();
    img.onerror = function () { setStatus("画像を開けませんでした。別の画像でお試しください。"); };
    img.onload = function () {
      var MAX = 2048; // スマホの大きい写真はここで縮小(メモリ・保存失敗対策)
      var src = reader.result;
      var longest = Math.max(img.naturalWidth, img.naturalHeight);
      if (longest > MAX) {
        var r = MAX / longest;
        var c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * r);
        c.height = Math.round(img.naturalHeight * r);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        src = c.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.92);
      }
      selectedImages[currentThemeId] = { src: src, type: "upload", posX: 50, posY: 20, scale: 100 };
      renderThemeCards();
      schedulePreview();
      closeModal();
      setStatus("読み込みました。位置と大きさを調整できます。", true);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/* =====================================================================
   ここから結果画像の描画。
   プレビュー(schedulePreview → renderInto(previewCanvas))と
   保存(createResultCanvas)は同じ drawDesign() を呼ぶだけなのでズレない。
   ===================================================================== */

var W = 1200, H = 1200;

/* フォント指定(Canvas用)。Webフォント読込前でも近い系統に落ちる。 */
/* フォントは4ファミリーに統一(index.html の CSS変数と同一の定義)
   - 日本語メイン: Zen Kaku Gothic New
   - 日本語手書き風: Klee One
   - 欧文サンセリフ: Montserrat
   - 欧文セリフ(英字専用): DM Serif Display
   日本語を DM Serif Display / Georgia / Times で描画しないこと。 */
var F = {
  /* 結果画像内の日本語はすべて「花とちょうちょ」。
     フォント未収録の文字(自由入力の珍しい漢字など)は
     字単位で Zen Kaku Gothic New にフォールバックする。
     ※操作画面UIのフォントは index.html 側のCSS変数で管理(花とちょうちょ不使用) */
  jp:      "'HanaToChoucho','Zen Kaku Gothic New','Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif",
  jpHand:  "'HanaToChoucho','Klee One','Zen Kaku Gothic New',sans-serif",
  /* UI寄りの手書き風(花とちょうちょは含めない) */
  jpKlee:  "'Klee One','Zen Kaku Gothic New','Hiragino Sans',sans-serif",
  en:      "'Montserrat','Helvetica Neue',Arial,sans-serif",
  enSerif: "'DM Serif Display',Georgia,serif"
};
/* 旧名エイリアス(既存コード互換) */
F.gothic = F.jp;
F.hand   = F.jpKlee;
F.mincho = F.jp;      /* 明朝は廃止 → 日本語ゴシックへ */
F.serif  = F.enSerif; /* 欧文専用 */
F.script = F.enSerif;
F.mono   = F.en;

/* 日本語を含むか(ひらがな/カタカナ/漢字/長音) */
function containsJapanese(t) {
  return /[\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF\u3005\u30FC]/.test(t);
}
/* 推し名用フォントテンプレート:
   英字のみ → DM Serif Display 400 / 日本語を含む → Zen Kaku Gothic New 600 */
function nameFontTpl() {
  return containsJapanese(getDisplayName())
    ? "600 {S}px " + F.jp
    : "400 {S}px " + F.enSerif;
}
/* Canvasの字間(未対応ブラウザでは無視され、フォント自体は正しく出る) */
function setLS(ctx, px) {
  try { ctx.letterSpacing = px + "px"; } catch (e) {}
}

/* ---------- 画像キャッシュ ---------- */
var imageCache = {};
function loadCanvasImage(src) {
  if (!src) return Promise.resolve(null);
  if (imageCache[src]) return imageCache[src];
  imageCache[src] = new Promise(function (resolve) {
    var image = new Image();
    image.onload = function(){ resolve(image); };
    image.onerror = function(){ resolve(null); };
    image.src = src;
  });
  return imageCache[src];
}

/* ---------- プレビューの再描画(連打対策つき) ---------- */
var previewToken = 0;
var previewQueued = false;
function schedulePreview() {
  if (previewQueued) return;
  previewQueued = true;
  window.requestAnimationFrame(function () {
    previewQueued = false;
    var token = ++previewToken;
    renderInto(previewCanvas).catch(function(){}).then(function () {
      // 古い描画要求は上書きされるだけなのでここでは何もしない
      void token;
    });
  });
}

async function renderInto(canvas) {
  var ctx = canvas.getContext("2d");
  await ensureFonts();
  var imgs = await loadSelectedImages();
  drawDesign(ctx, currentDesignId, imgs);
}

/* Canvasに描く日本語をすべて含んだサンプル文字列。
   Google Fontsの日本語フォントは unicode-range で分割配信されるため、
   fonts.load() に実際の文字を渡さないと日本語サブセットが
   ダウンロードされず、Canvas描画が型崩れする。 */
var JP_SAMPLE = "推しビジュ6選沼落ち今の最愛かわいいかっこいいずるい殿堂入り未選択";
/* 花とちょうちょ用: スクラップの写真下6ラベルに出る文字 */
var HANA_SAMPLE = "沼落ちビジュ今の最愛かわいこずる殿堂入り";

async function ensureFonts() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.all([
      document.fonts.load("400 80px 'Zen Kaku Gothic New'", JP_SAMPLE),
      document.fonts.load("500 80px 'Zen Kaku Gothic New'", JP_SAMPLE),
      document.fonts.load("700 80px 'Zen Kaku Gothic New'", JP_SAMPLE),
      document.fonts.load("400 60px 'Klee One'", JP_SAMPLE),
      document.fonts.load("600 60px 'Klee One'", JP_SAMPLE),
      document.fonts.load("400 60px 'HanaToChoucho'", JP_SAMPLE + HANA_SAMPLE),
      document.fonts.load("500 40px 'Montserrat'", "MY VISUAL 6"),
      document.fonts.load("600 40px 'Montserrat'", "MY VISUAL 6"),
      document.fonts.load("700 40px 'Montserrat'", "PROFILE SNAP CARD"),
      document.fonts.load("400 150px 'DM Serif Display'", "MY VISUAL 6")
    ]);
    /* 分割サブセットの取りこぼし対策として、全フォントの読込完了も待つ */
    if (document.fonts.ready) await document.fonts.ready;
  } catch (e) { /* 読めなくてもフォールバックで描画 */ }
}

function loadSelectedImages() {
  return Promise.all(themes.map(function (theme) {
    var s = selectedImages[theme.id];
    return s && s.src ? loadCanvasImage(s.src) : Promise.resolve(null);
  }));
}

/* ---------- 共通描画ヘルパー ---------- */
function roundedRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* 写真をカバー配置で描く。アップロード画像は posX/posY/scale を反映。
   プリセット画像は「上寄せカバー」(既存挙動)。 */
function drawCoverImage(ctx, image, x, y, w, h, selected, radius, placeholderColor) {
  ctx.save();
  if (radius > 0) { roundedRectPath(ctx, x, y, w, h, radius); ctx.clip(); }
  else { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); }
  if (!image) {
    ctx.fillStyle = placeholderColor || "#eee4d8";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(64,56,47,.35)";
    ctx.font = "500 " + Math.round(Math.min(w, h) * 0.11) + "px " + F.jp;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("未選択", x + w / 2, y + h / 2);
    ctx.restore();
    return;
  }
  var a;
  if (selected && selected.type === "upload") a = adjustDefaults(selected);
  else a = { posX: 50, posY: 0, scale: 100 };
  var base = Math.max(w / image.naturalWidth, h / image.naturalHeight) * (a.scale / 100);
  var dw = image.naturalWidth * base;
  var dh = image.naturalHeight * base;
  var dx = x + (w - dw) * (a.posX / 100);
  var dy = y + (h - dh) * (a.posY / 100);
  ctx.drawImage(image, dx, dy, dw, dh);
  ctx.restore();
}

/* マスキングテープ */
function drawTape(ctx, cx, cy, w, h, deg, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(deg * Math.PI / 180);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = color;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* 円形スタンプ(円周に沿った文字つき) */
function drawStamp(ctx, cx, cy, r, color, topText, centerDraw) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, r - 8, 0, Math.PI * 2); ctx.stroke();
  // 上半分の円弧テキスト
  var chars = topText.split("");
  var fs = Math.round(r * 0.26);
  ctx.font = "700 " + fs + "px " + F.gothic;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  var arc = Math.PI * 1.15;
  var start = -Math.PI / 2 - arc / 2;
  chars.forEach(function (ch, i) {
    var ang = start + arc * (chars.length === 1 ? 0.5 : i / (chars.length - 1));
    ctx.save();
    ctx.rotate(ang + Math.PI / 2);
    ctx.fillText(ch, 0, -(r - 22));
    ctx.restore();
  });
  if (centerDraw) centerDraw(ctx, r);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* バーコード(文字列から決定的に生成) */
function drawBarcode(ctx, seedStr, x, y, w, h, color) {
  var seed = 0;
  for (var i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  ctx.save();
  ctx.fillStyle = color || "#3c352c";
  var cx = x;
  while (cx < x + w) {
    var bw = 2 + Math.floor(rnd() * 5);
    if (rnd() > 0.42) ctx.fillRect(cx, y, Math.min(bw, x + w - cx), h);
    cx += bw + 2;
  }
  ctx.restore();
}

/* ハート */
function drawHeart(ctx, cx, cy, size, color, alpha) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 30, size / 30);
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 9);
  ctx.bezierCurveTo(-1, 4, -14, -2, -14, -9);
  ctx.bezierCurveTo(-14, -16, -6, -17, 0, -10);
  ctx.bezierCurveTo(6, -17, 14, -16, 14, -9);
  ctx.bezierCurveTo(14, -2, 1, 4, 0, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* キラキラ(4方向スパークル) */
function drawSparkle(ctx, cx, cy, r, color, alpha) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r * 0.14, -r * 0.14, r, 0);
  ctx.quadraticCurveTo(r * 0.14, r * 0.14, 0, r);
  ctx.quadraticCurveTo(-r * 0.14, r * 0.14, -r, 0);
  ctx.quadraticCurveTo(-r * 0.14, -r * 0.14, 0, -r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function formatDate(d) {
  return d.getFullYear() + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + String(d.getDate()).padStart(2, "0");
}
/* IDコード: MZ{公式番号}-{誕生日MMDD}-{表示名の頭3文字}
   例: EIKI選択・自由入力なし → MZ08-1206-EIK */
function idCode() {
  var mem = getCurrentMember();
  var name = getDisplayName().replace(/[^A-Za-z0-9]/g, "").toUpperCase() || mem.name;
  return "MZ" + mem.no + "-" + mem.bday + "-" + (name + "XXX").slice(0, 3);
}
function serialNo() {
  var d = new Date();
  return "MTB-" + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
}

/* 名前をボックス幅に収めて描く(はみ出し防止のため自動縮小) */
function fitText(ctx, text, maxW, baseFont, baseSize, minSize) {
  var size = baseSize;
  do {
    ctx.font = baseFont.replace("{S}", size);
    if (ctx.measureText(text).width <= maxW) break;
    size -= 2;
  } while (size > (minSize || 20));
  return size;
}

/* ---------- デザイン振り分け ---------- */
function drawDesign(ctx, designId, imgs) {
  ctx.clearRect(0, 0, W, H);
  if (designId === "archive") drawArchive(ctx, imgs);
  else if (designId === "idcard") drawIdCard(ctx, imgs);
  else drawScrap(ctx, imgs);
}

/* =====================================================================
   デザイン1: スクラップブック風(参考画像準拠)
   ちぎり紙コラージュ+リングノート+ポラロイド+切符風ラベル。
   ===================================================================== */
var SCRAP = {
  sheet: { x: 96, y: 88, w: 1008, h: 1016, rot: -0.6 }, /* リングノート本体 */
  grid: {
    cols: 3, frameW: 288, photoPad: 12, photoH: 272,
    gapX: 28, startX: 62, startY: 262, rowGap: 46, bottomPad: 44
  }
};

/* ちぎり紙(不規則な縁の紙片)。seedで形を決定的に生成 */
function tornPaperPath(ctx, x, y, w, h, seed) {
  var s = seed >>> 0;
  function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
  var jag = Math.min(w, h) * 0.06 + 4;
  function edge(x0, y0, x1, y1, n) {
    for (var i = 1; i <= n; i++) {
      var t = i / n;
      var px = x0 + (x1 - x0) * t + (rnd() - 0.5) * jag;
      var py = y0 + (y1 - y0) * t + (rnd() - 0.5) * jag;
      if (i === n) { px = x1; py = y1; }
      ctx.lineTo(px, py);
    }
  }
  ctx.beginPath();
  ctx.moveTo(x, y);
  edge(x, y, x + w, y, 7);
  edge(x + w, y, x + w, y + h, 6);
  edge(x + w, y + h, x, y + h, 7);
  edge(x, y + h, x, y, 6);
  ctx.closePath();
}

function drawTornPaper(ctx, x, y, w, h, rot, color, seed, shadow) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rot * Math.PI / 180);
  if (shadow !== false) {
    ctx.shadowColor = "rgba(120,90,80,.12)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
  }
  ctx.fillStyle = color;
  tornPaperPath(ctx, -w / 2, -h / 2, w, h, seed);
  ctx.fill();
  ctx.restore();
}

/* 方眼/罫線などの紙テクスチャ */
function drawGridTexture(ctx, x, y, w, h, gap, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (var gx = x + gap; gx < x + w; gx += gap) {
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke();
  }
  for (var gy = y + gap; gy < y + h; gy += gap) {
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
  }
  ctx.restore();
}

/* ハート形ワイヤークリップ */
function drawHeartClip(ctx, cx, cy, size, rot, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot * Math.PI / 180);
  ctx.scale(size / 60, size / 60);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.bezierCurveTo(-34, 6, -30, -26, -12, -26);
  ctx.bezierCurveTo(-2, -26, 0, -16, 0, -10);
  ctx.bezierCurveTo(0, -16, 2, -26, 12, -26);
  ctx.bezierCurveTo(30, -26, 34, 6, 2, 28);
  ctx.stroke();
  /* 内側の小ハート(二重ワイヤー) */
  ctx.beginPath();
  ctx.moveTo(0, 16);
  ctx.bezierCurveTo(-18, 2, -16, -14, -7, -14);
  ctx.bezierCurveTo(-2, -14, 0, -8, 0, -4);
  ctx.stroke();
  ctx.restore();
}

/* ゼムクリップ */
function drawPaperClip(ctx, cx, cy, len, rot, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot * Math.PI / 180);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4.2;
  ctx.lineCap = "round";
  var w = len * 0.32;
  ctx.beginPath();
  ctx.moveTo(-w / 2, len * 0.32);
  ctx.lineTo(-w / 2, -len * 0.3);
  ctx.arc(0, -len * 0.3, w / 2, Math.PI, 0);
  ctx.lineTo(w / 2, len * 0.36);
  ctx.arc(0, len * 0.36, w / 2, 0, Math.PI);
  ctx.lineTo(-w / 6, -len * 0.18);
  ctx.arc(w / 24, -len * 0.18, w / 4.6, Math.PI, 0);
  ctx.lineTo(w / 4, len * 0.16);
  ctx.stroke();
  ctx.restore();
}

/* ダブルクリップ(目玉クリップ) */
function drawBinderClip(ctx, cx, cy, w, rot, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot * Math.PI / 180);
  ctx.fillStyle = color;
  var h = w * 0.62;
  ctx.beginPath();
  ctx.moveTo(-w / 2, h / 2);
  ctx.lineTo(w / 2, h / 2);
  ctx.lineTo(w / 2, -h / 2 + 6);
  ctx.quadraticCurveTo(w / 2, -h / 2, w / 2 - 6, -h / 2);
  ctx.lineTo(-w / 2 + 6, -h / 2);
  ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2, -h / 2 + 6);
  ctx.closePath();
  ctx.fill();
  /* ハンドル */
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-w * 0.26, -h / 2);
  ctx.lineTo(-w * 0.14, -h * 1.05);
  ctx.lineTo(w * 0.02, -h * 1.05);
  ctx.moveTo(w * 0.26, -h / 2);
  ctx.lineTo(w * 0.14, -h * 1.05);
  ctx.lineTo(-w * 0.02, -h * 1.05);
  ctx.stroke();
  ctx.restore();
}

/* 王冠の落書き */
function drawCrownDoodle(ctx, cx, cy, w, rot, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot * Math.PI / 180);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  var h = w * 0.62;
  ctx.beginPath();
  ctx.moveTo(-w / 2, h / 2);
  ctx.lineTo(-w / 2, -h * 0.28);
  ctx.lineTo(-w * 0.18, h * 0.04);
  ctx.lineTo(0, -h / 2);
  ctx.lineTo(w * 0.18, h * 0.04);
  ctx.lineTo(w / 2, -h * 0.28);
  ctx.lineTo(w / 2, h / 2);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/* 切符風ラベル(両端に切り欠き) */
function drawTicketLabel(ctx, cx, cy, w, h, rot, fill, edgeColor, text) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot * Math.PI / 180);
  var notch = h * 0.2, r = 8, x0 = -w / 2, y0 = -h / 2;
  function ticketPath() {
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0);
    ctx.lineTo(x0 + w - r, y0);
    ctx.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
    ctx.lineTo(x0 + w, -notch);
    ctx.arc(x0 + w, 0, notch, -Math.PI / 2, Math.PI / 2, true); /* 右の切り欠き */
    ctx.lineTo(x0 + w, y0 + h - r);
    ctx.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
    ctx.lineTo(x0 + r, y0 + h);
    ctx.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
    ctx.lineTo(x0, notch);
    ctx.arc(x0, 0, notch, Math.PI / 2, -Math.PI / 2, true); /* 左の切り欠き */
    ctx.lineTo(x0, y0 + r);
    ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
    ctx.closePath();
  }
  ctx.shadowColor = "rgba(120,90,80,.14)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = fill;
  ticketPath();
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = 1.1;
  ticketPath();
  ctx.stroke();
  ctx.fillStyle = "#5a4036";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  /* 花とちょうちょ(400固定・太字にしない)。長文ラベルは自動縮小 */
  var fs = fitText(ctx, text, w - h * 0.72, "400 {S}px " + F.jpHand, 27, 15);
  ctx.font = "400 " + fs + "px " + F.jpHand;
  ctx.fillText(text, 0, 1);
  ctx.restore();
}

function drawScrap(ctx, imgs) {
  var C = SCRAP;
  var sh = C.sheet;

  /* --- 背景: クラフト紙 + ちぎり紙コラージュ --- */
  ctx.fillStyle = "#e7dccb";
  ctx.fillRect(0, 0, W, H);
  /* 上・左右のちぎり紙レイヤー */
  drawTornPaper(ctx, -60, -70, 560, 300, -3, "#f4d6da", 11);
  drawTornPaper(ctx, 300, -80, 520, 220, 2, "#f8efe0", 22);
  drawTornPaper(ctx, 700, -60, 560, 260, -2, "#f1d0d7", 33);
  drawTornPaper(ctx, -80, 150, 260, 560, 4, "#eeccd3", 44);
  drawTornPaper(ctx, 1020, 120, 260, 520, -4, "#f8efe0", 55);
  drawTornPaper(ctx, 1010, 560, 280, 420, 3, "#f4d6da", 66);
  /* 下部コラージュ */
  drawTornPaper(ctx, -70, 940, 560, 330, -2, "#f0cbd3", 77);
  drawTornPaper(ctx, 380, 990, 500, 260, 1.5, "#cfe0cf", 88);
  drawTornPaper(ctx, 820, 950, 460, 300, -2.5, "#f6dfe2", 99);
  drawTornPaper(ctx, -60, 640, 240, 380, 3, "#f8efe0", 111);
  /* 方眼ちぎり紙(アクセント) */
  ctx.save();
  drawTornPaper(ctx, 250, 20, 190, 120, -6, "#fdf8ef", 123);
  ctx.save();
  ctx.translate(345, 80); ctx.rotate(-6 * Math.PI / 180);
  drawGridTexture(ctx, -85, -50, 170, 100, 16, "rgba(214,140,155,.35)");
  ctx.restore();
  ctx.restore();

  /* --- リングノート本体(わずかに回転) --- */
  ctx.save();
  ctx.translate(sh.x + sh.w / 2, sh.y + sh.h / 2);
  ctx.rotate(sh.rot * Math.PI / 180);
  ctx.translate(-sh.w / 2, -sh.h / 2);

  ctx.shadowColor = "rgba(110,80,70,.2)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#fdf6e9";
  tornPaperPath(ctx, 0, 0, sh.w, sh.h, 246);
  ctx.fill();
  ctx.shadowColor = "transparent";

  /* リング穴(左端・ちぎれた半円) */
  for (var hy = 60; hy < sh.h - 30; hy += 74) {
    ctx.fillStyle = "#e2d2c3";
    ctx.beginPath(); ctx.arc(20, hy, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(140,110,95,.35)";
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(20, hy, 12, -0.4, Math.PI + 0.4); ctx.stroke();
  }

  /* --- 見出し --- */
  /* 推しビジュ6選 ピンクタブ */
  ctx.save();
  ctx.translate(sh.w / 2, 54);
  ctx.rotate(-1.2 * Math.PI / 180);
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "#eeb0bd";
  ctx.fillRect(-128, -25, 256, 50);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#7c5060";
  ctx.font = "600 27px " + F.jp;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("推しビジュ6選", 0, 2);
  ctx.restore();

  /* My Visual 6 手書きスクリプト(二色) */
  ctx.save();
  ctx.translate(sh.w / 2, 178);
  ctx.rotate(-1.5 * Math.PI / 180);
  ctx.textBaseline = "alphabetic";
  var tfs = fitText(ctx, "My Visual 6", 600, "400 {S}px " + F.enSerif, 106, 56);
  ctx.font = "400 " + tfs + "px " + F.enSerif;
  var wMy = ctx.measureText("My ").width;
  var wVis = ctx.measureText("Visual ").width;
  var w6 = ctx.measureText("6").width;
  var total = wMy + wVis + w6;
  var tx = -total / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = "#d9798f";
  ctx.fillText("My ", tx, 0);
  ctx.fillStyle = "#5c4a3d";
  ctx.fillText("Visual ", tx + wMy, 0);
  ctx.fillStyle = "#d9798f";
  ctx.fillText("6", tx + wMy + wVis, 0);
  /* 下線スウッシュ */
  ctx.strokeStyle = "#d9798f";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-total * 0.32, 24);
  ctx.quadraticCurveTo(0, 38, total * 0.34, 22);
  ctx.stroke();
  /* ペンのはらい(右上) */
  ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(total / 2 + 20, -72); ctx.lineTo(total / 2 + 34, -92); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(total / 2 + 38, -60); ctx.lineTo(total / 2 + 56, -76); ctx.stroke();
  ctx.restore();
  drawHeart(ctx, sh.w / 2 + 236, 100, 20, "#e08a9b", 0.9);
  
  /* --- ポラロイド 3×2 --- */
  var g = C.grid;
  var frameH = g.photoPad + g.photoH + g.bottomPad;
  var rots = [-1.8, 1.4, -1.2, 1.6, -1.4, 1.2];
  var ticketFills = ["#f6ccd4", "#d5e6d6", "#f6ccd4", "#d5e6d6", "#f2d3d9", "#efe0b8"];
  var ticketEdges = ["#d99aa8", "#9dbfa0", "#d99aa8", "#9dbfa0", "#d99aa8", "#c9b070"];

  themes.forEach(function (theme, i) {
    var col = i % 3, row = Math.floor(i / 3);
    var fx = g.startX + col * (g.frameW + g.gapX);
    var fy = g.startY + row * (frameH + g.rowGap);
    var cx = fx + g.frameW / 2;
    var cy = fy + frameH / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rots[i] * Math.PI / 180);

    /* 白フレーム */
    ctx.shadowColor = "rgba(110,80,70,.22)";
    ctx.shadowBlur = 9;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-g.frameW / 2, -frameH / 2, g.frameW, frameH);
    ctx.shadowColor = "transparent";

    /* 写真 */
    var pw = g.frameW - g.photoPad * 2;
    drawCoverImage(ctx, imgs[i], -pw / 2, -frameH / 2 + g.photoPad, pw, g.photoH,
      selectedImages[theme.id], 0, "#f0e6d8");

    ctx.restore();

    /* マステ(一部のフレームのみ) */
    if (i === 1) drawTape(ctx, cx, fy + 4, 120, 34, -3, "rgba(238,166,180,.8)");
    if (i === 2) drawTape(ctx, cx + g.frameW / 2 - 48, fy + 8, 100, 30, 38, "rgba(190,220,196,.85)");
    if (i === 4) drawTape(ctx, cx, fy + 2, 110, 30, 2.5, "rgba(244,205,214,.85)");

    /* 切符風ラベル(写真の下端に重ねる) */
    var labelW = Math.min(g.frameW - 44, 220);
    drawTicketLabel(ctx, cx, fy + frameH - g.bottomPad + 12, labelW, 44,
      rots[i] * 0.6, ticketFills[i], ticketEdges[i], theme.label);
  });

  /* --- 落書き --- */
  drawHeart(ctx, g.startX - 26, g.startY + 90, 22, "#d9798f", 0.85);
  ctx.save();
  ctx.strokeStyle = "#c95f77";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(g.startX - 24, g.startY + 90, 27, -0.6, 4.2);
  ctx.stroke();
  ctx.restore();
  drawSparkle(ctx, g.startX - 20, g.startY + frameH + g.rowGap + 60, 15, "#7c6a52", 0.8);
  drawSparkle(ctx, g.startX - 40, g.startY + frameH + g.rowGap + 96, 9, "#7c6a52", 0.6);
  drawHeart(ctx, sh.w - 34, g.startY + frameH + 130, 16, "#d9798f", 0.8);
  drawCrownDoodle(ctx, g.startX + 2 * (g.frameW + g.gapX) + g.frameW - 24,
    g.startY + 2 * frameH + g.rowGap + 26, 52, -8, "#b98e3e");

  ctx.restore(); /* リングノートの回転ここまで */

  /* --- コラージュ小物(ノートの上に重なる) --- */
  /* 左上: DATEメモ(緑) + ハートクリップ */
  ctx.save();
  ctx.translate(148, 188);
  ctx.rotate(-5 * Math.PI / 180);
  ctx.shadowColor = "rgba(110,80,70,.18)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#dde8da";
  tornPaperPath(ctx, -94, -56, 188, 112, 135);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(120,140,115,.45)";
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(-70, -6); ctx.lineTo(70, -6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-70, 32); ctx.lineTo(70, 32); ctx.stroke();
  ctx.fillStyle = "#5f6f58";
  ctx.textAlign = "center";
  setLS(ctx, 1.5);
  ctx.font = "600 19px " + F.en;
  ctx.fillText("DATE.", 0, -16);
  setLS(ctx, 0);
  ctx.font = "600 23px " + F.en;
  ctx.fillText(formatDate(new Date()), 0, 22);
  ctx.restore();
  drawHeartClip(ctx, 118, 118, 56, -14, "#d97b90");

  /* 右上: 名前メモ(白・破りメモ) + ゼムクリップ */
  ctx.save();
  ctx.translate(1050, 174);
  ctx.rotate(4 * Math.PI / 180);
  ctx.shadowColor = "rgba(110,80,70,.18)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#fefbf4";
  tornPaperPath(ctx, -102, -70, 204, 140, 159);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(150,130,115,.35)";
  ctx.lineWidth = 1.1;
  [-16, 20].forEach(function (ly) {
    ctx.beginPath(); ctx.moveTo(-78, ly); ctx.lineTo(78, ly); ctx.stroke();
  });
  ctx.fillStyle = "#8a7a66";
  ctx.textAlign = "center";
  setLS(ctx, 1.5);
  ctx.font = "600 18px " + F.en;
  ctx.fillText("NAME", 0, -28);
  setLS(ctx, 0);
  ctx.fillStyle = "#5c4a3d";
  var nm = getDisplayName();
  var nfs = fitText(ctx, nm, 172, nameFontTpl(), 30, 15);
  ctx.font = nameFontTpl().replace("{S}", nfs);
  ctx.fillText(nm, 0, 10);
  drawHeart(ctx, 60, 42, 12, "#d9798f", 0.8);
  ctx.restore();
  drawPaperClip(ctx, 980, 96, 68, 16, "#c9a35a");

  /* 下部: MUZE TOOL BOX(左)、緑メモ(中央)、チケット(右) */
  ctx.save();
  ctx.translate(210, 1140);
  ctx.rotate(-2.4 * Math.PI / 180);
  ctx.fillStyle = "#7c5a52";
  ctx.textAlign = "center";
  setLS(ctx, 2);
  ctx.font = "600 25px " + F.en;
  ctx.fillText("MUZE TOOL BOX", 0, 0);
  setLS(ctx, 0);
  ctx.strokeStyle = "#7c5a52";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-124, 14); ctx.quadraticCurveTo(0, 22, 124, 12); ctx.stroke();
  ctx.restore();
  drawBinderClip(ctx, 452, 1128, 72, 3, "#b9954e");

  ctx.save();
  ctx.translate(636, 1146);
  ctx.rotate(1.6 * Math.PI / 180);
  ctx.fillStyle = "#5f6f58";
  ctx.textAlign = "center";
  ctx.font = "600 24px " + F.jp;
  ctx.fillText("推しビジュ6選", 0, 0);
  drawHeart(ctx, 112, -6, 12, "#d9798f", 0.8);
  ctx.restore();

  /* 右下: ステッチ縁のチケット */
  ctx.save();
  ctx.translate(1040, 1110);
  ctx.rotate(-3 * Math.PI / 180);
  ctx.shadowColor = "rgba(110,80,70,.25)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#f0c2cb";
  roundedRectPath(ctx, -80, -51, 160, 102, 8);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#fdf3ef";
  ctx.lineWidth = 1.8;
  ctx.setLineDash([5, 5]);
  roundedRectPath(ctx, -69, -40, 138, 80, 6);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#844d5c";
  ctx.textAlign = "center";
  setLS(ctx, 1.5);
  ctx.font = "700 20px " + F.en;
  ctx.fillText("MY", 0, -14);
  ctx.fillText("VISUAL 6", 0, 12);
  setLS(ctx, 0);
  drawHeart(ctx, 0, 32, 10, "#a2606f", 0.85);
  ctx.restore();

  drawSparkle(ctx, 84, 470, 12, "#c98ea0", 0.6);
}

/* =====================================================================
   デザイン2: アーカイブカード風
   大きな MY VISUAL 6 / 雑誌・紙面レイアウト / 余白・罫線
   ===================================================================== */
var ARCHIVE = {
  outer: 26, inner: 44,
  grid: { cellW: 336, photoH: 264, labelH: 56, gapX: 18, startY: 342, rowGap: 22 },
  band: { y: 1012, h: 86 }
};
function drawArchive(ctx, imgs) {
  var C = ARCHIVE;
  var ink = "#3c352c";
  var soft = "rgba(60,53,44,.55)";
  var pink = "#d96a86";
  var teal = "#3e8c7e";

  // ---- 紙背景 ----
  ctx.fillStyle = "#efe7d6";
  ctx.fillRect(0, 0, W, H);
  // 紙の質感(うっすらまだら)
  ctx.save();
  ctx.globalAlpha = .05;
  for (var i = 0; i < 60; i++) {
    var gx = (i * 173) % W, gy = (i * 271) % H;
    ctx.fillStyle = i % 2 ? "#c9b892" : "#ffffff";
    ctx.beginPath(); ctx.arc(gx, gy, 40 + (i % 5) * 18, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // ---- 枠(二重) ----
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(C.outer, C.outer, W - C.outer * 2, H - C.outer * 2);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(C.inner, C.inner, W - C.inner * 2, H - C.inner * 2);
  // 四隅のレジストレーションマーク
  [[C.outer, C.outer], [W - C.outer, C.outer], [C.outer, H - C.outer], [W - C.outer, H - C.outer]].forEach(function (p) {
    ctx.strokeStyle = ink; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(p[0] - 14, p[1]); ctx.lineTo(p[0] + 14, p[1]);
    ctx.moveTo(p[0], p[1] - 14); ctx.lineTo(p[0], p[1] + 14);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(p[0], p[1], 8, 0, Math.PI * 2); ctx.stroke();
  });

  // ---- 左上の索引欄 ----
  var lx = 74, ly = 84;
  ctx.fillStyle = soft;
  setLS(ctx, 1.5);
  ctx.font = "600 16px " + F.en;
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText("MUZE TOOL BOX", lx, ly);
  setLS(ctx, 0);
  ctx.strokeStyle = "rgba(60,53,44,.4)";
  ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(lx, ly + 30); ctx.lineTo(lx + 190, ly + 30); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = pink;
  setLS(ctx, 1.5);
  ctx.font = "600 14px " + F.en;
  ctx.fillText("CATEGORY", lx, ly + 46);
  setLS(ctx, 0);
  ctx.fillStyle = ink;
  ctx.font = "600 22px " + F.jp;
  ctx.fillText("推しビジュ6選", lx, ly + 70);
  ctx.fillStyle = pink;
  setLS(ctx, 1.5);
  ctx.font = "600 14px " + F.en;
  ctx.fillText("NAME", lx, ly + 122);
  setLS(ctx, 0);
  var nm = getDisplayName();
  ctx.fillStyle = ink;
  var nmS = fitText(ctx, nm, 220, nameFontTpl(), 30, 15);
  ctx.font = nameFontTpl().replace("{S}", nmS);
  ctx.fillText(nm, lx, ly + 146);
  // 斜線飾り
  ctx.save();
  ctx.strokeStyle = pink; ctx.lineWidth = 3; ctx.globalAlpha = .7;
  for (var s = 0; s < 8; s++) {
    ctx.beginPath();
    ctx.moveTo(lx + s * 12, ly + 216);
    ctx.lineTo(lx + s * 12 + 8, ly + 204);
    ctx.stroke();
  }
  ctx.restore();

  // ---- 中央タイトル ----
  ctx.textAlign = "center";
  ctx.fillStyle = ink;
  ctx.font = "600 26px " + F.jp;
  ctx.fillText("推しビジュ6選", W / 2, 80);
  drawSparkle(ctx, W / 2 - 148, 92, 12, pink, .9);
  drawSparkle(ctx, W / 2 + 148, 92, 12, pink, .9);
  var atS = fitText(ctx, "MY VISUAL 6", 660, "400 {S}px " + F.enSerif, 150, 70);
  ctx.font = "400 " + atS + "px " + F.enSerif;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("MY VISUAL 6", W / 2, 232);
  setLS(ctx, 1.5);
  ctx.font = "500 19px " + F.en;
  ctx.fillStyle = soft;
  ctx.fillText("by  MUZE TOOL BOX", W / 2, 282);
  setLS(ctx, 0);
  ctx.textBaseline = "top";

  // ---- 右上のシリアル欄 ----
  var bx = 934, by = 82, bw = 194, bh = 128;
  ctx.strokeStyle = ink; ctx.lineWidth = 1.4;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.strokeRect(bx + 5, by + 5, bw - 10, bh - 10);
  ctx.textAlign = "left";
  ctx.fillStyle = pink;
  setLS(ctx, 1.4);
  ctx.font = "600 14px " + F.en;
  ctx.fillText("SERIAL NO.", bx + 18, by + 18);
  setLS(ctx, 0);
  ctx.fillStyle = pink;
  ctx.font = "400 29px " + F.enSerif;
  ctx.fillText(serialNo(), bx + 18, by + 42);
  ctx.fillStyle = soft;
  setLS(ctx, 1.4);
  ctx.font = "600 13px " + F.en;
  ctx.fillText("DATE", bx + 18, by + 82);
  setLS(ctx, 0);
  ctx.fillStyle = ink;
  ctx.font = "600 20px " + F.en;
  ctx.fillText(formatDate(new Date()), bx + 18, by + 102);

  // ---- ティールの丸スタンプ ----
  drawStamp(ctx, 1030, 300, 60, teal, "MUZE TOOL BOX", function (c, r) {
    c.font = "700 14px " + F.en;
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("MY", 0, -8);
    c.fillText("VISUAL 6", 0, 12);
  });

  // ---- 写真グリッド(3×2、白マット+細枠) ----
  var g = C.grid;
  var totalW = g.cellW * 3 + g.gapX * 2;
  var startX = (W - totalW) / 2;
  themes.forEach(function (theme, i) {
    var col = i % 3, row = Math.floor(i / 3);
    var x = startX + col * (g.cellW + g.gapX);
    var y = g.startY + row * (g.photoH + g.labelH + g.rowGap);
    // セル枠
    ctx.fillStyle = "#f7f1e3";
    ctx.fillRect(x, y, g.cellW, g.photoH + g.labelH);
    ctx.strokeStyle = ink; ctx.lineWidth = 1.6;
    ctx.strokeRect(x, y, g.cellW, g.photoH + g.labelH);
    // 写真
    drawCoverImage(ctx, imgs[i], x + 8, y + 8, g.cellW - 16, g.photoH - 8,
      selectedImages[theme.id], 0, "#e7dcc8");
    // ラベル行
    var lyy = y + g.photoH + g.labelH / 2;
    ctx.fillStyle = soft;
    setLS(ctx, 1.2);
    ctx.font = "600 14px " + F.en;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("No.0" + (i + 1), x + 18, lyy + 2);
    setLS(ctx, 0);
    ctx.strokeStyle = "rgba(60,53,44,.45)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 78, lyy); ctx.lineTo(x + 106, lyy); ctx.stroke();
    ctx.fillStyle = ink;
    var alS = fitText(ctx, theme.label, 186, "600 {S}px " + F.jp, 25, 15);
    ctx.font = "600 " + alS + "px " + F.jp;
    ctx.textAlign = "center";
    ctx.fillText(theme.label, x + g.cellW / 2 + 14, lyy + 2);
    drawSparkle(ctx, x + g.cellW - 26, lyy, 9, pink, .9);
  });

  // ---- 下部の情報欄(NOTES / VISUAL KEYWORDS / ARCHIVE CARD) ----
  var B = C.band;
  ctx.strokeStyle = ink; ctx.lineWidth = 1.4;
  ctx.strokeRect(startX, B.y, totalW, B.h);
  var div1 = startX + 330, div2 = startX + totalW - 260;
  ctx.beginPath();
  ctx.moveTo(div1, B.y); ctx.lineTo(div1, B.y + B.h);
  ctx.moveTo(div2, B.y); ctx.lineTo(div2, B.y + B.h);
  ctx.stroke();
  // NOTES: 名前(GROUP/NAMEの短いラベルのみ)
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillStyle = pink;
  setLS(ctx, 1.4);
  ctx.font = "600 15px " + F.en;
  ctx.fillText("NOTES.", startX + 20, B.y + 14);
  setLS(ctx, 0);
  drawSparkle(ctx, startX + 88, B.y + 22, 7, pink, .9);
  ctx.fillStyle = soft;
  setLS(ctx, 1.2);
  ctx.font = "600 15px " + F.en;
  ctx.fillText("NAME.", startX + 20, B.y + 46);
  setLS(ctx, 0);
  ctx.fillStyle = ink;
  var bnS = fitText(ctx, nm, 220, nameFontTpl(), 22, 13);
  ctx.font = nameFontTpl().replace("{S}", bnS);
  ctx.fillText(nm, startX + 88, B.y + 42);
  // VISUAL KEYWORDS: テーマ語だけ(ポエムなし)
  ctx.fillStyle = teal;
  setLS(ctx, 1.4);
  ctx.font = "600 15px " + F.en;
  ctx.fillText("VISUAL KEYWORDS", div1 + 22, B.y + 14);
  setLS(ctx, 0);
  ctx.fillStyle = ink;
  ctx.font = "500 18px " + F.jp;
  ctx.fillText("#沼落ちビジュ  #今の最愛ビジュ", div1 + 22, B.y + 40);
  ctx.fillText("#かわいい  #かっこいい  #ずるい  #殿堂入り", div1 + 22, B.y + 64);
  // ARCHIVE CARD
  ctx.fillStyle = ink;
  setLS(ctx, 1.4);
  ctx.font = "600 15px " + F.en;
  ctx.fillText("ARCHIVE CARD", div2 + 20, B.y + 14);
  setLS(ctx, 0);
  ctx.save();
  ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.globalAlpha = .8;
  for (var s2 = 0; s2 < 6; s2++) {
    ctx.beginPath();
    ctx.moveTo(div2 + 168 + s2 * 11, B.y + 26);
    ctx.lineTo(div2 + 176 + s2 * 11, B.y + 14);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = soft;
  setLS(ctx, 1);
  ctx.font = "600 15px " + F.en;
  ctx.fillText("MUZE TOOL BOX", div2 + 20, B.y + 48);
  setLS(ctx, 0);
  // チェックボックス風
  for (var cb = 0; cb < 3; cb++) {
    ctx.strokeStyle = soft; ctx.lineWidth = 1.3;
    ctx.strokeRect(div2 + 208, B.y + 40 + cb * 15, 10, 10);
  }

  // ---- 最下部 © ----
  ctx.textAlign = "center";
  ctx.fillStyle = soft;
  setLS(ctx, 1.5);
  ctx.font = "500 16px " + F.en;
  ctx.fillText("MUZE TOOL BOX", W / 2, H - 84);
  setLS(ctx, 0);
  ctx.strokeStyle = "rgba(60,53,44,.5)"; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 170, H - 75); ctx.lineTo(W / 2 - 92, H - 75);
  ctx.moveTo(W / 2 + 92, H - 75); ctx.lineTo(W / 2 + 170, H - 75);
  ctx.stroke();
}

/* =====================================================================
   デザイン3: 証明写真/PROFILE SNAP CARD(参考画像準拠)
   白基調・細線・余白多め。ラベルは写真下端に重なる控えめなピル型。
   ===================================================================== */
var IDCARD = {
  outer: 26,           /* 外側の細枠 */
  inner: 60,           /* カード本体 */
  headerY: 108,
  sepY: 148,
  side: { x: 96, w: 210 },
  grid: { x: 336, cellW: 250, photoH: 360, gapX: 20, startY: 176, rowGap: 38 },
  notesY: 1082
};

/* 文字間を空けて描く(レタースペーシング) */
function drawSpaced(ctx, text, cx, y, ls) {
  var chars = text.split("");
  var widths = chars.map(function (ch) { return ctx.measureText(ch).width; });
  var total = widths.reduce(function (a, b) { return a + b; }, 0) + ls * (chars.length - 1);
  var x = cx - total / 2;
  var prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach(function (ch, i) {
    ctx.fillText(ch, x, y);
    x += widths[i] + ls;
  });
  ctx.textAlign = prevAlign;
}

/* 点線 */
function dottedLine(ctx, x0, y0, x1, y1, color, width) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width || 1.4;
  ctx.setLineDash([2.5, 5]);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawIdCard(ctx, imgs) {
  var C = IDCARD;
  var ink = "#4a4038";       /* 文字色(墨) */
  var sub = "#9a8f86";       /* 補助ラベル */
  var pink = "#dfa6b0";      /* 差し色ピンク */
  var line = "#e3d5d2";      /* 細枠 */

  /* --- 背景と枠 --- */
  ctx.fillStyle = "#f7f2f0";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#dcc3c7";
  ctx.lineWidth = 1.6;
  roundedRectPath(ctx, C.outer, C.outer, W - C.outer * 2, H - C.outer * 2, 18);
  ctx.stroke();
  ctx.lineWidth = 0.8;
  roundedRectPath(ctx, C.outer + 7, C.outer + 7, W - (C.outer + 7) * 2, H - (C.outer + 7) * 2, 14);
  ctx.stroke();

  /* カード本体 */
  ctx.fillStyle = "#fffdfc";
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.4;
  roundedRectPath(ctx, C.inner, C.inner, W - C.inner * 2, H - C.inner * 2, 12);
  ctx.fill();
  ctx.stroke();

  /* --- ヘッダー --- */
  ctx.fillStyle = ink;
  ctx.textBaseline = "alphabetic";
  drawSparkle(ctx, C.side.x + 16, C.headerY - 13, 12, pink, 0.9);
  ctx.textAlign = "left";
  ctx.save();
  ctx.font = "700 37px " + F.en;
  var htx = C.side.x + 46;
  "PROFILE SNAP CARD".split("").forEach(function (ch) {
    ctx.fillText(ch, htx, C.headerY);
    htx += ctx.measureText(ch).width + 4.5; /* ≒0.12em */
  });
  ctx.restore();
  drawSparkle(ctx, htx + 14, C.headerY - 13, 12, pink, 0.9);

  /* 右上ピル: ♥ 推しビジュ6選 ♥ */
  var pillW = 288, pillH = 56;
  var pillX = W - C.inner - 40 - pillW, pillY = C.headerY - 40;
  ctx.strokeStyle = "#d9aeb6";
  ctx.lineWidth = 1.6;
  roundedRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.stroke();
  ctx.fillStyle = "#6a5a52";
  ctx.font = "600 24px " + F.jp;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("推しビジュ6選", pillX + pillW / 2, pillY + pillH / 2 + 1);
  drawHeart(ctx, pillX + 32, pillY + pillH / 2, 11, pink, 0.9);
  drawHeart(ctx, pillX + pillW - 32, pillY + pillH / 2, 11, pink, 0.9);

  /* ヘッダー下の点線 */
  dottedLine(ctx, C.inner + 36, C.sepY, W - C.inner - 36, C.sepY, "#cbbdb6", 1.6);

  /* --- 左サイドバー --- */
  var sx = C.side.x, sw = C.side.w;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  function sideLabel(text, y) {
    ctx.fillStyle = sub;
    ctx.font = "600 19px " + F.en;
    var lx = sx;
    text.split("").forEach(function (ch) {
      ctx.fillText(ch, lx, y);
      lx += ctx.measureText(ch).width + 2;
    });
    ctx.strokeStyle = "#c8bab3";
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(sx, y + 9); ctx.lineTo(lx - 4, y + 9); ctx.stroke();
  }

  var sy = C.grid.startY + 40;
  /* NAME */
  sideLabel("NAME", sy);
  var nm = getDisplayName();
  ctx.fillStyle = ink;
  var nfs = fitText(ctx, nm, sw + 22, nameFontTpl(), 60, 16);
  ctx.font = nameFontTpl().replace("{S}", nfs);
  ctx.fillText(nm, sx, sy + 76);
  dottedLine(ctx, sx, sy + 112, sx + sw, sy + 112, line, 1.4);

  /* TYPE */
  sideLabel("TYPE", sy + 156);
  ctx.fillStyle = ink;
  ctx.font = "700 27px " + F.en;
  ctx.fillText("MY VISUAL 6", sx, sy + 198);
  dottedLine(ctx, sx, sy + 228, sx + sw, sy + 228, line, 1.4);

  /* GROUP(自由入力名のときは空欄の罫線) */
  sideLabel("GROUP", sy + 270);
  if (isFreeNameUsed()) {
    ctx.strokeStyle = "#c8bab3";
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(sx, sy + 310); ctx.lineTo(sx + sw, sy + 310); ctx.stroke();
  } else {
    ctx.fillStyle = ink;
    ctx.font = "700 27px " + F.en;
    ctx.fillText("MAZZEL", sx, sy + 312);
  }
  dottedLine(ctx, sx, sy + 342, sx + sw, sy + 342, line, 1.4);

  /* 円形スタンプ(MUZE / TOOL BOX) */
  var stX = sx + sw / 2, stY = sy + 442, stR = 76;
  ctx.save();
  ctx.translate(stX, stY);
  ctx.rotate(-0.14);
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = pink;
  ctx.fillStyle = pink;
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(0, 0, stR, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.arc(0, 0, stR - 7, 0, Math.PI * 2); ctx.stroke();
  ctx.font = "700 20px " + F.en;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  /* 上弧: MUZE */
  var top = "MUZE".split("");
  var arcT = Math.PI * 0.55, startT = -Math.PI / 2 - arcT / 2;
  top.forEach(function (ch, i) {
    var ang = startT + arcT * (i / (top.length - 1));
    ctx.save(); ctx.rotate(ang + Math.PI / 2); ctx.fillText(ch, 0, -(stR - 26)); ctx.restore();
  });
  /* 下弧: TOOL BOX */
  var bot = "TOOL BOX".split("");
  var arcB = Math.PI * 0.72, startB = Math.PI / 2 + arcB / 2;
  bot.forEach(function (ch, i) {
    var ang = startB - arcB * (i / (bot.length - 1));
    ctx.save(); ctx.rotate(ang - Math.PI / 2); ctx.fillText(ch, 0, stR - 26); ctx.restore();
  });
  drawHeart(ctx, 0, 0, 26, pink, 0.85);
  drawSparkle(ctx, -stR + 20, 0, 8, pink, 0.85);
  drawSparkle(ctx, stR - 20, 0, 8, pink, 0.85);
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  dottedLine(ctx, sx, sy + 538, sx + sw, sy + 538, line, 1.4);

  /* DATE */
  sideLabel("DATE", sy + 580);
  ctx.fillStyle = ink;
  ctx.font = "600 28px " + F.en;
  ctx.fillText(formatDate(new Date()), sx, sy + 620);

  /* ID */
  sideLabel("ID", sy + 664);
  ctx.fillStyle = ink;
  var code = idCode();
  var cfs = fitText(ctx, code, sw, "600 {S}px " + F.en, 23, 15);
  ctx.font = "600 " + cfs + "px " + F.en;
  ctx.fillText(code, sx, sy + 700);

  /* バーコード */
  drawBarcode(ctx, code, sx, sy + 722, sw - 24, 40, "#5a5048");

  /* --- 写真グリッド 3×2 --- */
  var g = IDCARD.grid;
  themes.forEach(function (theme, i) {
    var col = i % 3, row = Math.floor(i / 3);
    var x = g.x + col * (g.cellW + g.gapX);
    var y = g.startY + row * (g.photoH + g.rowGap);

    /* 写真カード(角丸・細枠) */
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ded3cd";
    ctx.lineWidth = 1.2;
    roundedRectPath(ctx, x, y, g.cellW, g.photoH, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    drawCoverImage(ctx, imgs[i], x, y, g.cellW, g.photoH,
      selectedImages[theme.id], 14, "#f3ede8");
    ctx.strokeStyle = "#ded3cd";
    ctx.lineWidth = 1.2;
    roundedRectPath(ctx, x, y, g.cellW, g.photoH, 14);
    ctx.stroke();

    /* ラベル(写真下端に重なる白ピル・控えめ) */
    var lw = g.cellW - 48, lh = 40;
    var lx = x + g.cellW / 2, ly = y + g.photoH - 4;
    ctx.save();
    ctx.shadowColor = "rgba(120,100,90,.1)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1.5;
    ctx.fillStyle = "#fffdfb";
    roundedRectPath(ctx, lx - lw / 2, ly - lh / 2, lw, lh, 8);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#d5c9c2";
    ctx.lineWidth = 0.9;
    roundedRectPath(ctx, lx - lw / 2, ly - lh / 2, lw, lh, 8);
    ctx.stroke();
    ctx.strokeStyle = "#e7ddd7";
    ctx.lineWidth = 0.6;
    roundedRectPath(ctx, lx - lw / 2 + 3.5, ly - lh / 2 + 3.5, lw - 7, lh - 7, 6);
    ctx.stroke();
    ctx.fillStyle = "#5a5148";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var lfs = fitText(ctx, theme.label, lw - 52, "500 {S}px " + F.jp, 22, 14);
    ctx.font = "500 " + lfs + "px " + F.jp;
    ctx.fillText(theme.label, lx, ly + 1);
    /* 両端の小ドット */
    ctx.fillStyle = "#b9aca4";
    ctx.beginPath(); ctx.arc(lx - lw / 2 + 15, ly, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(lx + lw / 2 - 15, ly, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
  ctx.textBaseline = "alphabetic";

  /* --- 下部: 事務欄(控えめ) + NOTES --- */
  var by = C.notesY - 58;
  dottedLine(ctx, C.inner + 36, by - 34, W - C.inner - 36, by - 34, "#cbbdb6", 1.4);
  ctx.textAlign = "left";
  function footItem(label, x) {
    ctx.fillStyle = sub;
    ctx.font = "600 16px " + F.en;
    var lx2 = x;
    label.split("").forEach(function (ch) {
      ctx.fillText(ch, lx2, by - 4);
      lx2 += ctx.measureText(ch).width + 1.8;
    });
  }
  footItem("CHECKED BY.", C.inner + 36);
  ctx.fillStyle = ink; ctx.font = "600 20px " + F.en;
  ctx.fillText("MUZE TOOL BOX", C.inner + 36, by + 26);

  footItem("DATE.", 434);
  ctx.fillStyle = ink; ctx.font = "600 20px " + F.en;
  ctx.fillText(formatDate(new Date()), 434, by + 26);

  footItem("VERIFICATION", 640);
  ctx.strokeStyle = "#b3a69e"; ctx.lineWidth = 1.4;
  ctx.strokeRect(640, by + 8, 20, 20);
  ctx.strokeStyle = pink; ctx.lineWidth = 2.6; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(644, by + 18); ctx.lineTo(649, by + 24); ctx.lineTo(658, by + 10);
  ctx.stroke();
  ctx.fillStyle = ink; ctx.font = "600 20px " + F.en;
  ctx.fillText("APPROVED", 668, by + 26);

  footItem("SIGNATURE.", 872);
  ctx.fillStyle = ink;
  var sig = getDisplayName();
  var sfs = fitText(ctx, sig, W - C.inner - 36 - 872, nameFontTpl(), 32, 16);
  ctx.font = nameFontTpl().replace("{S}", sfs);
  ctx.fillText(sig, 872, by + 28);

  /* NOTES行 */
  ctx.fillStyle = sub;
  ctx.font = "600 17px " + F.en;
  var nx = C.inner + 36;
  "NOTES".split("").forEach(function (ch) {
    ctx.fillText(ch, nx, C.notesY);
    nx += ctx.measureText(ch).width + 2;
  });
  dottedLine(ctx, nx + 14, C.notesY - 5, W - C.inner - 130, C.notesY - 5, "#c4b7b0", 1.5);
  drawHeart(ctx, W - C.inner - 102, C.notesY - 8, 12, pink, 0.85);
  drawHeart(ctx, W - C.inner - 72, C.notesY - 8, 12, pink, 0.7);
  drawHeart(ctx, W - C.inner - 42, C.notesY - 8, 12, pink, 0.55);
}

/* =====================================================================
   保存(共有シート → ダウンロード → 長押し保存フォールバック)
   保存画像はプレビューと同じ drawDesign() で 1200×1200 に直描き。
   ===================================================================== */
/* デバッグ/検証用に公開(プレビューと保存画像の一致確認に使える) */
window.createResultCanvas = function () { return createResultCanvas(); };
async function createResultCanvas() {
  var canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  await renderIntoCanvas(canvas);
  return canvas;
}
async function renderIntoCanvas(canvas) {
  var ctx = canvas.getContext("2d");
  await ensureFonts();
  var imgs = await loadSelectedImages();
  drawDesign(ctx, currentDesignId, imgs);
}

function isInAppBrowser() {
  var ua = navigator.userAgent || "";
  return /Twitter|X11;.*Twitter|Line\/|Instagram|FBAN|FBAV|FB_IAB/i.test(ua);
}

function canvasToBlob(canvas) {
  return new Promise(function (resolve, reject) {
    canvas.toBlob(function (blob) {
      if (blob) resolve(blob); else reject(new Error("Blob creation failed"));
    }, "image/png");
  });
}

async function saveResultImage() {
  var originalText = saveBtn.textContent;
  var fileName = "oshi-visual-6-" + currentDesignId + ".png";

  saveBtn.disabled = true;
  saveBtn.textContent = "画像を作成中…";
  setStatus("画像を作成中…", true);

  try {
    var canvas = await createResultCanvas();
    var blob = await canvasToBlob(canvas);
    var file = new File([blob], fileName, { type: "image/png" });

    // 1) 共有シート(iPhone Safariで「画像を保存」できる)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ title: "推しビジュ6選", text: "推しビジュ6選を作ったよ", files: [file] });
        setStatus("共有シートを開きました。", true);
        stampTape();
        return;
      } catch (shareError) {
        if (shareError && shareError.name === "AbortError") {
          setStatus("共有をキャンセルしました。", true);
          return;
        }
        // 共有自体の失敗は次の手段へ
      }
    }

    // 2) アプリ内ブラウザ(Xなど)はダウンロード不可のことが多い
    //    → 画像を表示して長押し保存してもらう
    if (isInAppBrowser()) {
      showFallbackImage(canvas);
      setStatus("画像を長押しして保存してください。", true);
      stampTape();
      return;
    }

    // 3) 通常ダウンロード
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    setStatus("画像を保存しました。", true);
    stampTape();
  } catch (error) {
    console.error(error);
    // 失敗時も長押し保存の道を残す
    try {
      var c2 = await createResultCanvas();
      showFallbackImage(c2);
      setStatus("自動保存できなかったので、画像を長押しして保存してください。");
    } catch (e2) {
      setStatus("画像の保存に失敗しました。プレビューをスクリーンショットしてください。");
    }
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
  }
}

function showFallbackImage(canvas) {
  fallbackImage.src = canvas.toDataURL("image/png");
  saveFallback.classList.add("active");
}

function stampTape() {
  tapeB.classList.remove("stamped");
  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(function () { tapeB.classList.add("stamped"); });
  });
}

function setStatus(message, ok) {
  statusEl.textContent = message || "";
  statusEl.classList.toggle("ok", !!ok);
  if (!message) return;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(function(){ statusEl.textContent = ""; }, 3500);
}

})();
