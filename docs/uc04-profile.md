# UC04 — Hồ sơ cá nhân

Chức năng mở từ thẻ tài khoản trên Topbar. ADMIN sửa họ tên và số điện thoại; HOST sửa tên đơn vị, số điện thoại, địa chỉ văn phòng và logo; CUSTOMER chỉ xem. Email luôn bất biến.

## Luồng dữ liệu

`App` giữ phiên xác thực. `AuthenticatedDashboard` đặt một `useProfile` dùng chung cho Topbar và `ProfileModal`; component được tạo lại theo tài khoản để dữ liệu phiên cũ không lọt sang phiên mới. Hồ sơ được lấy sau đăng nhập và lấy mới khi mở dialog. Kết quả PATCH cập nhật ngay tên, thông tin liên hệ và logo đang hiển thị.

`profileApi` sử dụng `/api/v1/profile`, cookie HttpOnly, CSRF qua helper xác thực hiện có và no-store. Payload được tạo lại bằng danh sách trường hợp lệ. Logo dùng multipart với part `profile` kiểu JSON và part `logo`; các thay đổi khác dùng JSON. Không gửi email, vai trò hoặc định danh.

Tên/địa chỉ được trim khi gửi. Điện thoại không tự chuẩn hóa; trường tùy chọn bị xóa được gửi `null`. Tên tối đa 255 ký tự, điện thoại E.164, logo JPEG/PNG lớn hơn 0 và không vượt 5 MiB. Backend vẫn kiểm tra nội dung ảnh thực tế.

## Trạng thái và thao tác

- X, Escape và bấm nền yêu cầu xác nhận nếu có thay đổi chưa lưu. Escape trong bước xác nhận quay lại chỉnh sửa.
- Hủy bỏ khôi phục bản gốc; lỗi lưu giữ nguyên draft và preview để thử lại.
- Trong lúc lưu, khóa thao tác sửa/đóng và chống submit trùng ngay trong hook.
- Logo tải mới và xóa logo loại trừ nhau. Object URL được thu hồi khi thay ảnh, hủy, lưu, đóng hoặc kết thúc phiên.
- Dialog chặn Tab/Shift+Tab, focus trường lỗi đầu tiên, trả focus về nút mở và hỗ trợ reduced motion.
- HTTP 401 xóa trạng thái hồ sơ/phiên và chuyển về đăng nhập với thông báo hết phiên.

## Kiểm tra

```text
npm test
npm run lint
npm run build
```

Để chạy kiểm tra trình duyệt, mở Vite ở terminal riêng:

```text
node node_modules/vite/bin/vite.js --host 127.0.0.1
npm run test:browser
```

Browser suite dùng Chrome/Edge đã cài. Có thể cấu hình `CHROME_PATH` và `PROFILE_PREVIEW_URL` nếu cần.

Trang preview riêng: `http://127.0.0.1:5173/tests/fixtures/profile-preview.html?role=HOST&mode=edit`. Các tham số `role`, `mode`, `state` và `long=1` cho phép xem ba vai trò và các trạng thái. Entry này dùng dữ liệu mẫu và không được đóng gói vào bản production.

Ảnh chụp, kết quả browser suite và hồ sơ Hallmark nằm trong `.hallmark/`, thư mục đã được dự án bỏ qua trong Git. Kiểm thử HTTP dùng phản hồi giả lập theo hợp đồng backend; chưa thay thế kiểm tra kết nối với backend/S3 thật.
