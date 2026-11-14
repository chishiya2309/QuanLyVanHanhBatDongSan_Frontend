# UC37 – Kết quả xác minh Frontend

Thực chạy ngày **14/11/2026** trên workspace Windows, Node.js 24, React/Vite của dự án. Phạm vi gồm frontend, client API và kiểm thử qua fixture; không tuyên bố đã kiểm thử tích hợp với các module cấp kỳ/bàn giao/hóa đơn đang vận hành thực tế.

## Kết quả cuối

| Kiểm tra | Kết quả |
|---|---|
| Toàn bộ Vitest suite | **664/664 test, 34/34 tệp đạt**, 0 lỗi; thời gian 207,67 giây |
| Riêng UC37 trong lượt chạy trên | **41/41 test đạt**: 18 API/codec/decimal/routing và 23 UI/luồng/phục hồi |
| Puppeteer với App và components thật qua fixture | **10/10 kiểm tra đạt**, không có pageerror |
| TypeScript và Vite production build | Đạt; Vite còn cảnh báo chunk chính trên 500 kB (804,62 kB, gzip 201,65 kB) |
| ESLint toàn bộ tệp thay đổi | Đạt, 0 lỗi/cảnh báo |
| ESLint toàn repository | Chưa đạt: **11 lỗi, 2 cảnh báo có sẵn** ở module hợp đồng, liệt kê bên dưới |
| Hallmark phạm vi app, static và render | **0 FAIL, 0 REFLEX, 0 WARN**, đã chạy render tier trên Vite |
| `git diff --check` | Đạt |

Báo cáo máy nằm tại `.hallmark/uc37-full-suite.json`, `.hallmark/uc37-eslint-full.json` và `.hallmark/shots/meter-readings/results.json` (các artifact này được gitignore theo quy ước repository).

## Phạm vi kiểm tra trình duyệt

1. Ledger 390 px, nhãn trường, vùng bấm và không tràn ngang trang.
2. Ledger 768 px với cùng kiểm tra bố cục.
3. Ledger 1440 px với cùng kiểm tra bố cục.
4. Mở trực tiếp bản ghi DRAFT, PATCH chỉ hai trường; Back/Forward và điều hướng sang Khách thuê rồi quay lại đúng UC37.
5. Batch một phần: giữ mục thành công, chỉ gửi lại mục lỗi đã chọn; giữ nguyên số thập phân dài.
6. Mất response sau commit: GET đối chiếu dữ liệu thực tế, không phát lại batch.
7. Lưu xong nhưng GET thất bại: giữ thông báo đã lưu, đánh dấu tiến độ cũ; thử lại chỉ GET.
8. NONE_SAVED không hiện thành công; SEALED xem được nhưng không sửa.
9. Rỗng thật khác lỗi tải; ADMIN không thấy dữ liệu chỉ số.
10. Focus bàn phím có outline và giao diện hoạt động với reduced motion.

Ảnh đã kiểm tra gồm `batch-1440.png`, `batch-768.png`, `batch-390.png`, `progress-desktop.png`, `partial-retried.png`, `reconciled.png`, `saved-refresh-error.png`, `none-saved.png`, `locked.png`, `empty.png`, `load-error.png`, `keyboard.png` trong `.hallmark/shots/meter-readings/`.

Hallmark cũng chụp các kích thước 1280×800, 1440×900, 1920×1080 và full page desktop/mobile. Rà soát cuối thực hiện trong thread theo harness Codex, giữ shell coral hiện có. Đã sửa nhãn nút xuống dòng, thống nhất button trung tính, trọng lượng chữ và trạng thái thông báo; không còn phát hiện mở trong lần sweep cuối.

## Các lượt chạy trước và điều chỉnh hạ tầng test

Lượt toàn suite đầu đạt 656/658, hai test cũ ở AssetPlacements/ProfileModal hết thời gian chờ. Chạy lại hai tệp thì một test AssetPlacements khác gặp cùng vấn đề thời gian chờ.

App đã có session splash tối thiểu 800 ms, trong khi truy vấn DOM mặc định chỉ chờ 1000 ms. `tests/setup.ts` tăng `asyncUtilTimeout` lên 3000 ms để còn thời gian cho API/render trên worker bận. Không bỏ test, đổi assertion, giảm kiểm tra dữ liệu hoặc thay thời gian splash của ứng dụng. Lượt toàn suite cuối đạt 664/664 sau khi bổ sung đủ 41 test UC37.

## Lint ngoài phạm vi UC37

Các tệp sau không được sửa trong thay đổi này:

| Tệp thuộc `src/components/contracts/` | Lỗi | Cảnh báo |
|---|---:|---:|
| CancelDepositModal.tsx | 1 | 0 |
| CreateRentalContractModal.tsx | 1 | 0 |
| DepositContractModal.tsx | 1 | 0 |
| DepositContractsPage.tsx | 3 | 0 |
| RentalContractsPage.tsx | 4 | 2 |
| UpdateRentalContractModal.tsx | 1 | 0 |

Lỗi là `react-hooks/set-state-in-effect`; cảnh báo là dependencies của hook. ESLint riêng toàn bộ mã nguồn, tích hợp App/shell, fixture, browser test và test setup được sửa đều đạt.

## Tái lập và giới hạn

```powershell
npx vitest run --reporter=dot --reporter=json --outputFile=.hallmark/uc37-full-suite.json
npm run build
node node_modules/eslint/bin/eslint.js . --format json --output-file .hallmark/uc37-eslint-full.json
```

Chạy Vite trong terminal riêng trước kiểm tra trình duyệt:

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5178 --strictPort
npm run test:browser:meter-readings
node C:/Users/lequa/.agents/skills/hallmark/scripts/sloplint.mjs src/components/meter --scope app --genre modern-minimal --render --url "http://127.0.0.1:5178/tests/fixtures/meter-readings-preview.html?view=single"
```

Frontend production gọi API thật; fetch fixture chỉ được cài từ entry trong `tests/fixtures`. Khi chưa được module phụ thuộc cấp kỳ, môi trường thật sẽ không có mục để ghi và hiển thị trạng thái rỗng. Chưa kiểm thử end-to-end với dữ liệu kỳ/biên bản/hóa đơn thật hoặc bằng trình đọc màn hình. Các bảo đảm transaction, khóa và PostgreSQL thuộc kiểm thử backend, không được suy ra từ fixture frontend.

Đặc tả, API, các nhánh a–x và cách phục hồi: [UC37.md](UC37.md).
