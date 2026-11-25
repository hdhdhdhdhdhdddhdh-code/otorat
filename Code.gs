/**
 * تسجيل طلبات Kenzo Shop في Google Sheets
 *
 * كل طلب يُكتب في صف جديد، ورمز الطلب = رقم الصف (مع أصفار في البداية).
 * مثال: الصف 7 يعطي الرمز 00007، والصف الأول يعطي 00001.
 * لذلك اترك الجدول بلا صف عناوين حتى يبدأ الرمز من 1.
 *
 * ترتيب الأعمدة:
 * A رمز الطلب | B التاريخ والوقت | C الاسم | D الهاتف | E المحافظة
 * F العنوان | G المنتج | H الكمية | I الإجمالي بالدولار | J الحالة
 */

// ---------- الإعدادات: عدّلها عند الحاجة ----------
var SHEET_NAME   = 'الطلبات';     // اسم الورقة (تُنشأ تلقائياً إن لم تكن موجودة)
var PRICE_USD    = 14;            // سعر القطعة (يُحسب الإجمالي هنا لا من المتصفح)
var SHIPPING_USD = 0;             // رسوم التوصيل
var CODE_DIGITS  = 5;             // عدد خانات الرمز
var MAX_QTY      = 10;
var TIME_ZONE    = 'Asia/Damascus';
// --------------------------------------------------

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);                       // يمنع تداخل طلبين في نفس الصف
    var d = JSON.parse(e.postData.contents);

    var name = clean_(d.name, 120);
    var phone = clean_(d.phone, 30);
    var gov = clean_(d.governorate, 40);
    var address = clean_(d.address, 400);
    var product = clean_(d.product, 120);
    var qty = Math.floor(Number(d.qty));

    if (name.length < 3 || address.length < 6 || !gov || !/^\+\d[\d ]{5,18}$/.test(phone) ||
        !(qty >= 1 && qty <= MAX_QTY)) {
      return json_({ ok: false, error: 'invalid' });
    }

    var sheet = getSheet_();
    var row = sheet.getLastRow() + 1;
    var code = pad_(row, CODE_DIGITS);
    var total = PRICE_USD * qty + SHIPPING_USD;
    var now = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd HH:mm');

    // نصوص صريحة (@) حتى لا يحوّل Sheets الرقم +963 أو النص الذي يبدأ بـ = إلى صيغة
    sheet.getRange(row, 1, 1, 7).setNumberFormat('@');
    sheet.getRange(row, 10).setNumberFormat('@');
    sheet.getRange(row, 1, 1, 10).setValues([[code, now, name, phone, gov, address, product, qty, total, 'جديد']]);
    SpreadsheetApp.flush();

    return json_({ ok: true, row: row, code: code, totalUSD: total });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// فتح الرابط في المتصفح يعطي رسالة اختبار فقط
function doGet() {
  return json_({ ok: true, service: 'Kenzo Shop orders' });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  return sh;
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

function pad_(n, len) {
  var s = String(n);
  while (s.length < len) s = '0' + s;
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
