# Khôi phục phiên đăng nhập

`src/services/sessionClient.ts` cung cấp `authenticatedFetch` cho `/auth/me`, hồ sơ,
tài sản, quản lý tài khoản Host và đổi mật khẩu. API đăng nhập, đăng ký, Google,
khôi phục mật khẩu và đăng xuất không tự refresh khi nhận lỗi.

Khi API được bảo vệ trả `401`, các request trong tab chờ cùng một lần làm mới.
Trong Web Lock `rentops-auth-session`, client gọi `/auth/me` bằng cookie hiện tại
trước. Nếu một tab khác đã làm mới cookie thì không cần xoay refresh token lần nữa.
Nếu access token vẫn hết hạn, client lấy CSRF rồi POST `/auth/refresh`.
Chỉ phát lại request ban đầu một lần, giữ nguyên JSON/FormData và lấy lại CSRF cho
request ghi. Request ghi lỗi mạng không được tự phát lại.

Web Locks phối hợp các tab trên cùng origin; môi trường không cung cấp API này
chỉ có khóa trong từng tab. Các tab cần chạy cùng origin trong secure context để
dùng cơ chế phối hợp đầy đủ.

Refresh `401`, hoặc `403` với thông báo Account bị khóa/thiếu hồ sơ đã biết từ
backend, kết thúc phiên. Lỗi mạng, `500`, CSRF và phản hồi không hợp lệ hiển thị
lỗi cho phép thử lại, giữ giao diện và thông tin đang nhập. Nếu phản hồi refresh
bị mất, kiểm tra `/auth/me` để khôi phục; khi kết quả xoay token còn chưa rõ, chỉ
kiểm tra lại phiên, không POST lại token có thể đã dùng. Đăng nhập hoặc đăng xuất
tường minh sẽ kết thúc trạng thái chưa rõ này.

Phiên có một generation trong bộ nhớ. Đổi tài khoản, đăng xuất và reset mật khẩu
vô hiệu hóa request đang chờ. Đăng nhập/đăng xuất/reset mật khẩu dùng cùng khóa
với refresh để tránh phản hồi cũ ghi cookie sau khi phiên mới đã được thiết lập.
Request bị abort, đổi URL hoặc không còn thuộc controller đang hoạt động không
được phát lại. Các tab thông báo thay đổi Account qua storage event; chỉ lưu
Account ID, nonce thông báo và cờ kết quả refresh chưa rõ, không lưu mật khẩu hoặc
access/refresh token trong Web Storage.

Khi mở ứng dụng, màn hình chờ hiển thị biểu tượng tòa nhà và chữ RentOps ở giữa
trang trong lúc kiểm tra phiên. Logo đứng yên, rộng 128px trên desktop và 104px
trên mobile; trạng thái kiểm tra vẫn có nội dung dành cho trình đọc màn hình.
Request xác thực chạy ngay; màn hình chờ hiện tối thiểu 800ms trước khi vào
dashboard hoặc form đăng nhập, không cộng thêm thời gian nếu request lâu hơn.
Lỗi kết nối hiện ngay nút **Thử lại**, giữ đường dẫn đang mở; thử lại bắt đầu
lượt chờ mới. Timer và request được hủy khi rời luồng hoặc đổi tài khoản. Trang Google
onboarding/callback và quên/đặt lại mật khẩu dùng luồng khởi tạo riêng.
Người dùng có thể chủ động chọn **Đăng nhập lại** nếu không khôi phục được cookie
sau một lần xoay token chưa rõ kết quả; ứng dụng không tự chuyển sang đăng nhập.

Không có timer refresh nền. Chính sách backend giữ nguyên: access token 15 phút,
phiên không hoạt động 7 ngày, giới hạn tuyệt đối 30 ngày. Đổi mật khẩu thành công
vẫn kết thúc phiên.

Kiểm thử: `npm test`, `npm run build`, `npm run lint`. Với Vite đang chạy, dùng
`npm run test:browser:session-splash` để kiểm tra bố cục, trạng thái hỗ trợ tiếp cận
và reduced motion trên tám kích thước màn hình. Backend chạy `./mvnw.cmd -q
test` bằng JDK 25, dùng H2; không chạy các kiểm thử `*IT` trên PostgreSQL thực.
