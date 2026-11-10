# UC08 — Cấp và quản lý tài khoản Customer

Ngày kiểm chứng: 09/11/2026 (Asia/Saigon). Truy vết: FC-01-09–FC-01-10.

## Kết quả triển khai

Khối **Tài khoản truy cập** nằm giữa hồ sơ và phương tiện trên chi tiết Customer. Host cấp tài khoản bằng modal ba trường; khóa/mở khóa bằng modal xác nhận có tên Customer, email đăng nhập và hậu quả thao tác. Thành công cập nhật tại chỗ, thông báo ngắn và không tải lại trang.

Chỉ tài khoản HOST truy cập được. Email đăng nhập độc lập email liên hệ. Backend hiện có chịu trách nhiệm kiểm tra phạm vi Principal, tạo/liên kết Account trong transaction, băm mật khẩu và thu hồi phiên; frontend không thực hiện thay các phần này.

### File tạo mới

| File | Trách nhiệm |
|---|---|
| `src/types/customerAccount.ts` | Types, trạng thái, thao tác và thông điệp UC08 |
| `src/utils/customerAccountValidation.ts` | Email, Unicode code points, giới hạn UTF-8, xác nhận mật khẩu |
| `src/services/customerAccountCodec.ts` | Giải mã quan hệ Account, UUID/enum/timestamp, Long lossless và whitelist POST |
| `src/services/customerAccountApi.ts` | GET/POST/PATCH, CSRF, session guard, phân loại lỗi và kết quả chưa xác định |
| `src/hooks/useCustomerAccount.ts` | Tải khối tài khoản, chuẩn bị modal, bản nháp, guard, gửi và đối soát trạng thái |
| `src/components/customers/CustomerAccountSection.tsx` | Loading/empty/error/full và hành động theo trạng thái |
| `src/components/customers/CustomerAccountDialog.tsx` | Form cấp và xác nhận khóa/mở khóa; focus, Escape, hiện/ẩn mật khẩu |
| `src/components/customers/customer-accounts.css` | Giao diện UC08 dùng tokens coral, responsive và các trạng thái điều khiển |
| `tests/customerAccountApi.test.ts` | 45 trường hợp codec, API, validation và điều hướng |
| `tests/customerAccounts.test.tsx` | 22 trường hợp UI/hook tích hợp |
| `tests/browser/customer-accounts-browser.mjs` | 8 nhóm kiểm thử trình duyệt và xuất ảnh/bằng chứng Hallmark |

### File chỉnh sửa

| File | Thay đổi |
|---|---|
| `src/types/customer.ts`, `src/utils/customerNavigation.ts` | Thêm accountAction; loại trừ modal cạnh tranh/trùng tham số; giữ q/page/size |
| `src/components/customers/CustomersPage.tsx` | Nối khối tài khoản, navigation guard, thông báo 404 và trạng thái tải chi tiết |
| `src/components/customers/CustomerDetailView.tsx` | Slot tài khoản, nhãn Email liên hệ, heading ID, khóa hành động khi đồng bộ snapshot |
| `src/hooks/useCustomerDetail.ts` | Tải lại snapshot đầy đủ sau cấp; refresh có cleanup; giữ thông báo Customer không truy cập được |
| `src/hooks/useCustomers.ts` | Chuẩn hóa route sai về đúng chi tiết/danh sách và không tải danh sách từ route sai |
| `src/App.tsx` | Chuyển navigation guard và thông điệp phiên UC08 vào CustomersPage |
| `src/components/dashboard/DashboardShell.tsx` | Customer là custom view: không hiện bộ chọn cơ sở/thông báo mẫu; mobile chỉ có đúng mục active |
| `tests/customers.test.tsx` | Cập nhật fixture route cho accountAction |
| `tests/browser/customers-browser.mjs` | Fixture GET account chưa cấp để tiếp tục kiểm thử hồi quy UC21 |
| `package.json` | Thêm test:browser:customer-accounts; không thêm dependency |

Backend, hợp đồng endpoint và các thư viện hiện có được giữ nguyên. Không có mock UC08 trong production.

## Hợp đồng và điều hướng

| Method | Endpoint | Body | Thành công |
|---|---|---|---|
| GET | `/api/v1/customers/{customerId}/account` | Không | 200 |
| POST | `/api/v1/customers/{customerId}/account` | email, password, confirmPassword, customerVersion | 201 |
| PATCH | `/api/v1/customers/{customerId}/account/lock` | Không | 200 |
| PATCH | `/api/v1/customers/{customerId}/account/unlock` | Không | 200 |

Request dùng cấu hình base URL, credentials include và no-store. POST/PATCH sử dụng cơ chế CSRF và authenticatedFetch có sẵn. Không thêm vòng retry mutation. customerVersion được giữ bằng string trong TypeScript, gửi bằng JSON number qua LosslessNumber, giới hạn Long không âm đến 9223372036854775807.

Ba URL modal là `/customers/{customerId}?accountAction=provision`, `?accountAction=lock`, `?accountAction=unlock`; vẫn giữ q/page/size. URL trực tiếp, refresh và Back/Forward chỉ chuẩn bị modal, không tự gửi request ghi. Các modal cạnh tranh hoặc tham số lặp bị loại bỏ an toàn.

Mật khẩu tối thiểu 8 Unicode code points và tối đa 72 byte UTF-8; không trim hoặc chuẩn hóa mật khẩu. Bản nháp chỉ ở bộ nhớ modal, không lưu URL/storage/log. Lỗi trùng email, validation, CSRF hoặc refresh phiên tạm thời giữ thông tin đã nhập. Bỏ bản nháp, thành công và kết thúc ngữ cảnh xóa mật khẩu.

## Đối chiếu use case

### Luồng chính và thay thế

| Bước/luồng | Mã nguồn | Bằng chứng |
|---|---|---|
| 1–2: vào danh sách, kiểm tra phiên/quyền Host | App, CustomersPage, API/session hiện có | UC08 browser: Host scope và role restrictions; UC21 browser nhóm 1 |
| 3–4: chọn Customer và xem tài khoản | CustomerDetailView, CustomerAccountSection, getCustomerAccount | UI only reads selected Customer; browser không có N+1 trên danh sách |
| 5–6: chọn cấp, kiểm tra lại chưa có Account | useCustomerAccountDialog.read | UI concurrent account; chuẩn bị lại bằng GET trước form |
| 7–8: nhập ba trường cấp | CustomerAccountDialog, validateCustomerAccount | UI gợi ý email, toggle riêng từng mật khẩu, validation inline |
| 9–10: submit và kiểm tra dữ liệu | validation, submit lock, API | Unicode/UTF-8, email, confirm, CSRF, Long, chống double submit |
| 11–12: tạo Account và liên kết cùng thao tác | provisionCustomerAccount gọi một POST | Test body whitelist, backend CustomerAccountApiTest; transaction thuộc backend |
| 13–15: thông báo, cập nhật email/trạng thái và kết thúc | finish, CustomerAccountSection, refreshAfterAccount | UI/browser cấp thành công, email liên hệ nguyên vẹn, UC21 dùng snapshot mới |
| 4a–11a: khóa ACTIVE, xác nhận, thu hồi phiên | read, lockCustomerAccount, modal khóa | UI/browser lifecycle; backend lockAndUnlockLifecycleAndRevocation |
| 7a1–9a1: hủy khóa | close/canLeave | UI/browser xác nhận không gửi PATCH |
| 4b–11b: mở khóa LOCKED, xác nhận, yêu cầu đăng nhập mới | read, unlockCustomerAccount, modal mở khóa | UI/browser lifecycle; backend giữ phiên cũ bị thu hồi |
| 7b1–9b1: hủy mở khóa | close/canLeave | UI/browser không đổi trạng thái và không gửi PATCH |

### Toàn bộ ngoại lệ

| Nhánh | Xử lý | Kiểm thử |
|---|---|---|
| 2c | Phiên kết thúc: xóa ngữ cảnh, thông báo UC08 và về Đăng nhập | API mapping 401; UI expired; sessionClient hiện có |
| 2d | Mất quyền Host: xóa vùng bảo vệ, không tiếp tục thao tác | API 403; UI forbidden; browser ADMIN/CUSTOMER không gọi Customer API |
| 4e | 404 dùng thông báo không tìm thấy/không có quyền; giữ thông báo khi về danh sách | API 404; UI account not-found và profile missing |
| 6f | Không tạo tài khoản thứ hai; GET đối soát, đóng form và cập nhật thực tế | UI already-account; API mapping; backend provisionAccountDuplicateFailsWith409 |
| 10g | Lỗi inline từng trường thiếu, focus lỗi đầu tiên | Validation required fields; UI validation; browser validation |
| 10h | Báo sai định dạng email | Validation email và API 400 fieldErrors |
| 10i | Email trùng hiện tại ô email, giữ cả hai mật khẩu | API duplicate fields; UI/browser duplicate email rồi sửa và gửi lại |
| 10j | Phân biệt thiếu 8 code points và quá 72 byte | Test ASCII 72/73, emoji 7/8, é 36/37; backend UTF-8 limit |
| 10k | Xác nhận mật khẩu không trùng | Validation confirmationMismatch |
| 5l | Không có Account: không khóa/mở khóa và không tạo thay thế | API noAccount; UI concurrent no-account |
| 5m | Sai role/liên kết: chặn hành động; không gộp mọi 500 thành sai role | Codec role/UUID/link checks; API wrong-role vs generic 500; UI wrong-role |
| 5n | Đã LOCKED: không khóa trùng, cập nhật trạng thái thực tế | API mapping; UI already-locked; browser concurrent state |
| 5o | Đã ACTIVE: không mở khóa dư thừa, cập nhật thực tế | API mapping; UI already-active |
| 2p | Lỗi tải là error có retry; giữ hồ sơ/phương tiện nếu chỉ Account lỗi | UI isolated load failure; codec thiếu/sai trường không thành empty |
| 11q | Lỗi cấp không hiển thị thành công giả, giữ form để sửa/thử lại | API provision failure; UI write-failure |
| 9r | Lỗi khóa không đổi UI sang LOCKED | API lock failure; backend transaction logic không do frontend mô phỏng |
| 9s | Lỗi mở khóa không đổi UI sang ACTIVE | API unlock failure; backend transaction logic giữ trạng thái |

Ngoài các nhánh đặc tả: stale version chặn submit đến khi Host chọn tải lại; CSRF 403 xóa cache CSRF và giữ form; refresh phiên tạm thời giữ bản nháp; phản hồi ghi mất/sai cấu trúc chuyển sang **chưa xác định kết quả**, không tự gửi lại và cho GET đối soát.

### Chênh lệch transport được ánh xạ tại frontend

- Backend không có trường code nghiệp vụ. Dùng status, message và fieldErrors, không giả định enum lỗi trên wire.
- Backend 401/404 dùng thông điệp ngắn hơn; UI hiển thị thông điệp theo UC08.
- Backend `Lỗi hệ thống khi xử lý tài khoản` được nhận diện riêng cho sai role/liên kết; các 500 khác giữ thông báo thất bại theo thao tác.
- Backend yêu cầu customerVersion khi cấp; đây là trường kỹ thuật ẩn, không có input cho Host.

## Kiểm chứng và bằng chứng

| Lệnh | Kết quả |
|---|---|
| `npm run build` | Thành công; còn cảnh báo bundle JavaScript vượt 500 kB |
| `npm run lint` | Thành công, không warning |
| `npm test` | 27 files, 525 tests pass; 67 test UC08 mới |
| `npm run test:browser:customers` | 7/7 nhóm hồi quy UC21 pass |
| `npm run test:browser:customer-accounts` | 8/8 nhóm UC08 pass; browser page errors rỗng |
| Hallmark sloplint static + render | 0 FAIL, 0 REFLEX, 0 WARN; render đã chạy |
| Backend `mvn.cmd '-Dtest=CustomerAccountApiTest,CustomerAccountServiceAuthorizationTest' test` | 20 tests pass, 0 failure/error/skipped |
| Hallmark finish review độc lập | ship; không có phát hiện cần sửa trong UC08 |

Console và dữ liệu máy đọc nằm tại `.hallmark/shots/customer-accounts/`: `build.txt`, `lint.txt`, `vitest.txt`, `uc21-browser.txt`, `browser.txt`, `results.json`, `hallmark.json`. Thư mục .hallmark được repository bỏ qua trong Git; đây là bằng chứng cục bộ, không phải runtime production.

14 ảnh nghiệp vụ desktop/mobile ở cùng thư mục; các tên chính: `desktop-unprovisioned.png`, `desktop-active.png`, `desktop-locked.png`, `desktop-validation.png`, `desktop-duplicate-email.png`, `desktop-lock-confirmation.png`, `desktop-unlock-confirmation.png`, và các ảnh `mobile-*.png`. Checker tạo thêm 10 ảnh ở `.hallmark/shots/`, gồm ảnh 375px và các viewport desktop.

Hai snapshot `review-active.html` và `review-provision.html` được xuất từ DOM/CSS của ứng dụng đã render bằng fixture API. Script ứng dụng được loại bỏ, các giá trị mật khẩu bị xóa; dialog được mở lại ở top layer để checker chụp đúng backdrop. Đây là snapshot kiểm thử có nhãn rõ ràng, không phải route hoặc mock production.

### Giới hạn bằng chứng

- Browser harness dùng React và Chrome/Edge thật với API giả lập để kiểm tra frontend; không chứng minh thu hồi phiên backend từ badge.
- Bộ backend chạy Spring/MockMvc với cơ sở dữ liệu H2 cô lập. Bài kiểm thử vòng đời xác minh Customer đăng nhập, khóa làm phiên cũ bị từ chối, mở khóa không phục hồi phiên cũ và yêu cầu đăng nhập mới. Không thay thế kiểm thử triển khai PostgreSQL hoặc nhiều thiết bị thật.
- Reflow được kiểm tra ở 390/768/1024/1440px và viewport CSS 720×500 tương đương bố cục 1440×1000 tại zoom 200%; không điều khiển thanh zoom của trình duyệt desktop.
- Cảnh báo bundle hơn 500 kB vẫn còn. Không mở rộng UC08 sang tái cấu trúc bundle toàn ứng dụng.

Chạy lại Hallmark kèm browser harness:

```powershell
$env:UC08_HALLMARK_RENDER = '1'
npm run test:browser:customer-accounts
```

Có thể cấu hình `CHROME_PATH`, `CUSTOMER_ACCOUNTS_PREVIEW_URL` và `HALLMARK_CHECKER` khi môi trường khác đường dẫn mặc định. Harness chỉ đóng browser/dev server do chính nó khởi tạo.
