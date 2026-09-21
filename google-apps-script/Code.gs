/**
 * Market Survey PWA -> Google Sheets endpoint.
 * 1. Tạo Google Sheet mới, vào Extensions > Apps Script.
 * 2. Dán file này và Deploy > New deployment > Web app.
 * 3. Execute as: Me; Who has access: Anyone.
 * 4. Sao chép URL /exec vào màn hình Cài đặt của ứng dụng.
 */

const SHEET_NAME = 'Survey Responses';
const HEADERS = [
  'ID', 'Thời gian tạo', 'Họ tên', 'Số điện thoại', 'Nhóm tuổi',
  'Nghề nghiệp', 'Sản phẩm', 'Mức quan tâm', 'Ghi chú',
  'Vĩ độ', 'Kinh độ', 'Độ chính xác (m)', 'Có ảnh', 'Nền tảng', 'Thời gian nhận'
];

function doGet() {
  return jsonResponse({ ok: true, service: 'Market Survey API' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const data = JSON.parse(e.postData.contents || '{}');
    if (!data.id || !data.respondentName) throw new Error('Thiếu ID hoặc họ tên người trả lời');

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#dbeafe');
      sheet.setFrozenRows(1);
    }

    const idValues = sheet.getLastRow() > 1
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat()
      : [];
    if (!idValues.includes(data.id)) {
      sheet.appendRow([
        safeCell(data.id), safeCell(data.createdAt), safeCell(data.respondentName),
        safeCell(data.phone), safeCell(data.ageGroup), safeCell(data.occupation),
        safeCell(data.product), safeCell(data.interestLevel), safeCell(data.notes),
        data.location?.latitude ?? '', data.location?.longitude ?? '', data.location?.accuracy ?? '',
        data.photo ? 'Có' : 'Không', safeCell(data.devicePlatform), new Date()
      ]);
    }
    return jsonResponse({ ok: true, duplicate: idValues.includes(data.id) });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  } finally {
    lock.releaseLock();
  }
}

function safeCell(value) {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
