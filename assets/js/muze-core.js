/* ==========================================================================
   muze-core.js — MUZE TOOL BOX 共通基盤(基本機能)
   依存: tools.config.js(先に読み込むこと)
   使い方:
     <script src=".../muze-core/js/tools.config.js"></script>
     <script src=".../muze-core/js/muze-core.js"></script>
     <script> MUZE.renderHeader("visual6"); </script>
   すべての機能はグローバル MUZE 名前空間に入る(ビルド不要・file://直開きでも動く)。
   ========================================================================== */
(function () {
  "use strict";

  var MUZE = window.MUZE = window.MUZE || {};

  /* ---------- ユーティリティ ---------- */

  /** 1 → "01" の連番文字列 */
  MUZE.pad2 = function (n) {
    return String(n).padStart(2, "0");
  };

  /** 12345 → "¥12,345" */
  MUZE.formatYen = function (value) {
    return "¥" + Number(value || 0).toLocaleString("ja-JP");
  };

  /** 範囲内に丸める */
  MUZE.clamp = function (value, min, max) {
    return Math.min(max, Math.max(min, value));
  };

  /**
   * ファイル付きWeb Shareが使えるか(機能検出)。
   * UA文字列判定はiPadOSデスクトップUA等を取りこぼすため使わない。
   */
  MUZE.canWebShareFiles = function () {
    try {
      if (!navigator.canShare) return false;
      var probe = new File([new Blob(["x"])], "probe.png", { type: "image/png" });
      return navigator.canShare({ files: [probe] });
    } catch (e) {
      return false;
    }
  };

  /**
   * <img> の拡張子フォールバック。
   * 例: MUZE.imgFallback(img, ["jpg", "png"]) — jpgが404ならpngを試し、
   * 全滅したら onExhausted(img) を呼ぶ(既定: 非表示)。
   * HTML側: <img src="images/x/01.jpg" onerror="MUZE.imgFallback(this, ['jpg','png'])">
   */
  MUZE.imgFallback = function (img, exts, onExhausted) {
    var i = Number(img.dataset.muzeExtIndex || 0) + 1;
    img.dataset.muzeExtIndex = i;
    if (i < exts.length) {
      img.src = img.src.replace(/\.[a-zA-Z]+(\?.*)?$/, "." + exts[i]);
    } else if (onExhausted) {
      onExhausted(img);
    } else {
      img.style.display = "none";
    }
  };

  /* ---------- ステータス表示 ---------- */

  var statusTimers = new WeakMap();

  /**
   * 自動で消えるステータスメッセージ。
   * el: 表示先要素(class="m-status" 推奨) / msg: 文言 / ms: 表示時間(0で消えない)
   */
  MUZE.status = function (el, msg, ms) {
    if (!el) return;
    el.textContent = msg || "";
    var prev = statusTimers.get(el);
    if (prev) window.clearTimeout(prev);
    if (msg && ms !== 0) {
      statusTimers.set(el, window.setTimeout(function () {
        el.textContent = "";
      }, ms || 3500));
    }
  };

  /* ---------- localStorage ラッパー ---------- */
  /* Safariプライベートモード等で setItem が例外を投げてもツールを止めない */

  MUZE.store = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false; // 保存できなくても操作自体は続行できるようにする
      }
    },
    remove: function (key) {
      try { window.localStorage.removeItem(key); } catch (e) { /* noop */ }
    }
  };

  /* ---------- 共通ヘッダー ---------- */

  /**
   * tools.config.js の設定から共通ヘッダーを生成して挿入する。
   * activeId: 現在のツールのid("visual6" など)。ナビの該当リンクが強調される。
   * mountEl: 挿入先(省略時は body の先頭)
   */
  MUZE.renderHeader = function (activeId, mountEl) {
    var cfg = window.MUZE_TOOLS;
    if (!cfg || !cfg.nav) {
      console.warn("[muze-core] tools.config.js が読み込まれていません。ヘッダーを生成できません。");
      return null;
    }

    var header = document.createElement("header");
    header.className = "m-header";

    var inner = document.createElement("div");
    inner.className = "m-header__inner";

    var logo = document.createElement("a");
    logo.className = "m-header__logo";
    logo.href = cfg.home;
    logo.textContent = cfg.siteName + " ";
    if (cfg.siteMark) {
      var mark = document.createElement("span");
      mark.textContent = cfg.siteMark;
      logo.appendChild(mark);
    }

    var nav = document.createElement("nav");
    nav.className = "m-header__nav";
    nav.setAttribute("aria-label", "共通ナビゲーション");

    cfg.nav.forEach(function (item) {
      var a = document.createElement("a");
      a.href = item.url;
      a.textContent = item.label;
      if (item.id === activeId) {
        a.classList.add("is-active");
        a.setAttribute("aria-current", "page");
      }
      nav.appendChild(a);
    });

    inner.appendChild(logo);
    inner.appendChild(nav);
    header.appendChild(inner);

    if (mountEl) {
      mountEl.appendChild(header);
    } else {
      document.body.insertBefore(header, document.body.firstChild);
    }
    return header;
  };

  /* ---------- 共通フッター(非公式表記) ---------- */

  /**
   * 非公式ファンメイド表記のフッターを body 末尾に追加する。
   * extraText: 追記したい文言(任意)
   */
  MUZE.renderFooter = function (extraText) {
    var cfg = window.MUZE_TOOLS || {};
    var footer = document.createElement("footer");
    footer.className = "m-footer";
    var lines = [
      "このサイトはファンが個人で運営する非公式ツールです。所属事務所・レーベルとは関係ありません。"
    ];
    if (extraText) lines.push(extraText);
    footer.innerHTML = lines.map(function (t) { return "<div>" + t + "</div>"; }).join("");
    if (cfg.home) {
      var back = document.createElement("div");
      var a = document.createElement("a");
      a.href = cfg.home;
      a.textContent = (cfg.siteName || "TOP") + " へ戻る";
      back.appendChild(a);
      footer.appendChild(back);
    }
    document.body.appendChild(footer);
    return footer;
  };

})();
