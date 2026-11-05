# UC18 — Kết quả xác minh frontend

Ngày thực hiện: 05/11/2026, múi giờ Asia/Ho_Chi_Minh. Phạm vi: frontend RentOps, giữ backend không thay đổi.

## Kiểm tra tự động

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run build` | Đạt: TypeScript và Vite build, 95 modules |
| `npm run lint` | Đạt: không có lỗi hoặc cảnh báo ESLint |
| `npm test` | Đạt: 344 bài, 17 file; gồm 56 bài UC18 mới và hồi quy các module hiện có |
| `npm run test:browser:assets` | Đạt: 12 nhóm UC17, không có pageerror |
| `npm run test:browser:asset-placements` | Đạt: 10 nhóm UC18, không có pageerror |
| `git diff --check` | Đạt; Git chỉ cảnh báo chuẩn hóa LF/CRLF của môi trường Windows |

Lần chạy Vitest với số fork mặc định gặp ENOMEM/heap exhaustion. Giới hạn hai worker trong vitest.config.ts rồi chạy lại toàn bộ suite thành công. Không giảm hoặc bỏ test. Fixture browser UC17 được cập nhật currentPlacement và mô phỏng phiên hết hạn trên cả auth/me/auth/refresh, phù hợp cơ chế phục hồi phiên đang có; không đổi production authentication.

## Nội dung được xác minh

- HOST-only; chưa xác định phiên không gọi API nghiệp vụ; ADMIN/CUSTOMER không lấy dữ liệu tài sản/phòng/lịch sử; 401/403 kết thúc màn bảo vệ.
- Gán, chuyển một POST; body/CSRF/status đúng; giữ sourcePlacementId Host đã xác nhận; không tự gửi condition-records hoặc retry khi xung đột/mất response.
- Chuỗi gán phòng A, ghi nhận hai lần cùng tình trạng tại A, chuyển B, đọc hai loại lịch sử. Snapshot nguồn không bị thay, bản ghi tình trạng vẫn chỉ đúng phòng, bản ghi chưa bố trí giữ null context.
- Hai lịch sử rỗng độc lập; malformed/error không trở thành empty. Phòng empty/error không chặn xem lịch sử.
- Phân biệt 404 tài sản/phòng, từng loại 409, validation, CSRF, lỗi lưu, success rồi refresh lỗi và kết quả ghi chưa xác định.
- GET cũ và POST đang chờ CSRF không cập nhật/gửi sau khi modal đã rời khỏi route. Browser test chờ URL/dialog thay đổi và response CSRF thực sự được giao, không chờ networkidle trên request cố ý giữ lại.
- Truy cập trực tiếp, query, Back/Forward, đóng modal không rời app; focus trap, Escape/backdrop/Hủy, double submit, pending và focus sau thành công.
- Tiền 19 chữ số, số 0 và biên 53-bit được giữ chính xác bởi codec UC17; currentPlacement thiếu/sai bị từ chối.
- So sánh khoảng ở codec không làm tròn microsecond; mốc UC18 hiển thị giây và phần lẻ gốc, giữ ISO trong dateTime.

## Kiểm tra giao diện

Chạy Chrome/Edge headless trên Vite, render App/shell/component thật với API tổng hợp được intercept riêng trong browser test. Các width UC18: 390, 768, 1024, 1440; kiểm tra tràn ngang ở danh sách, dialog và lịch sử, nội dung dài, reduced motion, một active item hiển thị duy nhất. Breakpoint mobile của module tài sản được đồng bộ max-width:1024px với breakpoint ẩn sidebar, tránh mất điều hướng đúng tại 1024px.

Kiểm tra thêm reflow tương đương zoom 200% bằng viewport 640 CSS px/DPR 2. Đây không phải thao tác zoom browser thủ công. UC17 browser giữ các width 375/834/1280/1920.

Ảnh/report tại `.hallmark/shots/asset-placements` và `.hallmark/shots/assets` (thư mục artifact được Git ignore). Đã đọc ảnh kiểm tra đại diện dialog 390, lịch sử 768, danh sách 1024 và lịch sử desktop 1440; kiểm tra bổ sung ảnh danh sách 1024 sau khi đồng bộ breakpoint. Screenshot lịch sử desktop có đầy đủ hai loại dữ liệu; các screenshot responsive kiểm tra riêng tình huống tài sản chưa bố trí và lịch sử vị trí rỗng.

Áp dụng nguyên tắc design-taste-frontend theo override app: giữ tokens/nhận diện, mép nội dung, phân cấp dữ liệu, control 44px và focus/reduced motion. Không chạy checker dành cho landing page và không tuyên bố Hallmark sweep đạt cho UC18.

## Giới hạn

- Không có backend/test database đang chạy ở các cổng đã kiểm tra khi bắt đầu công việc; chưa smoke test ghi với backend thật.
- API fixture chỉ xác minh giao diện/contract mô phỏng. Chưa xác minh transaction, rollback, khóa cạnh tranh hoặc exclusion constraint PostgreSQL trong phiên frontend này.
- Chưa kiểm tra screen reader native, Safari hoặc Firefox. Các test browser hồ sơ/UC05/UC06/UC07 riêng không được chạy lại; hồi quy unit/integration của các module đó có trong npm test. App/shell/sessionClient và backend không bị chỉnh sửa.
- Thay đổi skills-lock.json đã có trước khi thực hiện và được giữ nguyên.

Route, API và bảng đối chiếu luồng chính/A–P xem UC18.md.
