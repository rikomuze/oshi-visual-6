/* ==========================================================================
   muze-image.js — 画像アップロード / 位置調整 / Canvas出力 / スマホ保存
   依存: muze-core.js(MUZE名前空間) / html2canvas(captureElement利用時のみ)
   html2canvas は必ずバージョン固定で読み込むこと:
     <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>

   設計方針:
   - ビジュメーカー系の「完成画像」は html2canvas ではなく素のCanvasに直接描く
     (oshi-visual-6で実証済み。フォント/transformの再現ズレと停止問題を回避)。
   - プレビュー(CSS object-position/scale)と出力(drawCover)は同じ計算式を使う。
   - iOSのCanvas上限(1辺約4096px / 総ピクセル約1677万)を safeScale で必ず守る。
   ========================================================================== */
(function () {
  "use strict";

  var MUZE = window.MUZE = window.MUZE || {};

  /* ======================================================================
     1. 画像の読み込み
     ====================================================================== */

  /** 画像をPromiseで読み込む。失敗時は reject せず null を返す(描画スキップ用) */
  MUZE.loadImage = function (src) {
    return new Promise(function (resolve) {
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { resolve(null); };
      image.src = src;
    });
  };

  /**
   * アップロードされた画像ファイルを検証し、大きすぎる場合は縮小してdataURLにする。
   * スマホの12MP写真をそのまま使うとiOSでメモリ逼迫するため、既定で長辺2048pxに縮小。
   *
   * opts:
   *   maxSide     縮小後の長辺px(既定 2048)
   *   maxBytes    受け付ける最大ファイルサイズ(既定 20MB)
   *   mimeOut     出力形式(既定 元がpng→png / それ以外→jpeg 0.92)
   * 戻り値: Promise<{ src, width, height }>(失敗時 reject(Error) — messageは日本語)
   */
  MUZE.readUploadedImage = function (file, opts) {
    opts = opts || {};
    var maxSide = opts.maxSide || 2048;
    var maxBytes = opts.maxBytes || 20 * 1024 * 1024;

    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error("ファイルが選択されていません。"));
      if (!file.type || file.type.indexOf("image/") !== 0) {
        return reject(new Error("画像ファイルを選んでください。"));
      }
      if (file.size > maxBytes) {
        return reject(new Error("画像が大きすぎます(20MBまで)。"));
      }

      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("画像の読み込みに失敗しました。")); };
      reader.onload = function () {
        var dataUrl = reader.result;
        var img = new Image();
        img.onerror = function () { reject(new Error("画像を開けませんでした。別の画像でお試しください。")); };
        img.onload = function () {
          var w = img.naturalWidth;
          var h = img.naturalHeight;
          var longest = Math.max(w, h);

          // 十分小さければそのまま使う
          if (longest <= maxSide) {
            return resolve({ src: dataUrl, width: w, height: h });
          }

          // 縮小して再エンコード
          var ratio = maxSide / longest;
          var canvas = document.createElement("canvas");
          canvas.width = Math.round(w * ratio);
          canvas.height = Math.round(h * ratio);
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          var mime = opts.mimeOut || (file.type === "image/png" ? "image/png" : "image/jpeg");
          var out = canvas.toDataURL(mime, 0.92);
          resolve({ src: out, width: canvas.width, height: canvas.height });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  /**
   * <input type="file"> にアップロード処理を配線する。
   * 検証・縮小・inputのリセットまで面倒を見る。
   * cb(result) 成功時 / onError(err) 失敗時(省略時はalert)
   */
  MUZE.attachUpload = function (inputEl, cb, onError) {
    inputEl.addEventListener("change", function (event) {
      var file = event.target.files && event.target.files[0];
      inputEl.value = ""; // 同じファイルを続けて選べるように毎回リセット
      if (!file) return;
      MUZE.readUploadedImage(file).then(cb).catch(function (err) {
        if (onError) onError(err);
        else window.alert(err.message);
      });
    });
  };

  /* ======================================================================
     2. 位置調整(左右・上下・拡大)
     プレビューとCanvas出力で同じ state {posX, posY, scale} を共有する。
     ====================================================================== */

  var ADJUST_DEFAULTS = { posX: 50, posY: 20, scale: 100 };

  /** 調整stateの既定値を補完 */
  MUZE.adjustDefaults = function (state) {
    state = state || {};
    return {
      posX: state.posX !== undefined ? state.posX : ADJUST_DEFAULTS.posX,
      posY: state.posY !== undefined ? state.posY : ADJUST_DEFAULTS.posY,
      scale: state.scale !== undefined ? state.scale : ADJUST_DEFAULTS.scale
    };
  };

  /** プレビュー用のCSS文字列(<img> の style に足す) */
  MUZE.adjustStyle = function (state) {
    var a = MUZE.adjustDefaults(state);
    return "object-fit: cover; object-position: " + a.posX + "% " + a.posY + "%;" +
           " transform: scale(" + (a.scale / 100) + "); transform-origin: center center;";
  };

  /**
   * 位置調整スライダーUIを container 内に生成する。
   * state(参照渡し)を直接更新し、変更のたびに onChange(state) を呼ぶ。
   * 戻り値: { sync() } — 外部でstateを変えた後にスライダー表示を合わせる
   */
  MUZE.createAdjuster = function (container, state, onChange) {
    var rows = [
      { key: "posX",  label: "左右位置", min: 0,  max: 100, unit: "%" },
      { key: "posY",  label: "上下位置", min: 0,  max: 100, unit: "%" },
      { key: "scale", label: "拡大・縮小", min: 80, max: 200, unit: "%" }
    ];

    container.classList.add("m-adjust");
    container.innerHTML = "";
    var inputs = {};

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

      function paint() {
        var v = MUZE.adjustDefaults(state)[row.key];
        input.value = v;
        val.textContent = v + row.unit;
      }
      paint();

      input.addEventListener("input", function () {
        state[row.key] = Number(input.value);
        val.textContent = input.value + row.unit;
        if (onChange) onChange(state);
      });

      label.appendChild(name);
      label.appendChild(val);
      wrap.appendChild(label);
      wrap.appendChild(input);
      container.appendChild(wrap);
      inputs[row.key] = paint;
    });

    return {
      sync: function () {
        Object.keys(inputs).forEach(function (k) { inputs[k](); });
      }
    };
  };

  /* ======================================================================
     3. Canvas描画ヘルパー
     ====================================================================== */

  /** 角丸長方形のパスを作る(fill/clipは呼び出し側で) */
  MUZE.roundRect = function (ctx, x, y, width, height, radius) {
    var r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  /**
   * 画像を cover で領域いっぱいに描く。
   * adjust {posX, posY, scale} はプレビューの object-position / scale と同じ意味。
   * radius を指定すると角丸でクリップする。imgがnullなら何もしない。
   */
  MUZE.drawCover = function (ctx, img, x, y, width, height, adjust, radius) {
    if (!img) return;
    var a = MUZE.adjustDefaults(adjust);
    var baseScale = Math.max(width / img.naturalWidth, height / img.naturalHeight) * (a.scale / 100);
    var drawW = img.naturalWidth * baseScale;
    var drawH = img.naturalHeight * baseScale;
    var dx = x + (width - drawW) * (a.posX / 100);
    var dy = y + (height - drawH) * (a.posY / 100);

    ctx.save();
    if (radius) {
      MUZE.roundRect(ctx, x, y, width, height, radius);
      ctx.clip();
    } else {
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.clip();
    }
    ctx.drawImage(img, dx, dy, drawW, drawH);
    ctx.restore();
  };

  /** 中心を軸に回転して描く(手描き文字素材など)。widthから高さは縦横比で自動算出 */
  MUZE.drawRotatedImage = function (ctx, img, x, y, width, rotationDeg) {
    if (!img) return;
    var height = width * (img.naturalHeight / img.naturalWidth);
    ctx.save();
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate((rotationDeg || 0) * Math.PI / 180);
    ctx.drawImage(img, -width / 2, -height / 2, width, height);
    ctx.restore();
  };

  /** canvas.toBlob のPromise版 */
  MUZE.canvasToBlob = function (canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error("画像データの作成に失敗しました。"));
      }, type || "image/png", quality);
    });
  };

  /* ======================================================================
     4. iOS対策: Canvasサイズの安全上限
     iOS Safari は 1辺約4096px / 総ピクセル約1677万を超えるCanvasを
     エラーなしで空にすることがある(best-visualのscale:5問題)。
     ====================================================================== */

  var MAX_CANVAS_SIDE = 4096;
  var MAX_CANVAS_AREA = 16000000; // 上限より少し余裕を持たせる

  /** 要素サイズ(w×h)に対して安全な最大scaleを返す(wanted を超えない) */
  MUZE.safeScale = function (width, height, wanted) {
    var bySide = Math.min(MAX_CANVAS_SIDE / width, MAX_CANVAS_SIDE / height);
    var byArea = Math.sqrt(MAX_CANVAS_AREA / (width * height));
    var safe = Math.min(wanted || 2, bySide, byArea);
    return Math.max(1, Math.floor(safe * 100) / 100);
  };

  /**
   * html2canvas ラッパー(チェックリスト系など、DOMをそのまま画像化したい場合用)。
   * opts.scale は希望値。実際は safeScale でクランプされる。
   */
  MUZE.captureElement = function (el, opts) {
    opts = opts || {};
    if (typeof window.html2canvas !== "function") {
      return Promise.reject(new Error("html2canvas が読み込まれていません。"));
    }
    var rect = el.getBoundingClientRect();
    var scale = MUZE.safeScale(rect.width, rect.height, opts.scale || 2);
    return window.html2canvas(el, {
      backgroundColor: opts.backgroundColor !== undefined ? opts.backgroundColor : "#ffffff",
      scale: scale,
      useCORS: true,
      logging: false
    });
  };

  /* ======================================================================
     5. 保存(スマホ共有シート → ダウンロード → スクショ案内)
     ====================================================================== */

  /**
   * Canvasを画像として保存する統一フロー。
   * 1) ファイル共有対応端末 → 共有シート(スマホの「画像を保存」導線)
   *    - キャンセル(AbortError)はエラー扱いしない
   * 2) 非対応(PC等) → <a download> でダウンロード(window.openは使わない)
   * 3) 失敗 → スクリーンショット案内
   *
   * opts:
   *   fileName  保存ファイル名(必須推奨。既定 "image.png")
   *   title     共有シートのタイトル
   *   text      共有シートの本文
   *   button    処理中に無効化するボタン要素(任意)
   *   statusEl  MUZE.status で進捗を出す要素(任意)
   * 戻り値: Promise<"shared" | "downloaded" | "cancelled">
   */
  MUZE.saveCanvas = function (canvas, opts) {
    opts = opts || {};
    var fileName = opts.fileName || "image.png";
    var button = opts.button || null;
    var statusEl = opts.statusEl || null;
    var originalText = button ? button.textContent : "";

    function setBusy(busy, text) {
      if (!button) return;
      button.disabled = busy;
      button.textContent = text || originalText;
    }

    setBusy(true, "画像を作成中…");
    MUZE.status(statusEl, "画像を作成中…", 0);

    return MUZE.canvasToBlob(canvas)
      .then(function (blob) {
        var file = new File([blob], fileName, { type: "image/png" });

        // --- スマホ: 共有シート ---
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          return navigator.share({
            files: [file],
            title: opts.title || fileName,
            text: opts.text || ""
          }).then(function () {
            MUZE.status(statusEl, "共有シートを開きました。");
            return "shared";
          }).catch(function (err) {
            if (err && err.name === "AbortError") {
              MUZE.status(statusEl, "共有をキャンセルしました。");
              return "cancelled";
            }
            // 共有自体に失敗した場合はダウンロードへフォールバック
            return downloadBlob(blob);
          });
        }

        // --- PC等: ダウンロード ---
        return downloadBlob(blob);

        function downloadBlob(b) {
          var url = URL.createObjectURL(b);
          var a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          MUZE.status(statusEl, "画像を保存しました。");
          return "downloaded";
        }
      })
      .catch(function (err) {
        console.error("[muze-image] save failed:", err);
        MUZE.status(statusEl,
          "画像の保存に失敗しました。うまくいかない場合は画面をスクリーンショットしてください。", 6000);
        throw err;
      })
      .finally(function () {
        setBusy(false);
      });
  };

  /** DOM要素をそのまま画像化して保存(captureElement + saveCanvas) */
  MUZE.saveElement = function (el, opts) {
    opts = opts || {};
    var button = opts.button || null;
    if (button) { button.disabled = true; button.textContent = "画像を作成中…"; }
    return MUZE.captureElement(el, opts)
      .then(function (canvas) { return MUZE.saveCanvas(canvas, opts); })
      .catch(function (err) {
        MUZE.status(opts.statusEl,
          "画像の保存に失敗しました。うまくいかない場合は画面をスクリーンショットしてください。", 6000);
        throw err;
      });
  };

  /* ======================================================================
     6. プリセット画像ピッカー(モーダル)
     images/<group>/01.jpg 形式の連番画像から選ぶUI。
     jpg→png の拡張子フォールバック、lazy loading、ESC/背景タップで閉じる、
     開いた元のボタンへフォーカスを戻す、まで面倒を見る。
     ====================================================================== */

  /**
   * opts:
   *   title       モーダル見出し(既定 "画像を選んでください")
   *   basePath    例 "images"(既定)
   *   exts        試す拡張子の順(既定 ["jpg","png"])
   *   count       連番の枚数
   *   descending  trueで新しい番号から表示
   * 戻り値 picker:
   *   picker.open({ group, count?, selectedSrc?, onSelect(src) })
   *   picker.close()
   */
  MUZE.createPicker = function (opts) {
    opts = opts || {};
    var basePath = opts.basePath || "images";
    var exts = opts.exts || ["jpg", "png"];
    var defaultCount = opts.count || 15;

    // DOM構築(1回だけ)
    var modal = document.createElement("div");
    modal.className = "m-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    var box = document.createElement("div");
    box.className = "m-modal__box";

    var head = document.createElement("div");
    head.className = "m-modal__head";
    var title = document.createElement("h2");
    title.textContent = opts.title || "画像を選んでください";
    var closeBtn = document.createElement("button");
    closeBtn.className = "m-modal__close";
    closeBtn.setAttribute("aria-label", "閉じる");
    closeBtn.textContent = "✕";

    var grid = document.createElement("div");
    grid.className = "m-picker-grid";

    head.appendChild(title);
    head.appendChild(closeBtn);
    box.appendChild(head);
    box.appendChild(grid);
    modal.appendChild(box);
    document.body.appendChild(modal);

    var lastFocused = null;

    function close() {
      modal.classList.remove("is-open");
      grid.innerHTML = "";
      document.removeEventListener("keydown", onKeydown);
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    function onKeydown(e) {
      if (e.key === "Escape") close();
    }

    closeBtn.addEventListener("click", close);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) close();
    });

    function open(openOpts) {
      openOpts = openOpts || {};
      lastFocused = document.activeElement;
      grid.innerHTML = "";
      if (openOpts.title) title.textContent = openOpts.title;

      var count = openOpts.count || defaultCount;
      var numbers = [];
      for (var i = 1; i <= count; i++) numbers.push(MUZE.pad2(i));
      if (opts.descending) numbers.reverse();

      numbers.forEach(function (number) {
        var button = document.createElement("button");
        button.type = "button";

        var img = document.createElement("img");
        img.src = basePath + "/" + openOpts.group + "/" + number + "." + exts[0];
        img.alt = openOpts.group + " " + number;
        img.loading = "lazy";
        img.onerror = function () {
          MUZE.imgFallback(img, exts, function () {
            button.style.display = "none"; // 全拡張子で404 → その番号は無い
          });
        };

        if (openOpts.selectedSrc && openOpts.selectedSrc.indexOf("/" + openOpts.group + "/" + number + ".") !== -1) {
          button.classList.add("is-selected");
        }

        button.appendChild(img);
        button.addEventListener("click", function () {
          if (openOpts.onSelect) openOpts.onSelect(img.currentSrc || img.src);
          close();
        });
        grid.appendChild(button);
      });

      modal.classList.add("is-open");
      document.addEventListener("keydown", onKeydown);
      closeBtn.focus();
    }

    return { open: open, close: close, element: modal };
  };

})();
