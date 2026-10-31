# UC07 / FC-01-08 — Quản lý tài khoản Host

## Sử dụng

Admin chọn **Tài khoản Host** trong nhóm Tài khoản hoặc điều hướng thu gọn trên mobile. Danh sách và chi tiết dùng hai URL `/admin/host-accounts` và `/admin/host-accounts/:accountId`. Truy cập trực tiếp, tải lại và Back/Forward giữ đúng trang; chờ xác định phiên/vai trò trước khi tải dữ liệu quản trị. Host/Customer thấy thông báo không có quyền và không gọi API quản trị.

Bảng desktop chuyển thành bản ghi có nhãn ở màn hình hẹp. Danh sách giữ nguyên thứ tự backend, hiển thị đầy đủ UUID, trạng thái có chữ và hồ sơ còn thiếu. Chi tiết phân biệt email đăng nhập/email kinh doanh; ngày giờ dùng `vi-VN`, `Asia/Ho_Chi_Minh`; logo lỗi/thiếu dùng chữ viết tắt.

Mỗi thao tác khóa/mở khóa lấy lại chi tiết trước khi mở dialog. Thay đổi trạng thái ở bước kiểm tra hoặc lúc PATCH được phản hồi đúng nghiệp vụ; không tự thao tác ngược. Hủy không gửi PATCH. Dialog ưu tiên focus Hủy, hỗ trợ bàn phím/backdrop và chặn đóng/gửi trùng khi đang xử lý.

Sau PATCH hợp lệ, hiển thị thành công và tải lại danh sách cùng chi tiết đang mở. Lỗi tải lại giữ nguyên thông báo thành công, đánh dấu dữ liệu chưa đồng bộ và chặn mutation đến khi tải lại thành công. Mất response không được diễn giải thành giao dịch đã rollback; không tự retry PATCH.

## Mã nguồn

- `src/types/hostAccounts.ts`: DTO, trạng thái, route và thông báo UC07.
- `src/services/hostAccountsApi.ts`: kiểm tra UUID, envelope/dữ liệu `unknown`, HTTP và thông báo được phép; GET không cache, PATCH không body và lấy CSRF mới.
- `src/hooks/useHostAccounts.ts`: tài nguyên danh sách/chi tiết, preflight, xác nhận/mutation, chống gửi trùng, hủy GET và loại bỏ kết quả đến muộn.
- `src/components/admin/HostAccountsPage.tsx`, `hostAccounts.css`: danh sách, chi tiết, dialog, quyền truy cập và responsive.
- `src/utils/hostAccountNavigation.ts`, `src/App.tsx`: History API, phiên và vai trò; 401 về Đăng nhập bằng notice lỗi, không gọi logout bổ sung.
- `src/components/dashboard/{DashboardShell,Sidebar,Topbar}.tsx`: vùng nội dung UC07, menu Admin/mobile; ẩn bộ chọn cơ sở và dữ liệu dashboard mẫu trên trang UC07.

Không thay đổi backend hoặc thêm dependency. Không có dữ liệu giả trong bundle production. Có thể kiểm tra bundle bằng `npm run build`; các fixture chỉ là entry riêng trong thư mục `tests`.

## Chạy kiểm thử

Tại frontend:

```powershell
npm run build
npm run lint
npm test
npm run dev
```

Khi Vite chạy ở cổng 5173, tại terminal khác:

```powershell
npm run test:browser:hosts
npm run test:browser:password
npm run test:browser:recovery
npm run test:browser
```

`HOST_ACCOUNTS_PREVIEW_URL` đổi địa chỉ Vite; `CHROME_PATH` chọn Chrome/Edge. Script UC07 intercept API bằng dữ liệu tổng hợp, chạy App thật và route thật. Có thể chạy một nhóm bằng `node tests/browser/host-accounts-browser.mjs 'mutation success'`. Ảnh và kết quả nằm ở `.hallmark/shots/host-accounts/`.

Preview riêng: `/tests/fixtures/host-accounts-preview.html`. Tham số `screen=detail` mở chi tiết; `state=empty|loading|error|forbidden` kiểm tra trạng thái. Mọi tên, email và UUID ở preview là fixture.

Hallmark:

```powershell
node C:\Users\lequa\.agents\skills\hallmark\scripts\sloplint.mjs src/components/admin --scope app --genre modern-minimal --render --url http://127.0.0.1:5173/tests/fixtures/host-accounts-preview.html
node C:\Users\lequa\.agents\skills\hallmark\scripts\sloplint.mjs src/components/admin --scope app --genre modern-minimal --render --url 'http://127.0.0.1:5173/tests/fixtures/host-accounts-preview.html?screen=detail'
```

Tại backend, chạy bộ kiểm thử hiện có với JDK hỗ trợ Java 25:

```powershell
$env:JAVA_HOME='D:\.jdks\openjdk-26'
.\mvnw.cmd '-Dtest=HostAccountManagementApiTest,HostAccountFailureMappingTest' test
```

## Kết quả thực tế và giới hạn

- Build và lint đạt; bộ frontend có 136 kiểm thử, gồm 41 kiểm thử UC07 và hồi quy các chức năng hiện có.
- 11 nhóm browser UC07 đạt: 375/834/1280px, route trực tiếp/refresh/Back/Forward, menu mobile, phân quyền, dialog, CSRF, chống gửi trùng, lỗi tải lại, reduced motion và reflow/chữ lớn tương đương 200%.
- 22 nhóm browser hồi quy đạt: UC05 (7), UC06/email (10), hồ sơ (5).
- 17 kiểm thử backend đạt trên H2 cô lập: contract, quyền, lỗi, thu hồi mọi phiên Host, mở khóa yêu cầu đăng nhập mới, giữ nguyên Customer liên kết và phiên Admin. Không sửa mã backend.
- Hallmark render cả danh sách/chi tiết: 0 FAIL, 0 WARN, F4 đã giải trình. Rà soát độc lập kết luận `ship`, không có phát hiện. Sửa nút bị xuống dòng bằng breakpoint dạng bản ghi và vùng thao tác đủ rộng.

Browser dùng API fixture; kiểm thử backend dùng MockMvc/H2 và dịch vụ ảnh giả lập. Chưa chạy E2E trên deployment/PostgreSQL thật hoặc hai trình duyệt với tài khoản Host thật. Chưa xác minh bằng screen reader hoặc Safari/Firefox. Kết quả reflow Chromium không thay thế kiểm tra zoom gốc trên mọi trình duyệt.

Khi deploy, cấu hình SPA fallback cho hai route quản trị. Thử trên môi trường kiểm thử riêng: đăng nhập Host ở hai phiên, khóa từ Admin, xác nhận hai phiên bị từ chối ở request kế tiếp; mở khóa và đăng nhập lại, phiên cũ vẫn vô hiệu; Customer liên kết và phiên Admin giữ nguyên.
