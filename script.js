/* ==========================================================
   إعدادات المتجر: عدّل هذه القيم فقط
   ========================================================== */
const CONFIG = {
  storeName: "Kenzo Shop",
  productName: "سِرّ الفخامة",

  priceUSD: 14,                    // سعر القطعة بالدولار
  oldPriceUSD: 0,                  // السعر القديم المشطوب، اتركه 0 لإخفائه
  shippingUSD: 0,                  // 0 = توصيل مجاني

  whatsappNumber: "963931493129",  // رقم واتساب بصيغة دولية بلا + (هو 0931493129)
  displayPhone: "0931 493 129",    // الرقم الظاهر في ذيل الصفحة

  /* ----- سعر الصرف (ليرة سورية جديدة مقابل 1 دولار) ----- */
  // المصدر: LiraScope (عام، بلا مفتاح، 60 طلباً في الدقيقة لكل IP)
  rateUrl: "https://lirascope.syria-cloud.sy/api/v1/rates/latest?currencies=USD",
  rateSet: "effective",            // أي سعر تعتمد: "effective" (الفعّال) أو "market" (السوق) أو "cbs" (المصرف المركزي)
  rateField: "sell",               // "sell" (سعر البيع، المعتمد) أو "buy" (شراء) أو "mid" (وسطي)
  fixedRate: 0,                    // اكتب رقماً (مثل 117) لتثبيت السعر يدوياً وتعطيل الجلب من LiraScope
  fallbackRate: 151.75,            // يُستخدم فقط إذا تعذّر الوصول إلى LiraScope. حدّثه من حين لآخر

  /* ----- فيسبوك بيكسل ----- */
  facebookPixelId: "",             // ضع رقم البيكسل هنا (أرقام فقط). إن تُرك فارغاً لا يعمل البيكسل

  /* ----- تسجيل الطلب في Google Sheets ----- */
  sheetUrl: "https://script.google.com/macros/s/AKfycbyaeqn0n0Ooy-fEMimCe8Po939CQT8P9HDiK-J_QtFa8zKltFRGTmURpVBXaI8WXelY/exec",                    // رابط تطبيق الويب (Web App) من Google Apps Script. انظر ملف Code.gs
  codeDigits: 5,                   // عدد خانات رمز الطلب (رقم الصف في الجدول مع أصفار في البداية)

  /* ----- حسابات التواصل (املأها أنت) ----- */
  facebookUrl: "",
  instagramUrl: ""
};

/* ========================================================== */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* تجاهل */ } }
  };

  const fmtUSD = n => "$" + (Number.isInteger(n) ? n : n.toFixed(2));
  const fmtSYP = n => Math.round(n).toLocaleString("en-US") + " ل.س";

  /* ==========================================================
     فيسبوك بيكسل
     ========================================================== */
  function loadPixel(id) {
    if (!/^\d{5,}$/.test(id)) return;
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    window.fbq("init", id);
    window.fbq("track", "PageView");
  }
  const track = (ev, data) => { try { if (window.fbq) window.fbq("track", ev, data); } catch (e) { /* تجاهل */ } };

  loadPixel(String(CONFIG.facebookPixelId || "").trim());
  track("ViewContent", { content_name: CONFIG.productName, content_type: "product", value: CONFIG.priceUSD, currency: "USD" });

  /* ==========================================================
     نصوص عامة وروابط التواصل
     ========================================================== */
  $$("[data-store-name]").forEach(el => (el.textContent = CONFIG.storeName));
  $$("[data-display-phone]").forEach(el => (el.textContent = CONFIG.displayPhone));
  $("#year").textContent = new Date().getFullYear();

  const waNum = CONFIG.whatsappNumber.replace(/\D/g, "");
  const waBase = waNum ? "https://wa.me/" + waNum : "";

  function setSocial(el, url) {
    if (url) { el.href = url; return; }
    el.href = "#";                                  // فارغ الآن: املأه من CONFIG
    el.addEventListener("click", e => e.preventDefault());
  }
  setSocial($("#socFb"), CONFIG.facebookUrl);
  setSocial($("#socIg"), CONFIG.instagramUrl);
  setSocial($("#socWa"), waBase);
  setSocial($("#footWa"), waBase);

  /* ==========================================================
     السعر وسعر الصرف
     ========================================================== */
  $("[data-price-now]").textContent = fmtUSD(CONFIG.priceUSD);
  if (CONFIG.oldPriceUSD > CONFIG.priceUSD) {
    const old = $("[data-price-old]");
    old.textContent = fmtUSD(CONFIG.oldPriceUSD);
    old.hidden = false;
  }

  let rate = CONFIG.fixedRate > 0 ? CONFIG.fixedRate : CONFIG.fallbackRate;
  let rateSource = CONFIG.fixedRate > 0 ? "fixed" : "fallback";
  let showSyp = store.get("kz_syp") === "1";

  // إذا كان الرقم كبيراً فهو بالليرة القديمة: نحذف صفرين
  const normalize = r => {
    r = Number(r);
    if (!isFinite(r) || r <= 0) return 0;
    return r > 2000 ? r / 100 : r;
  };

  async function fetchJson(url, ms = 6000) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    try {
      const res = await fetch(url, { signal: c.signal, cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      return await res.json();
    } finally { clearTimeout(t); }
  }

  // يقرأ سعر USD من استجابة LiraScope: effectiveRates ثم marketRates ثم cbsRates
  function pickRate(data) {
    if (data && data.rate) return data.rate;                      // رابط وسيط خاص بك يرجع {"rate": 117}
    const order = { effective: ["effectiveRates", "marketRates", "cbsRates"],
                    market: ["marketRates", "effectiveRates", "cbsRates"],
                    cbs: ["cbsRates", "effectiveRates", "marketRates"] }[CONFIG.rateSet] || ["effectiveRates", "marketRates", "cbsRates"];
    for (const key of order) {
      const row = ((data && data[key]) || []).find(r => r && r.currency === "USD");
      if (!row) continue;
      const v = Number(row[CONFIG.rateField]) || Number(row.sell) || Number(row.mid);
      if (v > 0) return v;
    }
    return 0;
  }

  async function loadRate() {
    if (CONFIG.fixedRate > 0 || !CONFIG.rateUrl) return;
    const cached = JSON.parse(store.get("kz_rate_ls") || "null");
    if (cached && Date.now() - cached.t < 30 * 60 * 1000) {       // نعيد استخدام السعر 30 دقيقة (يوفر الطلبات)
      rate = cached.r; rateSource = "live"; render(); return;
    }
    try {
      const r = normalize(pickRate(await fetchJson(CONFIG.rateUrl)));
      if (r > 0) {
        rate = r; rateSource = "live";
        store.set("kz_rate_ls", JSON.stringify({ r, t: Date.now() }));
      }
    } catch (e) {
      // يبقى السعر الاحتياطي. السبب يظهر في Console (F12) لمن يريد التشخيص
      console.warn("تعذّر جلب سعر الصرف من LiraScope، استُخدم السعر الاحتياطي:", e);
    }
    render();
  }

  /* ==========================================================
     الكمية والملخص
     ========================================================== */
  let qty = 1;
  const MAX_QTY = 10;
  const sum = k => $(`[data-sum="${k}"]`);
  const shipLabel = () => CONFIG.shippingUSD > 0 ? fmtUSD(CONFIG.shippingUSD) : "مجاني";
  const totalUSD = () => CONFIG.priceUSD * qty + (CONFIG.shippingUSD || 0);

  function render() {
    const total = totalUSD();
    $("#qtyN").textContent = qty;
    sum("unit").textContent = fmtUSD(CONFIG.priceUSD);
    sum("qty").textContent = qty;
    sum("ship").textContent = shipLabel();
    sum("total").textContent = fmtUSD(total);

    // الليرة السورية الجديدة (اختيارية)
    $$("[data-syp-toggle]").forEach(b => {
      b.setAttribute("aria-pressed", showSyp ? "true" : "false");
      b.textContent = showSyp ? "إخفاء السعر بالليرة السورية" : "اعرض السعر بالليرة السورية الجديدة";
    });
    const heroSyp = $("[data-price-syp]");
    heroSyp.hidden = !showSyp;
    heroSyp.textContent = showSyp ? fmtSYP(CONFIG.priceUSD * rate) + " جديدة" : "";
    $(".sum__syp").hidden = !showSyp;
    sum("syp").textContent = fmtSYP(total * rate);
  }

  $$("[data-qty]").forEach(b =>
    b.addEventListener("click", () => {
      qty = Math.min(MAX_QTY, Math.max(1, qty + Number(b.dataset.qty)));
      render();
    })
  );
  $$("[data-syp-toggle]").forEach(b =>
    b.addEventListener("click", () => {
      showSyp = !showSyp;
      store.set("kz_syp", showSyp ? "1" : "0");
      render();
    })
  );
  render();
  loadRate();

  /* ==========================================================
     رقم الهاتف: سوريا افتراضياً مع إمكانية تغيير رمز الدولة
     ========================================================== */
  // min/max: عدد خانات الرقم المحلي بدون صفر البداية
  const COUNTRIES = [
    { id: "SY", name: "سوريا", code: "963", min: 9, max: 9, lead: "9", ph: "9XX XXX XXX", hint: "رقم سوري يبدأ بـ 9، بدون صفر البداية." },
    { id: "SA", name: "السعودية", code: "966", min: 9, max: 9, ph: "5X XXX XXXX" },
    { id: "AE", name: "الإمارات", code: "971", min: 9, max: 9, ph: "5X XXX XXXX" },
    { id: "KW", name: "الكويت", code: "965", min: 8, max: 8, ph: "XXXX XXXX" },
    { id: "QA", name: "قطر", code: "974", min: 8, max: 8, ph: "XXXX XXXX" },
    { id: "BH", name: "البحرين", code: "973", min: 8, max: 8, ph: "XXXX XXXX" },
    { id: "OM", name: "عُمان", code: "968", min: 8, max: 8, ph: "XXXX XXXX" },
    { id: "JO", name: "الأردن", code: "962", min: 9, max: 9, ph: "7X XXX XXXX" },
    { id: "LB", name: "لبنان", code: "961", min: 7, max: 8, ph: "XX XXX XXX" },
    { id: "IQ", name: "العراق", code: "964", min: 10, max: 10, ph: "7XX XXX XXXX" },
    { id: "EG", name: "مصر", code: "20", min: 10, max: 10, ph: "1XX XXX XXXX" },
    { id: "TR", name: "تركيا", code: "90", min: 10, max: 10, ph: "5XX XXX XXXX" },
    { id: "DE", name: "ألمانيا", code: "49", min: 10, max: 11, ph: "1XX XXXXXXX" },
    { id: "NL", name: "هولندا", code: "31", min: 9, max: 9, ph: "6 XXXX XXXX" },
    { id: "SE", name: "السويد", code: "46", min: 9, max: 9, ph: "7X XXX XX XX" },
    { id: "FR", name: "فرنسا", code: "33", min: 9, max: 9, ph: "6 XX XX XX XX" },
    { id: "GB", name: "بريطانيا", code: "44", min: 10, max: 10, ph: "7XXX XXXXXX" },
    { id: "US", name: "أمريكا وكندا", code: "1", min: 10, max: 10, ph: "XXX XXX XXXX" }
  ];
  const ccSel = $("#f-cc");
  const phone = $("#f-phone");
  ccSel.innerHTML = COUNTRIES.map(c => `<option value="${c.id}">+${c.code} ${c.name}</option>`).join("");
  ccSel.value = "SY";

  const country = () => COUNTRIES.find(c => c.id === ccSel.value) || COUNTRIES[0];
  const toLatin = s => s
    .replace(/[٠-٩]/g, c => "٠١٢٣٤٥٦٧٨٩".indexOf(c))
    .replace(/[۰-۹]/g, c => "۰۱۲۳۴۵۶۷۸۹".indexOf(c));

  // ينظّف الرقم: أرقام فقط، يحذف 00 ورمز الدولة إن لصقه المستخدم، وصفر البداية
  function cleanPhone(raw, c = country()) {
    let d = toLatin(raw).replace(/\D/g, "");
    if (d.startsWith("00")) d = d.slice(2);
    if (d.startsWith(c.code) && d.length > c.max) d = d.slice(c.code.length);
    if (d.startsWith("0")) d = d.slice(1);
    return d.slice(0, c.max);
  }
  const spaced = d => d.replace(/(\d{3})(?=\d)/g, "$1 ");

  function applyCountry() {
    const c = country();
    phone.placeholder = c.ph;
    $("#phone-hint").textContent = c.hint || "أدخل رقمك بدون صفر البداية. اختر رمز دولتك من القائمة.";
    phone.value = spaced(cleanPhone(phone.value, c));
  }
  ccSel.addEventListener("change", () => { applyCountry(); if ($(".field.invalid [name=phone]")) check("phone"); });
  phone.addEventListener("input", () => {
    phone.value = spaced(cleanPhone(phone.value));
    // تنبيه فوري إذا بدأ الرقم السوري بغير 9
    const c = country(), d = cleanPhone(phone.value, c);
    if (c.lead && d && d[0] !== c.lead) { check("phone"); return; }
    // صحّح الرقم؟ أخفِ التنبيه فوراً (التحقق من الطول يتم عند مغادرة الحقل أو الإرسال)
    const f = phone.closest(".field");
    if (f.classList.contains("invalid")) {
      f.classList.remove("invalid"); phone.setAttribute("aria-invalid", "false");
      $('[data-err="phone"]').textContent = "";
    }
  });
  applyCountry();

  /* ==========================================================
     حقل العنوان: يتمدد تلقائياً
     ========================================================== */
  const addr = $("#f-addr");
  const grow = () => { addr.style.height = "auto"; addr.style.height = Math.min(addr.scrollHeight + 2, 240) + "px"; addr.style.overflowY = addr.scrollHeight > 240 ? "auto" : "hidden"; };
  addr.addEventListener("input", grow);
  grow();

  /* ==========================================================
     التحقق
     ========================================================== */
  const form = $("#orderForm");
  const rules = {
    name: v => (v.trim().length >= 3 ? "" : "اكتب اسمك الكامل (3 أحرف على الأقل)."),
    phone: v => {
      const c = country(), d = cleanPhone(v, c);
      if (!d) return "أدخل رقم هاتفك.";
      if (c.lead && d[0] !== c.lead) return `الرقم السوري يبدأ بالرقم ${c.lead}، مثل 9XX XXX XXX. تأكد من الرقم.`;
      if (d.length < c.min) return c.min === c.max ? `الرقم يجب أن يكون ${c.min} أرقام.` : `الرقم قصير، يجب أن يكون ${c.min} أرقام على الأقل.`;
      return "";
    },
    governorate: v => (v ? "" : "اختر المحافظة."),
    address: v => (v.trim().length >= 6 ? "" : "اكتب العنوان بالتفصيل (المنطقة والشارع).")
  };

  function check(name) {
    const el = form.elements[name];
    const msg = rules[name](el.value);
    el.closest(".field").classList.toggle("invalid", !!msg);
    $(`[data-err="${name}"]`).textContent = msg;
    el.setAttribute("aria-invalid", msg ? "true" : "false");
    return !msg;
  }
  Object.keys(rules).forEach(n => {
    form.elements[n].addEventListener("blur", () => check(n));
    form.elements[n].addEventListener("input", () => {
      if (form.elements[n].closest(".field").classList.contains("invalid")) check(n);
    });
  });

  // بدء إتمام الشراء (بيكسل) عند أول تفاعل مع النموذج
  let startedCheckout = false;
  form.addEventListener("focusin", () => {
    if (startedCheckout) return;
    startedCheckout = true;
    track("InitiateCheckout", { content_name: CONFIG.productName, value: totalUSD(), currency: "USD", num_items: qty });
  });

  /* ==========================================================
     رسالة واتساب
     ========================================================== */
  function buildMessage(o) {
    return [
      `*رمز الطلب:* ${o.code}`,
      `*الاسم:* ${o.name}`,
      `*الهاتف:* ${o.phone}`,
      `*المحافظة:* ${o.governorate}`,
      `*العنوان:* ${o.address}`,
      `*المنتج:* ${CONFIG.productName}`,
      `*العدد:* ${o.qty}`,
      `*السعر الإجمالي:* ${fmtUSD(o.totalUSD)}`
    ].concat(o.unsaved ? ["", "⚠️ لم يُسجَّل هذا الطلب في الجدول"] : []).join("\n");
  }

  /* ==========================================================
     الإرسال
     ========================================================== */
  const note = $("#formNote");
  const btn = $("#submitBtn");
  const done = $("#done");
  const grid = $(".order__grid");
  const waBtn = $("#waBtn");

  // إرسال JSON إلى Google Apps Script وقراءة الرد (مهلة 10 ثوانٍ)
  async function postOrder(url, payload) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 10000);
    try {
      // بدون ترويسات مخصصة حتى لا يحتاج المتصفح إلى preflight
      const res = await fetch(url, { method: "POST", body: JSON.stringify(payload), redirect: "follow", signal: c.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally { clearTimeout(t); }
  }

  let sending = false;
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (sending) return;
    note.textContent = ""; note.classList.remove("bad");

    if (form.elements.website.value) return;   // فخ الروبوتات

    const ok = Object.keys(rules).map(check).every(Boolean);
    if (!ok) {
      note.textContent = "راجع الحقول المظللة ثم أعد المحاولة.";
      note.classList.add("bad");
      const first = $(".field.invalid input, .field.invalid select, .field.invalid textarea");
      if (first) first.focus();
      return;
    }

    // نفتح نافذة واتساب الآن (داخل حدث الضغط حتى لا يحجبها المتصفح) ونملؤها بعد تسجيل الطلب
    let waWin = null;
    if (waBase) { try { waWin = window.open("", "_blank"); } catch (err) { waWin = null; } }

    sending = true;
    btn.disabled = true;
    btn.textContent = "جارٍ تسجيل طلبك…";

    const c = country();
    const d = cleanPhone(phone.value, c);
    const order = {
      code: "",
      product: CONFIG.productName,
      name: form.elements.name.value.trim(),
      phone: "+" + c.code + " " + spaced(d),
      governorate: form.elements.governorate.value,
      address: form.elements.address.value.trim().replace(/\s*\n\s*/g, "، "),
      qty,
      totalUSD: totalUSD()
    };

    // 1) تسجيل الطلب في Google Sheets: رمز الطلب = رقم الصف
    let saved = false;
    if (CONFIG.sheetUrl) {
      try {
        const res = await postOrder(CONFIG.sheetUrl, {
          name: order.name, phone: order.phone, governorate: order.governorate,
          address: order.address, product: order.product, qty: order.qty
        });
        if (res && res.ok && res.code) {
          order.code = String(res.code);
          if (typeof res.totalUSD === "number") order.totalUSD = res.totalUSD;
          saved = true;
        } else {
          console.warn("رد غير متوقع من Google Sheets:", res);
        }
      } catch (err) {
        console.warn("تعذّر تسجيل الطلب في Google Sheets:", err);
      }
    }
    // احتياطي: بدون جدول، أو فشل التسجيل: لا نخسر الطلب، نرسله عبر واتساب برمز مؤقت
    const unsaved = !!CONFIG.sheetUrl && !saved;
    if (!saved) order.code = (unsaved ? "T-" : "") + String(10000 + Math.floor(Math.random() * 10000));
    order.unsaved = unsaved;

    // 2) بيكسل: تم الطلب
    track("Purchase", { content_name: CONFIG.productName, content_type: "product", value: order.totalUSD, currency: "USD", num_items: qty });

    // 3) رسالة واتساب
    const link = waBase ? waBase + "?text=" + encodeURIComponent(buildMessage(order)) : "";
    let opened = false;
    if (link && waWin && !waWin.closed) {
      try { waWin.location.href = link; opened = true; } catch (err) { opened = false; }
    }
    if (link) { waBtn.href = link; waBtn.hidden = false; } else { waBtn.hidden = true; }

    sending = false;
    btn.disabled = false;
    btn.textContent = "تأكيد الطلب";

    grid.hidden = true;
    done.hidden = false;
    $("#doneCode").textContent = "# " + order.code;
    let msg;
    if (!link) msg = "تم تجهيز طلبك.";
    else if (unsaved) msg = "تعذّر تسجيل الطلب تلقائياً، لكن رسالة واتساب جاهزة. أرسلها ليصلنا طلبك ونؤكده معك.";
    else if (opened) msg = "فتحنا لك واتساب ومعه رسالة الطلب كاملة. اضغط إرسال ليصلنا طلبك.";
    else msg = "طلبك جاهز. اضغط الزر أدناه لفتح واتساب وإرسال رسالة الطلب.";
    $("#doneText").textContent = msg;
    done.focus();
    done.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  $("#againBtn").addEventListener("click", () => {
    form.reset();
    ccSel.value = "SY"; applyCountry();
    qty = 1; render(); grow();
    $$(".field.invalid").forEach(f => f.classList.remove("invalid"));
    $$(".err").forEach(p => (p.textContent = ""));
    done.hidden = true;
    grid.hidden = false;
    form.elements.name.focus();
  });

  /* ==========================================================
     ظهور العناصر عند التمرير + زر الطلب الثابت
     ========================================================== */
  const reveals = $$(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add("in"));
  }

  const sticky = $("#stickyCta");
  if ("IntersectionObserver" in window) {
    let heroGone = false, orderSeen = false;
    const upd = () => sticky.classList.toggle("show", heroGone && !orderSeen);
    new IntersectionObserver(([en]) => { heroGone = !en.isIntersecting; upd(); }).observe($(".hero__buy"));
    new IntersectionObserver(([en]) => { orderSeen = en.isIntersecting; upd(); }, { threshold: 0.15 }).observe($("#order"));
  } else {
    sticky.classList.add("show");
  }
})();
