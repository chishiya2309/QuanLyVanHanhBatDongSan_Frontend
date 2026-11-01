# UC17 — Kết quả xác minh ngày 01/11/2026

## Kết quả đã chạy

| Lệnh/kiểm tra | Kết quả thực tế |
| --- | --- |
| `npm run build` | Đạt; TypeScript và Vite production build |
| `npm run lint` | Đạt; không lỗi hoặc cảnh báo ESLint |
| `npm test` | 11 file, 208 ca đạt; UC17 có 72 ca, phần còn lại là hồi quy hiện có |
| `npm run test:browser:assets` | 12 nhóm kịch bản đạt, không có page error |
| `npm run test:browser` | Hồ sơ: 5 nhóm đạt |
| `npm run test:browser:password` | UC05: 7 nhóm đạt |
| `npm run test:browser:recovery` | UC06: 10 nhóm đạt |
| `npm run test:browser:hosts` | UC07: 11 nhóm đạt |
| Backend `mvnw.cmd -Dtest=AssetManagementApiTest test` với Java 25 | 25 ca đạt, 0 lỗi, 0 bỏ qua; profile isolated-test, H2/MockMvc |
| Hallmark `--scope app --genre modern-minimal --render` | Năm màn preview thực tế render, 25 ảnh; 0 FAIL, 1 WARN F4 đã review và trả lời |
| Hallmark fresh-context finish review | `ship` sau khi xác minh 3/3 finding đã giải quyết |
| `git diff --check` | Đạt; Git có thông báo chuyển LF sang CRLF theo cấu hình Windows |

Các lần thử trong quá trình phát triển có lỗi test harness (matcher không được cài, fixture tạo trùng UUID), focus và đồng bộ dữ liệu cũ; đã sửa trước các lần chạy đạt ở trên. Browser còn phát hiện ô tìm kiếm bị remount khi debounce cập nhật URL: đã sửa để giữ focus, nội dung raw và caret; có ca hồi quy riêng. Form UC17 đợi kết thúc pending trước khi focus trường lỗi.

Các kiểm thử có sẵn thỉnh thoảng gặp timeout hồ sơ và assert focus UC05 khi chạy cùng nhiều bộ kiểm tra; source UC05 không thay đổi. Suite hồ sơ độc lập và toàn bộ suite cuối cùng đều đạt, browser UC05 cũng đạt. Đây là độ ổn định cần tiếp tục theo dõi của hạ tầng kiểm thử hiện có; không bỏ qua hoặc xóa kiểm thử để đạt kết quả.

## Phạm vi kiểm tra

72 ca UC17 kiểm tra API/codec/validation/URL cùng integration/hook/UI. Tiền 0, `9007199254740993`, `9999999999999999999` đi qua numeric token lossless, form string và định dạng BigInt. Các ca còn kiểm tra GET lỗi/sai cấu trúc, query literal, debounce/Enter và giữ focus, page clamp, hủy request cũ, khóa mutation từ CSRF, stale refresh, kết quả chưa xác định, giữ bản nháp, lỗi trường và điều hướng xác thực/quyền.

Puppeteer chạy source App/shell/components thật trong Vite, intercept API bằng fixture tổng hợp riêng trong test. Browser kiểm tra URL trực tiếp/refresh/Back/Forward, modal, focus, Escape/backdrop, Back bị khóa khi pending, cancel không ghi, CSRF/400/401/403/404/500, các mutation và race tìm kiếm. Responsive ở 375/834/1280/1920 CSS px, nội dung dài, giá trị không bị cắt/ngắt dòng, target Đăng xuất tối thiểu 44px, reduced motion và viewport hiệu dụng 640 CSS px/DPR 2 để kiểm tra reflow tương đương zoom 200% trên màn 1280px.

Backend suite hiện có được chạy nguyên trạng, không sửa backend. Ca `updatesPreserveConditionHistoryAndInspectionsPreserveGeneralInformation` thực hiện thêm → PUT → nhiều lần POST condition (có cùng tình trạng) → GET lại, đồng thời kiểm tra ghi chú chung và kiểm tra độc lập. Đây là smoke/contract test với H2/MockMvc; không phải E2E trình duyệt qua HTTP server thật hoặc bằng chứng khóa PostgreSQL.

## Hallmark

Lệnh sweep đã thực thi từ thư mục frontend:

```powershell
node C:/Users/lequa/.agents/skills/hallmark/scripts/sloplint.mjs src/components/assets --scope app --genre modern-minimal --render --url http://127.0.0.1:5173/tests/fixtures/assets-preview.html --url 'http://127.0.0.1:5173/tests/fixtures/assets-preview.html?screen=detail' --url 'http://127.0.0.1:5173/tests/fixtures/assets-preview.html?screen=edit' --url 'http://127.0.0.1:5173/tests/fixtures/assets-preview.html?screen=condition' --url 'http://127.0.0.1:5173/tests/fixtures/assets-preview.html?screen=create'
```

Ảnh là UC17 thật với API fixture riêng của preview, không phải trang Đăng nhập. Render tier chụp các fold 1280×800, 1440×900, 1920×1080, cùng full page 1440 và 375 cho mỗi màn.

Review độc lập yêu cầu sửa ba điểm và đã chấm lại:

1. Tiền bị ngắt giữa cụm chữ số: dành cột desktop 15rem, giữ nowrap và cho giá trị một dòng đầy đủ trên bản ghi mobile — resolved.
2. Nhãn vai trò tràn trên mobile: giới hạn trong profile badge, ellipsis — resolved.
3. Target Đăng xuất 32px: override riêng UC17 thành tối thiểu 44px — resolved.

F4 là heuristic đếm cả nút nền neutral như filled primary. Review ảnh xác nhận chỉ có một recipe coral primary; các nút viền/nền neutral là secondary. Đây là WARN đã được đọc và trả lời, không ghi thành “0 WARN”.

Dấu vết cục bộ: `.hallmark/preflight.json`, `.hallmark/log.json`, `.hallmark/shots/assets/report.json`, các ảnh `.hallmark/shots/*assets-preview*` và `.hallmark/shots/assets/`. Thư mục `.hallmark` đang được gitignore của dự án bỏ qua; tài liệu này lưu kết quả trong source control.

## Giới hạn xác minh

Chưa có backend PostgreSQL kiểm thử riêng đang chạy qua HTTP để thực hiện E2E trình duyệt cùng backend thật. Không dùng fixture frontend hoặc kết quả H2 để khẳng định transaction/khóa PostgreSQL. Chưa kiểm tra Safari, Firefox hoặc screen reader native. Reflow 200% dùng viewport tương đương, không phải chỉnh zoom browser bằng tay.

Phạm vi sản phẩm vẫn chưa có Room/AssetPlacement và API xem lịch sử; không thêm gán phòng, di chuyển, xóa, ảnh, thao tác hàng loạt hoặc giao dịch tài chính.
