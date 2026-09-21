# Market Survey PWA

Ứng dụng khảo sát thị trường mobile-first, chạy offline và có thể đóng gói thành Android APK bằng Capacitor.

## Tính năng

- App shell hoạt động offline bằng Service Worker + Cache Storage.
- Phiếu khảo sát được lưu trước vào IndexedDB, không mất dữ liệu khi mất mạng.
- Tự đồng bộ các phiếu đang chờ lên Google Sheets khi có mạng.
- Background Sync trên trình duyệt hỗ trợ; tự đồng bộ khi mở app trên nền tảng còn lại.
- Chụp/chọn ảnh, lấy GPS và theo dõi trạng thái mạng qua Capacitor trên Android.
- Web fallback cho camera, GPS và Network API khi chạy PWA.
- Local Notification sau khi đồng bộ thành công.

## Chạy trên máy

```bash
npm install
npm run dev
```

Build production:

```bash
npm run build
npm run preview
```
## Kết nối Google Sheets

1. Tạo một Google Sheet mới.
2. Chọn **Extensions > Apps Script**.
3. Dán nội dung [google-apps-script/Code.gs](google-apps-script/Code.gs).
4. Chọn **Deploy > New deployment > Web app**.
5. Chọn **Execute as: Me**, **Who has access: Anyone**, rồi Deploy.
6. Sao chép URL kết thúc bằng `/exec`, mở **Cài đặt** trong app và lưu URL.

Endpoint kiểm tra ID nên việc gửi lại cùng một phiếu không tạo dòng trùng lặp. Vì Google Sheets có giới hạn dung lượng ô, bản mẫu chỉ ghi trạng thái có/không có ảnh; ảnh đầy đủ vẫn được lưu cục bộ trong phiếu. Có thể mở rộng Apps Script để đưa ảnh lên Google Drive.

## Tạo ứng dụng Android và APK

Lần đầu:

```bash
npm install
npm run build
npx cap add android
npx cap sync android
```

Build APK debug:

```bash
npm run android:apk
```

APK được tạo tại `android/app/build/outputs/apk/debug/app-debug.apk`.

Mỗi khi sửa web app, chạy `npm run android:sync` trước khi build lại. Có thể dùng `npx cap open android` để mở bằng Android Studio và tạo APK/AAB release đã ký.

## Deploy HTTPS

### Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- Node version: 22

### Vercel

Import repository, chọn Vite; build command `npm run build`, output `dist`.

## Kiểm thử đề xuất

1. Mở app online, cài PWA và tải lại.
2. Bật chế độ máy bay, nhập một phiếu, lấy GPS/chọn ảnh và lưu.
3. Đóng/mở app: phiếu vẫn còn và mang trạng thái **Đang chờ**.
4. Bật mạng: app tự đồng bộ, chuyển sang **Đã đồng bộ** và phát thông báo.
5. Kiểm tra dòng tương ứng trong Google Sheet.
6. Cài APK trên điện thoại Android và lặp lại luồng trên.

## Cấu trúc chính

```text
index.html                   Giao diện chính
src/app.js                   Logic UI và Capacitor
src/db.js                    IndexedDB
src/sync.js                  Đồng bộ foreground/background
public/service-worker.js     Cache app shell và Background Sync
public/manifest.webmanifest  PWA manifest
google-apps-script/Code.gs   Backend Google Sheets
capacitor.config.ts          Cấu hình Capacitor
docs/TECHNICAL_REPORT.md     Nội dung báo cáo kỹ thuật
```
