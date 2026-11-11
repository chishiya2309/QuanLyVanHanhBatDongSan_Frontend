# UC19 — Danh mục dịch vụ

Triển khai frontend ngày 08/11/2026. Truy vết FC-04-01–FC-04-03, FC-04-09; US-02. Chỉ Host được truy cập. Không thay đổi backend, database hoặc UC20.

## Giao diện và điều hướng

Trang `/services` dùng danh sách và native dialog, trong shell RentOps hiện có. Tìm kiếm tên/đơn vị không phân biệt dấu tiếng Việt; bộ lọc và tìm kiếm chạy tại client, giữ thứ tự backend. Không phân trang hoặc gửi query ngoài hợp đồng vào API.

| URL/query | Hành vi |
| --- | --- |
| `/services?q=...&state=all` | Danh sách; `state` còn nhận `active`, `inactive`, `unconfigured` |
| `action=create` | Modal thêm |
| `action=edit&serviceId=UUID` | Tải chi tiết mới và mở chỉnh sửa/thiết lập giá đầu |
| `action=activate&serviceId=UUID` | Xác nhận bật lại |
| `action=deactivate&serviceId=UUID` | Xác nhận tắt |

Mặc định bỏ `state=all` khỏi URL canonical. Tham số thao tác sai/lặp/thiếu hoặc bộ lọc sai được bỏ, có thông báo lựa chọn lại và không ghi dữ liệu. Refresh và Back/Forward khôi phục màn hình từ URL. Đóng modal trực tiếp thay URL về danh sách và giữ bộ lọc. Back khi modal đang mở có thể đóng modal, Forward mở lại và GET chi tiết mới.

Biểu mẫu đã thay đổi dùng xác nhận native của trình duyệt trước khi bỏ bản nháp. Guard áp dụng cả điều hướng shell và popstate; pending khóa điều hướng nội bộ và thao tác đóng dialog. beforeunload cảnh báo khi có bản nháp/pending, không cam kết ngăn trình duyệt đóng hay rollback server. Kết thúc/đổi phiên bỏ dữ liệu cũ ngay.

Mobile có liên kết nhanh Tổng quan/Tài sản/Danh mục dịch vụ và nút mở menu đầy đủ. Chỉ một đích hiện tại có aria-current. Bảng chuyển thành bản ghi có nhãn bằng CSS; không nhân đôi dữ liệu hoặc thao tác.

## API, độ chính xác và đồng bộ

Base URL lấy từ VITE_API_URL hoặc `/api/v1`. Response thành công `{status,message,data}`; danh sách là mảng.

| Method | Endpoint | Body | HTTP |
| --- | --- | --- | --- |
| GET | `/services` | Không có | 200 |
| GET | `/services/{id}` | Không có | 200 |
| POST | `/services` | name, unit, method, defaultPrice | 201 |
| PUT | `/services/{id}` | name, unit, defaultPrice, version | 200 |
| PATCH | `/services/{id}/status` | active, version | 200 |

Types nằm trong `src/types/serviceCatalog.ts`; codec/API, hooks, UI và navigation tách riêng. Tiền/version được giữ bằng chuỗi chữ số trong frontend và lossless-json khi đọc/ghi JSON number. Không đi qua Number; tiền hiển thị bằng BigInt/Intl. Giá tối đa 9999999999999999999, version tối đa 9223372036854775807. Version lấy từ snapshot đã xác nhận, không tự tăng hoặc tự thay bằng version GET mới. Không giả định no-op PUT tăng version.

Mỗi request giữ cookie và no-store. Request ghi dùng CSRF, guard phiên/route, cùng authenticatedFetch hiện có. Khóa ref có hiệu lực từ bước lấy CSRF. Không có vòng retry mutation riêng; cơ chế phục hồi phiên hiện có vẫn được giữ.

GET cũ bị hủy/bỏ kết quả sau unmount/đổi mục tiêu. Sau ghi thành công, giữ thông báo thành công và tải lại danh sách. Tải lại thất bại hiển thị dữ liệu cũ có nhãn, khóa mutation và cho retry GET. Mất response ghi hoặc response 2xx không giải mã được kết thúc ý định hiện tại, thông báo chưa xác định kết quả và GET lại; không tự gửi lại.

409 stale giữ bản nháp, GET lại chi tiết và hiển thị đối chiếu. Nếu GET này lỗi, có thể tải lại dữ liệu mới mà vẫn giữ bản nháp. Chỉ sau lựa chọn “Chỉnh sửa theo dữ liệu mới” mới dùng snapshot/version mới; bản nháp trước đó vẫn xem được. 409 trạng thái kết thúc ý định cũ, không đổi chiều bật/tắt. Lỗi mốc/lịch sử giá khóa gửi lại trong ý định hiện tại.

### Bổ sung so với đặc tả UC19 gốc

Theo backend hiện có, Điện/Nước cấp sẵn có UNCONFIGURED, inactive, giá/revision/thời điểm đều null. UI không tự đặt giá 0 hoặc provision khi GET. PUT thiết lập giá lần đầu qua UC19 tạo revision và bật dịch vụ; giá 0 chỉ được gửi khi Host nhập rõ ràng. Dịch vụ đã CONFIGURED nhưng inactive vẫn là “Đã tắt”; sửa thông tin/giá không tự bật lại. Phương pháp tính chỉ được chọn khi thêm, chỉ đọc khi sửa. CUSTOM vẫn bắt buộc giá. Nhận diện dịch vụ có sẵn bằng systemCode, không theo tên.

Không có endpoint lịch sử công khai UC19; UI không dựng lịch sử từ metadata. Không cascade sang cấu hình phòng/tòa nhà, không tính lại hóa đơn, không sửa phương pháp tính, không đặt lịch/quá khứ, không xóa hoặc thao tác hàng loạt.

## Đối chiếu use case và kiểm thử

| Luồng | UI/đảm bảo | Kiểm thử |
| --- | --- | --- |
| Chính — thêm | Đủ tên, đơn vị, method và giá; một POST | Unit/UI bốn method, zero; browser creation |
| a — xem | Bao gồm bật/tắt/chưa giá; GET không provision | List states, lọc tiếng Việt, codec/null |
| b — cập nhật | Một PUT, method chỉ đọc, so sánh giá | Lossless wire, inactive price update, no-op version |
| c — tắt | Xác nhận tác động, active=false | Browser deactivate, body/CSRF |
| d — bật lại | Xác nhận không áp dụng hàng loạt | Browser reactivate, explicit target |
| e — phiên | Chờ vai trò; kết thúc/phục hồi phiên hiện có | Initial 401, auth recovery/session regression |
| f — quyền | Không gọi API cho ADMIN/CUSTOMER; bỏ cache khi mất quyền | Authorization, permission revoked, account change |
| g — thiếu dữ liệu thêm | Lỗi từng trường, giá trống khác 0 | Validation, focus, bốn method |
| h — cập nhật sai | Giữ bản nháp; không cập nhật cục bộ một phần | 400 field errors, draft preservation |
| i — không truy cập được | Thông báo chung 404, kết thúc modal | Wrong ID/404 API and UI |
| j — xung đột | Giữ bản nháp, đối chiếu và xác nhận lại | Stale version, failed conflict GET retry |
| k — trạng thái đổi | Kết thúc ý định cũ, không đảo chiều | Latest-detail conflict, status 409 browser |
| l — lịch sử/mốc giá lỗi | Khóa gửi trong ý định hiện tại; không tạo bản ghi giả | Price-conflict API/UI/browser |
| m — lỗi đọc | Error/retry riêng với empty | Loading/error/empty/malformed tests |
| n — lỗi thêm | Không chèn dịch vụ giả, không tự gửi lại | API uncertain and browser save failures |
| o — lỗi cập nhật | Giữ bản nháp hoặc báo chưa xác định tùy kết quả | Save failure, lost response, refresh failure |
| p — lỗi trạng thái | Không optimistic, không đảo chiều | Status conflict and error mapping |

Các bài test nằm trong `tests/serviceCatalogApi.test.ts`, `tests/serviceCatalog.test.tsx` và `tests/browser/service-catalog-browser.mjs`. Fixture và preview chỉ nằm trong tests. Browser chạy App thật với request interception giả lập, không chứng minh transaction hoặc ràng buộc PostgreSQL.

### Các nhóm file thay đổi

- Types/validation/navigation: `src/types/serviceCatalog.ts`, `src/utils/serviceCatalogValidation.ts`, `src/utils/serviceCatalogNavigation.ts`.
- Codec/API: `src/services/serviceCatalogCodec.ts`, `src/services/serviceCatalogApi.ts`.
- Hooks: `src/hooks/useServiceCatalog.ts`, `src/hooks/useCatalogResource.ts`, `src/hooks/useCatalogDialog.ts`.
- UI: `src/components/services/ServiceCatalogPage.tsx`, `CatalogDialog.tsx`, `serviceCatalog.css`.
- Shell: `src/App.tsx`, `src/components/dashboard/DashboardShell.tsx`, `Sidebar.tsx`, `dashboard.css`.
- Kiểm thử/preview: hai test UC19 trên, browser script UC19, các fixture/preview UC19 trong tests; thêm script trong `package.json`.
- Bàn giao: tài liệu này. Cache/checks/ảnh Hallmark thuộc thư mục `.hallmark` được Git ignore.

## Kiểm chứng và giới hạn

Chạy tại thư mục frontend:

```text
npm run build
npm run lint
npm test
npm run test:browser:service-catalog
npm run test:browser:assets
npm run test:browser:asset-placements
npm run test:browser
```

Kết quả ngày 08/11/2026:

| Kiểm tra | Kết quả |
| --- | --- |
| Build | Đạt; cảnh báo kích thước chunk được ghi bên dưới |
| ESLint | Đạt |
| Vitest | 21 file, 417 test đạt; riêng UC19 có 55 test |
| Browser UC19 | 11 nhóm đạt; thêm kiểm tra focus tìm kiếm, mật độ tablet và giá lớn không xuống dòng |
| Browser UC17 | 12 nhóm đạt |
| Browser UC18 | 10 nhóm đạt |
| Browser hồ sơ | 5 nhóm đạt |
| Hallmark static + render danh sách/thiết lập giá | 0 FAIL, 0 WARN; 1 F4 ANSWERED |

Browser lưu ảnh và báo cáo tại `.hallmark/shots/service-catalog`. Preview phục vụ kiểm tra thiết kế: `/tests/fixtures/service-catalog-preview.html`, thêm `?screen=setup`, `?screen=create`, `?screen=edit`, `?screen=activate` hoặc `?screen=deactivate`. `viewState=loading|empty|error` dùng cho trạng thái danh sách.

Hallmark kiểm tra scoped app trên UI UC19 và render preview Host, không dùng trang Đăng nhập để đánh giá UC19. F4 được giải trình: nút nền trung tính là secondary, chỉ modifier coral là primary. Review độc lập chỉ ra mật độ bản ghi tablet và việc tìm kiếm làm mất focus/thiếu thông báo kết quả. Đã sửa bằng bảng ở 1024px, metadata hai cột ở màn nhỏ, giữ nguyên input khi submit và live region thông báo số kết quả; kiểm chứng lại qua browser/unit và ảnh chụp.

Kiểm tra responsive gồm 390/768/1024/1440, tên dài, số lớn, modal, focus, menu mobile, layout viewport 720px tương đương 200% của 1440px, và reduced motion theo quy tắc .01ms của RentOps.

Chưa chạy smoke test với backend/database kiểm thử riêng vì chưa có môi trường kiểm thử đó trong phiên làm việc. Không khẳng định đã kiểm chứng transaction, lịch sử giá, rollback hoặc tính phí hợp đồng ở backend. Build có cảnh báo chunk JavaScript lớn hơn 500 kB; build vẫn hoàn tất, chưa thay chiến lược chia bundle ngoài phạm vi UC19.
