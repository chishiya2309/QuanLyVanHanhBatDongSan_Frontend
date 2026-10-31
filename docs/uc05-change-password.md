# UC05 / FC-01-06 — Đổi mật khẩu

Từ nút tài khoản trên Topbar, mở **Hồ sơ cá nhân → Đổi mật khẩu**. Chức năng có cho Admin, Host và Customer ở chế độ xem hồ sơ. Khi chỉnh sửa hồ sơ, phải kết thúc chỉnh sửa trước khi chuyển sang đổi mật khẩu.

## Hành vi

- Chỉ một native dialog được mở tại một thời điểm. Hủy, Escape, backdrop hoặc nút đóng quay lại hồ sơ, phục hồi focus và xóa dữ liệu mật khẩu.
- Ba trường có nút ẩn/hiện độc lập; hỗ trợ autofill, paste và trình quản lý mật khẩu.
- Kiểm tra bắt buộc, tối thiểu 8 đơn vị UTF-16 theo backend hiện tại, tối đa 72 byte UTF-8 và xác nhận chính xác. Giữ nguyên khoảng trắng và Unicode trong payload. Không thêm quy tắc độ phức tạp hoặc cấm trùng mật khẩu hiện tại.
- Lấy CSRF mới trước mỗi lần gửi hợp lệ. Gửi đúng `currentPassword`, `newPassword`, `confirmPassword` đến `POST /api/v1/auth/change-password`, với `credentials: include`. Không retry tự động.
- Trong khi gửi, khóa thao tác và ngăn đóng dialog. Lỗi trường đưa focus tới trường đầu tiên; lỗi chung đưa focus tới banner.
- HTTP 400 map lỗi trường. HTTP 403 do CSRF cho thử lại thủ công; 403 do tài khoản không được phép kết thúc thao tác và xóa mật khẩu. Lỗi mạng/500 giữ dữ liệu trong bộ nhớ và không tự đăng xuất.
- HTTP 200 có envelope hợp lệ hoặc HTTP 401 chuyển về Đăng nhập, xóa trạng thái xác thực cục bộ và cache CSRF, hiển thị notice đúng loại. Không gọi logout/refresh bổ sung. Tên đăng nhập có thể được giữ, mật khẩu luôn rỗng.
- Khi màn hình thấp, cả dialog cuộn để header/footer không che ô nhập ở cỡ chữ lớn.

## Kiểm tra

Tại thư mục frontend:

```powershell
npm run build
npm run lint
npm test
npm run dev
```

Khi Vite đang chạy ở `http://127.0.0.1:5173`, chạy trong terminal khác:

```powershell
npm run test:browser:password
npm run test:browser
```

Biến `PASSWORD_PREVIEW_URL` đổi địa chỉ Vite cho bộ kiểm tra UC05; `CHROME_PATH` chọn Chrome/Edge. Bộ browser dùng fixture riêng, không yêu cầu tài khoản thật và không được import vào production.

Preview tích hợp: `/tests/fixtures/change-password-preview.html?role=HOST`. Tham số `role` nhận `ADMIN`, `HOST`, `CUSTOMER`; `state` hỗ trợ `success`, `field-error`, `error`, `network`, `loading`, `csrf`, `forbidden`, `expired`. `isolated=1` mở riêng modal để kiểm tra thiết kế mà không tính các lỗi cũ của dashboard phía sau.

Kết quả xác minh: 76 unit/integration tests; 7 nhóm browser UC05; 5 nhóm browser hồ sơ. Browser UC05 kiểm tra ba vai trò ở 375/834/1280px, bàn phím, lỗi, submit trùng, reduced motion, chuyển về Đăng nhập và reflow tương đương zoom 200% ở viewport 640×400 với chữ lớn. Kiểm tra chữ lớn xác nhận từng input nằm trọn trong vùng hiển thị của dialog và không bị footer che.

Hallmark sweep trên modal riêng: 0 FAIL, 0 WARN, 1 ANSWERED F4 về việc chỉ nút primary dùng màu accent. Preview tích hợp còn có các vấn đề thiết kế dashboard đã tồn tại: property switcher tràn ở 375px, tương phản viền select và nút nhỏ. Không chỉnh sửa dashboard trong UC05.

## Giới hạn kiểm tra backend

Trong phiên triển khai, backend không chạy tại cổng 8080. Java đang được cấu hình mặc định là JDK 21, trong khi backend yêu cầu Java 25. Chưa chạy kiểm tra tích hợp thật hai phiên đăng nhập. Các fixture frontend không chứng minh việc băm mật khẩu, rollback giao dịch hoặc thu hồi phiên.

Khi backend sẵn sàng, đăng nhập cùng tài khoản trên hai trình duyệt; đổi mật khẩu ở trình duyệt thứ nhất; xác nhận trình duyệt thứ hai bị từ chối ở request tiếp theo, mật khẩu mới đăng nhập được và mật khẩu cũ bị từ chối nếu khác mật khẩu mới. Đây là kiểm tra backend cần thực hiện riêng.
