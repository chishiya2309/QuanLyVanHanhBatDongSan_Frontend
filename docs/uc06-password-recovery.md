# UC06 / FC-01-07 — Khôi phục mật khẩu

## Giao diện

Từ Đăng nhập chọn **Quên mật khẩu?**. Hai trang `/forgot-password` và `/reset-password` giữ bố cục xác thực hai cột của RentOps. Luồng không yêu cầu phiên đăng nhập, không tự đăng nhập sau khôi phục và không tiết lộ tài khoản có tồn tại hay không.

Liên kết email dùng `/reset-password#token=...`. Bootstrap đọc token trước khi render React, xóa fragment và chuyển token vào bộ nhớ của hook. Nguồn bootstrap và state trung gian được giải phóng sau chuyển giao. StrictMode không làm mất token. Không lưu token/mật khẩu trong storage, history state hoặc telemetry. Tải lại sau khi fragment đã bị xóa sẽ yêu cầu liên kết mới.

Chỉ hiện form đặt lại sau khi API xác minh trả envelope hợp lệ. Lỗi kết nối khi xác minh có thể thử lại; liên kết không hợp lệ hoặc yêu cầu hết hiệu lực khi lưu kết thúc form. Lỗi trường và lỗi kỹ thuật sau submit giữ dữ liệu trong bộ nhớ để sửa/thử lại. CSRF được lấy mới cho mỗi thao tác; không retry tự động.

Các API POST giữ nguyên contract backend:

- `/api/v1/auth/forgot-password`: `{ email }`.
- `/api/v1/auth/reset-password/validate`: `{ token }`.
- `/api/v1/auth/reset-password`: `{ token, newPassword, confirmPassword }`.

Sau thành công, xóa dữ liệu nhạy cảm và trạng thái xác thực cục bộ, về Đăng nhập với notice loại success, không gọi login/logout/refresh. Mọi thông báo nghiệp vụ giữ nguyên UC06.

## Email

`PasswordResetEmailRenderer` là nguồn duy nhất tạo HTML và plain text. Template có wordmark RentOps, nội dung 600px, màu coral, CTA, hiệu lực 30 phút, cảnh báo bảo mật và URL dự phòng. Bố cục bảng/inline CSS không phụ thuộc ảnh hoặc font ngoài; có fallback Outlook. Bản văn bản dùng cùng liên kết và thông tin nghiệp vụ.

`BREVO_SENDER_EMAIL` và `BREVO_SENDER_NAME` đã cấu hình được giữ nguyên. Khi tên gửi thiếu/rỗng, mặc định dùng RentOps. Không thay đổi transaction, token TTL hoặc cơ chế thu hồi phiên. Không có lệnh kiểm thử nào gửi email tới hộp thư người dùng thật.

Preview với token giả được xuất từ renderer tại backend `target/password-reset-email-preview/`. Bản bàn giao nằm tại `D:/Workspace/TLCN/output/uc06/`, gồm HTML, plain text và ảnh desktop/mobile.

## Chạy kiểm thử

Trong frontend:

```powershell
npm run build
npm run lint
npm test
npm run dev
```

Với Vite đang chạy ở cổng 5173, dùng terminal khác:

```powershell
npm run test:browser:recovery
npm run test:browser:password
npm run test:browser
```

`RECOVERY_PREVIEW_URL` đổi địa chỉ Vite; `CHROME_PATH` chọn Chrome/Edge. Preview chỉ cài mock API tại `/tests/fixtures/recovery-preview.html`, không được import vào production. Tham số `screen` là `forgot`, `reset` hoặc `login`; reset nhận token giả qua fragment. Tham số `state` hỗ trợ `success`, `checking`, `invalid`, `verify-error`, `loading`, `network`, `error`, `csrf`, `expired`, `field-error`. `isolated=1` kiểm tra riêng form, không tính nội dung giới thiệu cũ.

Trong backend, chọn JDK hỗ trợ Java 25. Phiên triển khai sử dụng runtime có sẵn `D:/.jdks/openjdk-26`:

```powershell
$env:JAVA_HOME='D:\.jdks\openjdk-26'
.\mvnw.cmd '-Dtest=BrevoPasswordResetEmailTest,PasswordResetEmailRendererTest,PasswordResetApiTest,PasswordResetTransactionTest,PasswordResetServiceTest' test
```

Renderer test tạo preview từ code production. API tests dùng profile `isolated-test`, H2 trong bộ nhớ và email service giả lập; không sử dụng database đang chạy của ứng dụng.

## Kết quả và giới hạn

- 95 kiểm thử frontend đạt, bao gồm hồi quy UC05 và hồ sơ.
- 43 kiểm thử backend đạt: 12 email/Brevo và 31 API/service/transaction. Bao phủ ba vai trò, token dùng một lần, hạn 30 phút, vô hiệu hóa liên kết khác và thu hồi nhiều phiên trong môi trường H2 riêng.
- 10 nhóm browser UC06/email và 12 nhóm browser hồi quy UC05/hồ sơ đạt. Bao phủ 375/834/1280px, StrictMode, Back/Forward, reload, focus, reduced motion, lỗi, chống submit trùng và reflow tương đương zoom 200%.
- Email được kiểm tra bằng Chromium ở desktop/mobile, bỏ style block, giả lập nền tối và URL dài. Tiêu đề mobile giữ cụm “của bạn” cùng dòng.
- Hallmark render trên form mới không có FAIL; cảnh báo nhãn nút dài được ghi nhận là chủ đích cho phép xuống dòng khi chữ lớn. Nội dung giới thiệu RentOps hiện có được giữ nguyên.

Chưa xác minh email được nhận qua Brevo thật hoặc render trực tiếp trong Gmail, Outlook và Apple Mail. Kiểm tra browser không thay thế kiểm tra các email client này. Cần hộp thư kiểm thử được cho phép để xác minh chặng cuối từ email thật đến đăng nhập bằng mật khẩu mới.

Khi deploy, cấu hình SPA fallback cho `/forgot-password` và `/reset-password`; `PASSWORD_RESET_FRONTEND_URL` phải trỏ đúng frontend origin và route reset. Không đưa token vào query string hoặc access log. Nên thử reset bằng tài khoản kiểm thử trước khi nghiệm thu môi trường triển khai.

Khởi động lại backend để nạp template mới nếu tiến trình hiện tại không bật tự động reload mã đã biên dịch.
