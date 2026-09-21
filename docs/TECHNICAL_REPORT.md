# BÁO CÁO KỸ THUẬT — MARKET SURVEY PWA

**Sinh viên:** Phạm Công Phú  
**Mã sinh viên:** 23IT.EB072 
**Lớp:** 23ITe2
**Live Demo:** 
**GitHub:** 
**GG Sheet:**https://docs.google.com/spreadsheets/d/1oOGQWGSIe_NLtr4KmAglm8Hrb9g6r5f9OXFbjRoWXpo/edit?gid=0#gid=0
## 1. Tổng quan và mục tiêu

Market Survey là Progressive Web App theo hướng mobile-first, hỗ trợ nhân viên khảo sát nhập dữ liệu ngay cả khi không có Internet. Dữ liệu được lưu an toàn trên thiết bị và tự động gửi lên Google Sheets sau khi kết nối mạng phục hồi. Cùng một mã nguồn web được đóng gói thành ứng dụng Android bằng Capacitor.

Các chức năng chính gồm biểu mẫu khảo sát, lưu offline, chụp/chọn ảnh, định vị GPS, nhận biết trạng thái mạng, đồng bộ dữ liệu và thông báo cục bộ.

> **Ảnh 1 — Giao diện phiếu khảo sát:** chèn ảnh màn hình form trên điện thoại tại đây và chú thích các trường dữ liệu, nút GPS, camera.

## 2. Kiến trúc và công nghệ

Giao diện sử dụng HTML5, CSS3 responsive và JavaScript ES Modules. Vite đảm nhiệm môi trường phát triển và đóng gói production. Service Worker lưu app shell vào Cache Storage để ứng dụng mở được ngoại tuyến. Dữ liệu phiếu được lưu trong IndexedDB với hai trạng thái `pending` và `synced`.

Khi có kết nối mạng, Sync Manager đọc các phiếu `pending`, gửi JSON đến Google Apps Script Web App rồi đánh dấu `synced`. Apps Script kiểm tra ID chống trùng và ghi dữ liệu vào Google Sheets. Background Sync được đăng ký trên trình duyệt hỗ trợ; ứng dụng dùng sự kiện network/online làm phương án dự phòng.

Trên Android, Capacitor cung cấp cầu nối đến Camera, Network, Geolocation và Local Notifications. Trên web, ứng dụng tự chuyển sang các Web API tương ứng.

```text
Biểu mẫu → IndexedDB (pending) → Network/Background Sync
                                      ↓
                             Google Apps Script
                                      ↓
                                Google Sheets
                                      ↓
                         IndexedDB (synced) + Notification
```

> **Ảnh 2 — Hoạt động offline:** chèn ảnh trạng thái Ngoại tuyến và phiếu Đang chờ tại đây.

## 3. Cài đặt và kết quả kiểm thử

Ứng dụng được build bằng `npm run build`, triển khai thư mục `dist` trên nền tảng HTTPS. Google Apps Script được triển khai dưới quyền chủ sở hữu Sheet với quyền truy cập Web App là “Anyone”. URL `/exec` được nhập tại màn hình Cài đặt và chỉ lưu trên thiết bị.

Kịch bản kiểm thử: cài PWA khi có mạng; chuyển sang chế độ máy bay; nhập và lưu phiếu; đóng/mở lại ứng dụng để xác nhận dữ liệu còn trong IndexedDB; bật mạng; kiểm tra phiếu đổi từ “Đang chờ” sang “Đã đồng bộ”, nhận notification và đối chiếu dòng mới trong Google Sheets.

Kết quả mong đợi: app shell mở được offline; dữ liệu không mất; GPS và camera hoạt động sau khi cấp quyền; bản ghi không bị nhân đôi khi gửi lại; giao diện thích nghi trên màn hình điện thoại và desktop.

> **Ảnh 3 — Đồng bộ thành công:** chèn ảnh notification và dòng dữ liệu trong Google Sheets tại đây.

## 4. Đóng gói Android và kết luận

Capacitor sao chép bản build web vào project Android. APK debug được tạo bằng Gradle tại `android/app/build/outputs/apk/debug/app-debug.apk` và có thể cài trực tiếp để kiểm thử. Bản phát hành chính thức cần keystore riêng và nên xuất Android App Bundle đã ký.

Project đáp ứng các yêu cầu offline-first, PWA có HTTPS, IndexedDB, Cache Storage, Google Sheets sync, GPS, notification, Background Sync và đóng gói Android. Hướng mở rộng gồm tải ảnh lên Google Drive, mã hóa dữ liệu nhạy cảm và xác thực endpoint.
