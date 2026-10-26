# Milestone 1: phạm vi đã chốt

Trạng thái: **đã chốt với chủ dự án** (tiệm hoa Bích Ngọc Florist). Chưa có code của ứng dụng quản trị.
Tài liệu liên quan: [milestone-1-spec.md](milestone-1-spec.md) (đặc tả schema và kiến trúc, đang chờ duyệt).

## 1. Mục tiêu

Hệ thống quản trị online cho một tiệm hoa. Chủ shop và nhân viên dùng giao diện web, tối ưu cho điện thoại, để quản lý danh mục, sản phẩm, tồn kho thành phẩm, sản xuất theo đơn, khách hàng và đơn hàng, rồi xuất Excel. Không ai phải sửa code hay database.

## 2. Vai trò

| | Chủ shop | Nhân viên |
|---|---|---|
| Tài khoản nhân viên (tạo, sửa, khóa) | Có | Không |
| Danh mục và sản phẩm (thêm, sửa, ẩn, ảnh, giá) | Có | Chỉ xem, **không thấy giá vốn** |
| Điều chỉnh tồn kho thủ công | Có | Không |
| Nhập thêm hàng làm sẵn | Có | Có |
| Khách hàng | Có | Tạo, sửa |
| Tạo đơn, cập nhật sản xuất, giao hàng, thanh toán | Có | Có |
| Hủy xác nhận, sửa số lượng đơn đã xác nhận, hoàn cọc | Có | Không |
| Xuất Excel, xem lịch sử thao tác | Có | Không |

Đăng nhập bằng **tên đăng nhập và mật khẩu**, không dùng email.

## 3. Chức năng theo module

**A. Tài khoản:** đăng nhập, đăng xuất, đổi mật khẩu, chủ shop tạo và khóa nhân viên, đặt lại mật khẩu cho nhân viên.

**B. Danh mục:** thêm, sửa tên và mô tả, sắp xếp thứ tự, ẩn hoặc kích hoạt. Không xóa thật nếu đã có sản phẩm.

**C. Sản phẩm:**
- Thông tin: mã, tên, danh mục, mô tả, nhiều ảnh, giá bán, giá vốn.
- Tồn kho: `on_hand` (đang có), `reserved` (đã giữ), `available = on_hand − reserved`.
- Phương thức đáp ứng: `Có sẵn`, `Làm theo đơn` hoặc `Linh hoạt` (mặc định).
- Trạng thái: đang bán, hết hàng, tạm ẩn, lưu trữ. Không xóa thật sản phẩm đã vào đơn.
- Chức năng: thêm, sửa, ẩn, nhập thêm hàng làm sẵn, xem lịch sử biến động tồn kho, tìm kiếm và lọc.
- Ảnh tự thu nhỏ và nén khi tải lên.

**D. Khách hàng:** thêm, sửa, tìm theo số điện thoại hoặc tên. Số điện thoại được chuẩn hóa và duy nhất, nên không trùng. Xem lịch sử đơn, tổng số đơn, tổng tiền, ngày mua gần nhất.

**E. Đơn hàng:**
- Mã đơn tự động theo ngày, ví dụ `DH-261026-001`.
- Khách đặt hàng, người nhận (tên, số điện thoại), kênh đặt (Facebook, Zalo, điện thoại, tại tiệm) và hình thức nhận (giao hoặc đến lấy).
- Dòng sản phẩm lấy từ danh mục hoặc **dòng tự do** (bó theo yêu cầu, không gắn tồn kho).
- Số lượng, đơn giá, giảm giá, phí giao, tổng tiền. Mỗi dòng lưu **tên và giá tại thời điểm đặt**.
- Địa chỉ, ngày và khung giờ giao, người giao, lời chúc, ghi chú.
- Lưu người tạo và người cập nhật gần nhất.
- Đơn không bị xóa, chỉ hủy.

**F. Thanh toán:** nhiều lần thanh toán, gồm cọc, thanh toán thêm, hoàn tiền. Phương thức gồm tiền mặt, chuyển khoản, khác. Đã trả và còn lại do hệ thống tính từ các dòng thanh toán.

**G. Sản xuất và màn hình "Hôm nay":**
- Danh sách "cần làm" tổng hợp từ các đơn đã xác nhận: sản phẩm nào, bao nhiêu, cho đơn nào, giao lúc nào.
- Nhân viên cập nhật số lượng đã làm.
- Màn hình "Hôm nay" liệt kê đơn cần giao và việc cần làm. Chưa có biểu đồ doanh thu.

**H. Xuất Excel (`.xlsx`):**
- Năm sheet: Tổng hợp, Danh sách đơn, Chi tiết sản phẩm trong đơn, Khách hàng, Sản phẩm và tồn kho.
- Tiêu đề tiếng Việt, bộ lọc tự động, cố định dòng đầu, định dạng tiền VND và ngày giờ.
- Lọc theo khoảng thời gian, trạng thái, khách hàng, danh mục, sản phẩm.
- Chống chèn công thức: ô bắt đầu bằng `=`, `+`, `-`, `@` được escape.

**I. Lịch sử thao tác:** chủ shop xem ai làm gì, lúc nào, với đơn, sản phẩm hoặc tồn kho nào.

**J. Nhập dữ liệu hiện có:** script chạy một lần đưa 89 ảnh và danh sách sản phẩm trong `index.html` vào database.

## 4. Quy tắc nghiệp vụ

### Ba trạng thái độc lập
- **Đơn:** `Mới` → `Đã xác nhận` → `Đang giao` → `Hoàn thành`. Nhánh phụ: `Đã hủy`, `Giao thất bại`.
- **Sản xuất** (tự tính): `Chưa làm` → `Đang làm` → `Đã đủ hàng`.
- **Thanh toán** (tự tính): `Chưa thanh toán` → `Đã cọc` → `Đã thanh toán đủ`.

Đơn chỉ chuyển sang `Đang giao` khi mọi dòng đã đủ hàng.

### Phân bổ khi xác nhận đơn
- `Có sẵn`: lấy hết từ kho. Nếu không đủ thì **không cho xác nhận**.
- `Làm theo đơn`: lấy từ kho = 0, cần làm = toàn bộ số lượng.
- `Linh hoạt`: lấy từ kho = `min(khách đặt, available)`, cần làm = phần còn lại.
- Dòng tự do: không đụng tồn kho, cần làm = toàn bộ.
- Kết quả lưu vào `qty_ordered`, `qty_from_stock`, `qty_to_make`, `qty_made`. Phần lấy từ kho làm tăng `reserved`.
- Ví dụ: khách đặt 20, kho có 3, thì lấy 3 và cần làm 17. Kho có 0, khách đặt 10, thì lấy 0 và cần làm 10, tồn không âm.

### Khi đơn hoàn thành
`on_hand` và `reserved` cùng giảm bằng `qty_from_stock`. Hàng làm theo đơn không chạm vào tồn kho.

### Khi giao thất bại
Đơn chuyển sang `Giao thất bại` và **vẫn giữ hàng**. Có thể giao lại (`Đang giao`), hoặc chủ shop hủy đơn. Hàng chỉ được trả kho ở bước hủy.

### Khi hủy hoặc hủy xác nhận
- `reserved` giảm bằng `qty_from_stock`, tồn kho được trả lại.
- Với hàng đã làm (`qty_made`), chủ shop chọn từng dòng: **nhập vào kho để bán lại** (cộng `on_hand`) hoặc **ghi hư hao** (không cộng, có lý do).
- Hủy đơn chưa xác nhận thì tồn kho không đổi.
- Mỗi đơn chỉ giữ và trả hàng đúng một lần.

### Sửa đơn đã xác nhận
Sửa ghi chú, địa chỉ, giờ giao, người giao thì nhân viên làm được. Đổi sản phẩm hoặc số lượng thì chủ shop phải hủy xác nhận, sửa rồi xác nhận lại.

### Mọi biến động tồn kho
Đều ghi vào `inventory_movements` gồm loại (nhập làm sẵn, giữ cho đơn, trả về, hoàn thành, hư hao, điều chỉnh), số lượng, người thực hiện, thời gian, lý do và đơn liên quan.

### Quy tắc khác
- Quyền hoàn cọc chỉ chủ shop. Nhân viên chỉ hủy được đơn ở trạng thái `Mới`.
- Không xóa thật khách, sản phẩm, danh mục, đơn nếu đã có dữ liệu liên quan.

## 5. Dữ liệu chính

`users`, `categories`, `products`, `product_images`, `customers`, `orders`, `order_items`, `payments`, `inventory_movements`, `audit_logs`.

Ràng buộc ở tầng database: tồn kho không âm, `reserved ≤ on_hand`, số điện thoại khách duy nhất, mã đơn duy nhất.

## 6. Yêu cầu phi chức năng

- Giao diện tiếng Việt, ưu tiên điện thoại, dùng tốt trên máy tính.
- Tiền VND lưu số nguyên. Thời gian lưu UTC, hiển thị giờ Việt Nam.
- Khóa dòng sản phẩm khi xác nhận hoặc hủy, nên hai người thao tác cùng lúc không bán trùng hàng.
- Mọi truy cập dữ liệu đi qua backend. Bật RLS trên Supabase để chặn API công khai.
- Danh sách có phân trang. Excel xuất theo bộ lọc.
- Logic phân bổ tồn kho có kiểm thử tự động.

## 7. Công nghệ

Next.js, React, TypeScript, Tailwind, Zod, Prisma, PostgreSQL (Supabase), Supabase Storage, ExcelJS, thư viện auth chạy cùng Prisma (Better Auth hoặc Auth.js). Deploy trên Vercel và Supabase cùng khu vực Singapore.

Giai đoạn phát triển dùng gói miễn phí. Khi dùng thật cần gói trả phí: gói Hobby của Vercel giới hạn ở mục đích phi thương mại (tài liệu Vercel cập nhật 14/09/2026), Supabase Free giới hạn 500 MB database và 1 GB storage.

## 8. Lộ trình năm bước

| Bước | Nội dung | Sản phẩm bàn giao |
|---|---|---|
| 1 | Nền tảng | Project, database, đăng nhập, phân quyền, deploy thử |
| 2 | Danh mục và sản phẩm | Quản lý đầy đủ, ảnh, nhập dữ liệu từ `index.html` |
| 3 | Khách hàng, đơn hàng, thanh toán | Nhập đơn thật, cọc, hoàn cọc, chưa có tồn kho |
| 4 | Tồn kho và sản xuất | Phân bổ, hủy, bảng cần làm, màn hình "Hôm nay" |
| 5 | Excel và hoàn thiện | Xuất Excel, lịch sử thao tác, kiểm tra trên điện thoại |

## 9. Tiêu chí hoàn thành

1. Chủ shop đăng nhập, tạo nhân viên. Nhân viên bị chặn đúng các chức năng chủ shop và không thấy giá vốn.
2. Tạo danh mục và sản phẩm có ảnh hoàn toàn trên giao diện. Dữ liệu còn nguyên sau khi tải lại và khi mở từ thiết bị khác.
3. Tạo được đơn có khách, người nhận khác khách, dòng tự do, cọc và thông tin giao.
4. Xác nhận đơn 20 bó khi kho có 3 cho ra lấy 3, làm 17. Kho 0, đặt 10 cho ra lấy 0, làm 10, tồn không âm.
5. Sản phẩm `Có sẵn` thiếu hàng thì không xác nhận được.
6. Hủy đơn đã xác nhận trả đúng tồn kho. Hàng đã làm được nhập kho hoặc ghi hư hao theo lựa chọn của chủ shop.
7. Hai người xác nhận cùng lúc hai đơn tranh một tồn kho thì chỉ có kết quả đúng, không bán trùng.
8. Không thể giữ hay trả tồn hai lần cho cùng một đơn.
9. Đơn cũ giữ nguyên tên và giá sau khi sản phẩm bị đổi.
10. Tồn kho, tiền đã trả và còn lại luôn khớp với lịch sử biến động và lịch sử thanh toán.
11. File Excel mở được, đúng bộ lọc, đúng định dạng, không bị chèn công thức.
12. Chủ shop xem được ai làm gì trên đơn và tồn kho.

## 10. Ngoài phạm vi

Nguyên vật liệu, thanh toán online, tích hợp Facebook hoặc Zalo, nhập từ Excel, báo cáo lợi nhuận, nhiều chi nhánh, PWA, nối catalog công khai với database. Hai mục cuối là Milestone sau.

## 11. Quyết định đã duyệt

- Chỉ chủ shop được hoàn cọc, nhân viên chỉ hủy được đơn `Mới`.
- Nhân viên được nhập thêm hàng làm sẵn, vì đó là việc hằng ngày.
- Hàng đã làm của đơn bị hủy do chủ shop chọn nhập kho hay hư hao, theo từng dòng.
- `Giao thất bại` vẫn giữ hàng, cho giao lại hoặc hủy.
- Site tĩnh hiện tại chuyển vào `legacy/`; ứng dụng mới nằm ở gốc repo.
- Cho hoàn thành đơn khi còn nợ, kèm cảnh báo.
- Doanh thu = tổng tiền đơn `Hoàn thành`; lọc mặc định theo ngày giao, có tùy chọn ngày tạo.
- Chỉ sản phẩm `Đang bán` được chọn vào đơn mới.
- Giảm giá chỉ ở cấp đơn (số tiền VND).
- Thư viện đăng nhập chọn ở bước 1 (Better Auth hoặc Auth.js).
- Dữ liệu catalog cũ không có tên và giá: khi nhập, sản phẩm nhận tên tạm và giá 0, chủ shop điền lại trên giao diện.

## 12. Lọc theo ngày (bổ sung 26/10/2026)

Mọi màn hình có dữ liệu theo thời gian đều lọc được theo ngày, và bộ lọc nằm trên URL để mở lại hoặc chia sẻ được:
- **Hôm nay → Theo ngày:** chọn một ngày bất kỳ (lùi, tiến, về hôm nay) để xem đơn cần giao, việc cần làm, đơn mới và tiền còn phải thu của ngày đó.
- **Đơn hàng:** lọc theo khoảng ngày giao hoặc ngày tạo, có lựa chọn nhanh (Hôm nay, Ngày mai, 7 ngày tới, Tháng này) và chọn khoảng tùy ý; kết hợp với trạng thái và ô tìm kiếm.
- **Sản xuất:** lọc theo ngày giao (một ngày hoặc khoảng).
- **Lịch sử tồn kho của sản phẩm, lịch sử thao tác:** lọc theo khoảng ngày.
- **Khách hàng:** lịch sử đơn của khách lọc theo khoảng ngày.
- **Xuất Excel:** theo khoảng ngày như đã chốt.
