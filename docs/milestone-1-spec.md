# Milestone 1: đặc tả schema và kiến trúc

Trạng thái: **đã duyệt (26/10/2026), đã triển khai** trên nhánh `milestone-1`. Các điểm triển khai khác bản nháp nằm ở mục 13. Phạm vi nghiệp vụ nằm ở [milestone-1-scope.md](milestone-1-scope.md); tài liệu này chỉ cụ thể hóa cách xây.

Phần 0 liệt kê các điểm cần chủ dự án quyết định trước khi bắt đầu bước 1.

---

## 0. Điểm cần duyệt

| # | Điểm | Đề xuất | Ảnh hưởng nếu đổi |
|---|---|---|---|
| 1 | **Giao thất bại**: bản chốt ghi "xử lý hàng giống hủy đơn". Thực tế giao lại hôm sau rất phổ biến. | `DELIVERY_FAILED` **vẫn giữ hàng**, cho phép giao lại (`→ DELIVERING`) hoặc hủy (`→ CANCELLED`). Hàng chỉ được trả kho ở bước hủy. | Làm đúng như bản chốt thì giao lại phải tạo đơn mới. |
| 2 | Thư mục hiện là site tĩnh ở gốc (`index.html`, `hero.jpg`, `images/`, `.claude/launch.json`). | Chuyển site tĩnh vào `legacy/` bằng `git mv`, sửa `launch.json`. Ứng dụng mới nằm ở gốc repo. Commit trạng thái hiện tại (đang có `index.html` sửa dở và `images/` chưa theo dõi) trước khi chuyển. | Để nguyên ở gốc cũng chạy được nhưng thư mục lẫn lộn. |
| 3 | Hoàn thành đơn khi **còn nợ** (giao hàng thu tiền). | Cho phép, hiện cảnh báo "còn X đ chưa thu". | Chặn hẳn thì không hỗ trợ thu tiền khi giao. |
| 4 | Định nghĩa **doanh thu** trong Excel. | Doanh thu = tổng tiền các đơn `Hoàn thành`. Lọc thời gian mặc định theo **ngày giao**, có tùy chọn theo ngày tạo. | Ảnh hưởng sheet Tổng hợp và tổng tiền khách. |
| 5 | Sản phẩm nào được chọn vào đơn mới. | Chỉ sản phẩm `Đang bán`. `Tạm ẩn` và `Lưu trữ` không chọn được; đơn đã có thì vẫn xử lý bình thường. | Cho chọn cả `Tạm ẩn` thì "tạm ẩn" chỉ còn nghĩa ẩn khỏi catalog. |
| 6 | Giảm giá. | Chỉ giảm ở **cấp đơn** (số tiền VND). Chưa giảm theo dòng, chưa phần trăm. | Thêm sau không phá schema nếu thêm cột. |
| 7 | Thư viện auth. | Chọn ở bước 1: **Better Auth** (plugin username) nếu thấy gọn, nếu không thì Auth.js credentials. Đây không ảnh hưởng schema nghiệp vụ. | Không. |

---

## 1. Quy ước chung

- Khóa chính: `uuid` (mặc định `gen_random_uuid()`). Riêng `order_counters` dùng `date`.
- Tiền: `integer` đơn vị VND, không số thực. Đủ cho giá trị dưới 2,1 tỷ mỗi trường.
- Thời gian: `timestamptz` lưu UTC. `delivery_date` là `date` theo giờ Việt Nam. Hiển thị bằng múi giờ `Asia/Ho_Chi_Minh`.
- Mọi bảng nghiệp vụ có `created_at`, `updated_at`. Bảng người dùng thao tác có `created_by`, `updated_by` (FK `users.id`).
- Không xóa thật bản ghi có dữ liệu liên quan. Dùng trạng thái hoặc cờ.
- Chuẩn hóa số điện thoại: bỏ ký tự không phải số, `+84` hoặc `84` ở đầu đổi thành `0`. Lưu dạng `0xxxxxxxxx`. Hàm này là hàm thuần dùng chung cho form, tìm kiếm và import.
- Bật RLS trên mọi bảng ở schema `public`, **không tạo policy**. Ứng dụng kết nối bằng chuỗi Postgres từ backend, không dùng khóa anon trong trình duyệt.
- Giá trị enum lưu bằng tiếng Anh, giao diện hiển thị tiếng Việt (bảng ánh xạ ở mục 6).

## 2. Enum

| Enum | Giá trị |
|---|---|
| `Role` | `OWNER`, `STAFF` |
| `FulfillmentMode` | `STOCK_ONLY` (Có sẵn), `MADE_TO_ORDER` (Làm theo đơn), `FLEXIBLE` (Linh hoạt) |
| `ProductStatus` | `ACTIVE` (Đang bán), `HIDDEN` (Tạm ẩn), `ARCHIVED` (Lưu trữ) |
| `OrderStatus` | `NEW`, `CONFIRMED`, `DELIVERING`, `COMPLETED`, `CANCELLED`, `DELIVERY_FAILED` |
| `OrderChannel` | `FACEBOOK`, `ZALO`, `PHONE`, `IN_STORE`, `OTHER` |
| `ReceiveType` | `DELIVERY`, `PICKUP` |
| `StockState` (dòng đơn) | `NONE`, `RESERVED`, `CONSUMED`, `RELEASED` |
| `PaymentType` | `DEPOSIT`, `PAYMENT`, `REFUND` |
| `PaymentMethod` | `CASH`, `BANK_TRANSFER`, `OTHER` |
| `MovementType` | `INITIAL`, `PRODUCE`, `RESERVE`, `RELEASE`, `CONSUME`, `RESTOCK_FROM_ORDER`, `WRITE_OFF`, `ADJUST` |

"Hết hàng" **không phải trạng thái lưu**. Nó được tính ra: sản phẩm `Có sẵn` có `available = 0`. Sản phẩm `Linh hoạt` và `Làm theo đơn` không bao giờ hết hàng vì luôn làm thêm được.

## 3. Bảng

Ký hiệu: **PK** khóa chính, **FK** khóa ngoại, **UQ** duy nhất, `?` cho phép null.

### 3.1 `users`
Bảng người dùng của ứng dụng. Thư viện auth tạo thêm các bảng riêng (mật khẩu băm, session) và liên kết với bảng này.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| username | text UQ | chữ thường, 3–30 ký tự, `a-z0-9._` |
| display_name | text | |
| role | Role | |
| is_active | boolean | mặc định true; khóa tài khoản thì false |
| must_change_password | boolean | true cho tài khoản mới hoặc vừa đặt lại |
| last_login_at | timestamptz? | |
| created_at, updated_at | timestamptz | |

Khóa tài khoản: hủy mọi session đang có và chặn đăng nhập. Chủ shop không thể tự khóa hoặc tự hạ quyền. Luôn còn ít nhất một chủ shop đang hoạt động (kiểm tra trong service).

### 3.2 `categories`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| name | text UQ | |
| description | text? | |
| sort_order | integer | mặc định 0 |
| is_active | boolean | |
| created_at, updated_at, created_by, updated_by | | |

### 3.3 `products`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| code | text UQ | chữ hoa, ví dụ `HS-001` |
| name | text | |
| category_id | uuid FK | |
| description | text? | |
| size | text? | |
| color | text? | |
| price | integer | `>= 0` |
| cost_price | integer? | `>= 0`; chỉ chủ shop thấy |
| fulfillment_mode | FulfillmentMode | mặc định `FLEXIBLE` |
| on_hand | integer | `>= 0`, mặc định 0 |
| reserved | integer | `>= 0`, mặc định 0 |
| status | ProductStatus | mặc định `ACTIVE` |
| created_at, updated_at, created_by, updated_by | | |

Ràng buộc: `CHECK (on_hand >= 0)`, `CHECK (reserved >= 0)`, `CHECK (reserved <= on_hand)`.
`available` là giá trị tính `on_hand - reserved`, không lưu.
Sản phẩm `Làm theo đơn` không dùng tồn: `on_hand` và `reserved` luôn 0, giao diện ẩn hai cột đó. Đổi sang `Làm theo đơn` khi `on_hand > 0` thì bị chặn, phải điều chỉnh về 0 trước.
Mọi thay đổi `on_hand` hoặc `reserved` **chỉ** đi qua `inventory.service`, luôn kèm một dòng `inventory_movements` trong cùng transaction.

### 3.4 `product_images`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| product_id | uuid FK | xóa sản phẩm không xảy ra nên không cascade xóa tay |
| storage_path | text | đường dẫn trong bucket |
| url | text | URL công khai |
| sort_order | integer | |
| is_primary | boolean | |
| created_at | timestamptz | |

Chỉ mục duy nhất một phần: mỗi sản phẩm tối đa một ảnh `is_primary = true`.

### 3.5 `customers`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| name | text | |
| phone | text UQ | đã chuẩn hóa |
| email | text? | |
| address | text? | |
| note | text? | |
| created_at, updated_at, created_by, updated_by | | |

Số đơn, tổng tiền, ngày mua gần nhất **không lưu**, tính bằng truy vấn trên đơn `COMPLETED`. Khách đã có đơn thì không xóa.

### 3.6 `orders`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| code | text UQ | `DH-yymmdd-NNN` |
| customer_id | uuid FK | người đặt |
| recipient_name | text | mặc định lấy từ khách, sửa được |
| recipient_phone | text | chuẩn hóa |
| channel | OrderChannel | |
| receive_type | ReceiveType | |
| delivery_address | text? | bắt buộc nếu `DELIVERY` |
| delivery_date | date? | |
| delivery_time_from | time? | |
| delivery_time_to | time? | `>= from` |
| courier_name | text? | tên người giao, nhập tay |
| status | OrderStatus | mặc định `NEW` |
| subtotal | integer | tổng `qty_ordered * unit_price` |
| discount | integer | `>= 0`, `<= subtotal` |
| shipping_fee | integer | `>= 0` |
| total | integer | `subtotal - discount + shipping_fee` |
| card_message | text? | lời chúc |
| note | text? | |
| confirmed_at, completed_at, cancelled_at | timestamptz? | |
| cancel_reason | text? | bắt buộc khi hủy |
| created_at, updated_at, created_by, updated_by | | |

`subtotal` và `total` do server tính khi lưu, không tin giá trị từ trình duyệt.
Trạng thái sản xuất và thanh toán **không lưu**, tính từ `order_items` và `payments`.

### 3.7 `order_items`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| order_id | uuid FK | |
| product_id | uuid? FK | null = dòng tự do |
| product_code_snapshot | text? | |
| name_snapshot | text | tên tại thời điểm đặt |
| unit_price_snapshot | integer | `>= 0` |
| unit_cost_snapshot | integer? | để dành cho báo cáo lợi nhuận sau này; chỉ chủ shop thấy |
| qty_ordered | integer | `> 0` |
| qty_from_stock | integer | `>= 0`, mặc định 0 |
| qty_to_make | integer | `>= 0`, mặc định 0 |
| qty_made | integer | `>= 0`, mặc định 0 |
| stock_state | StockState | mặc định `NONE` |
| allocated_at | timestamptz? | null = chưa phân bổ |
| note | text? | |
| sort_order | integer | |
| created_at, updated_at | | |

Ràng buộc:
- `CHECK (qty_made <= qty_to_make)`.
- Khi `allocated_at IS NOT NULL`: `qty_from_stock + qty_to_make = qty_ordered`.
- Dòng tự do (`product_id IS NULL`): `qty_from_stock = 0` và `stock_state = NONE`.

`stock_state` là chốt chặn "chỉ giữ và trả một lần" (xem mục 5.3).

### 3.8 `payments`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| order_id | uuid FK | |
| type | PaymentType | |
| amount | integer | `> 0`; `REFUND` được hiểu là trừ |
| method | PaymentMethod | |
| paid_at | timestamptz | mặc định now |
| note | text? | |
| voided_at | timestamptz? | |
| voided_by | uuid? FK | |
| void_reason | text? | |
| created_at, created_by | | |

Dòng thanh toán **không sửa, không xóa**. Nhập nhầm thì chủ shop hủy hiệu lực (điền `voided_*`), dòng hủy không tính vào tổng.
Đã thu ròng = tổng `DEPOSIT` + `PAYMENT` − tổng `REFUND`, chỉ tính dòng chưa hủy hiệu lực.

### 3.9 `inventory_movements` (chỉ thêm, không sửa, không xóa)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| product_id | uuid FK | |
| type | MovementType | |
| quantity | integer | `> 0`, số lượng của sự kiện |
| delta_on_hand | integer | thay đổi thực lên `on_hand` |
| delta_reserved | integer | thay đổi thực lên `reserved` |
| on_hand_after | integer | |
| reserved_after | integer | |
| order_id | uuid? FK | |
| order_item_id | uuid? FK | |
| reason | text? | bắt buộc với `ADJUST` và `WRITE_OFF` |
| created_at, created_by | | |

Ý nghĩa từng loại:

| Loại | delta_on_hand | delta_reserved | Khi nào |
|---|---|---|---|
| INITIAL | +q | 0 | đặt tồn ban đầu khi nhập dữ liệu |
| PRODUCE | +q | 0 | nhân viên nhập thêm hàng làm sẵn |
| RESERVE | 0 | +q | xác nhận đơn, giữ phần lấy từ kho |
| RELEASE | 0 | −q | hủy hoặc hủy xác nhận, trả phần đã giữ |
| CONSUME | −q | −q | đơn hoàn thành |
| RESTOCK_FROM_ORDER | +q | 0 | hàng đã làm của đơn hủy, chủ shop chọn nhập kho |
| WRITE_OFF | 0 | 0 | hàng đã làm của đơn hủy, chủ shop chọn hư hao; chỉ để ghi nhận |
| ADJUST | ±q | 0 | chủ shop chỉnh tay, có lý do |

Bất biến để kiểm tra bằng test và bằng truy vấn đối chiếu: với mỗi sản phẩm, `on_hand = tổng delta_on_hand` và `reserved = tổng delta_reserved`.

### 3.10 `audit_logs`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| actor_id | uuid FK | |
| action | text | ví dụ `order.confirm`, `product.update`, `user.lock` |
| entity_type | text | `order`, `product`, `customer`, `user`, `category`, `payment` |
| entity_id | uuid | |
| summary | text | một câu tiếng Việt cho người đọc |
| data | jsonb? | trước và sau, không chứa mật khẩu |
| created_at | timestamptz | |

Ghi trong cùng transaction với thao tác. Chủ shop đọc ở màn hình lịch sử.

### 3.11 `order_counters`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| day | date PK | ngày theo giờ Việt Nam |
| last_seq | integer | |

Sinh mã đơn: trong transaction, `INSERT ... ON CONFLICT (day) DO UPDATE SET last_seq = last_seq + 1 RETURNING last_seq`. Hai người tạo đơn cùng lúc không bao giờ trùng mã. Mã dạng `DH-261026-001`; từ 1000 đơn trong ngày thì tự mở rộng số chữ số.

### 3.12 Chỉ mục

- `orders(status, delivery_date)`, `orders(customer_id)`, `orders(created_at)`.
- `order_items(order_id)`, `order_items(product_id)`.
- `payments(order_id)`.
- `inventory_movements(product_id, created_at desc)`, `inventory_movements(order_id)`.
- `audit_logs(entity_type, entity_id, created_at desc)`, `audit_logs(created_at desc)`.
- `products(category_id, status)`, và chỉ mục tìm kiếm theo `name` và `code` (trigram).
- `customers(name)` trigram. Tìm theo số điện thoại dùng UQ sẵn có.

## 4. Quyền theo thao tác

Kiểm tra ở **tầng service** (không chỉ ẩn nút). `—` là không được phép.

| Thao tác | Chủ shop | Nhân viên |
|---|---|---|
| Quản lý tài khoản | Có | — |
| Tạo, sửa, ẩn danh mục và sản phẩm | Có | — |
| Xem sản phẩm (không giá vốn) | Có | Có |
| Xem giá vốn, giá vốn snapshot | Có | — |
| Nhập thêm hàng làm sẵn (`PRODUCE`) | Có | Có |
| Điều chỉnh tồn kho (`ADJUST`) | Có | — |
| Tạo, sửa khách | Có | Có |
| Tạo đơn, sửa đơn `NEW` | Có | Có |
| Xác nhận đơn | Có | Có |
| Sửa ghi chú, địa chỉ, giờ giao, người giao, lời chúc của đơn đã xác nhận | Có | Có |
| Sửa dòng hàng, giảm giá, phí giao của đơn đã xác nhận (qua hủy xác nhận) | Có | — |
| Cập nhật số lượng đã làm | Có | Có |
| Bắt đầu giao, hoàn thành, báo giao thất bại, giao lại | Có | Có |
| Hủy đơn `NEW` | Có | Có |
| Hủy đơn đã xác nhận, hủy xác nhận | Có | — |
| Ghi nhận cọc và thanh toán | Có | Có |
| Hoàn tiền, hủy hiệu lực dòng thanh toán | Có | — |
| Xuất Excel, xem lịch sử thao tác | Có | — |

## 5. Luồng nghiệp vụ chi tiết

### 5.1 Chuyển trạng thái đơn

| Từ | Đến | Ai | Điều kiện |
|---|---|---|---|
| `NEW` | `CONFIRMED` | cả hai | có ít nhất một dòng; địa chỉ và ngày giao nếu `DELIVERY`; phân bổ thành công |
| `NEW` | `CANCELLED` | cả hai | có lý do |
| `CONFIRMED` | `DELIVERING` | cả hai | mọi dòng đủ hàng (`qty_made >= qty_to_make`) |
| `CONFIRMED` | `NEW` (hủy xác nhận) | chủ shop | xử lý hàng đã làm (5.4) |
| `CONFIRMED` | `CANCELLED` | chủ shop | có lý do; xử lý hàng đã làm (5.4); xử lý tiền đã thu (5.6) |
| `DELIVERING` | `COMPLETED` | cả hai | cảnh báo nếu còn nợ |
| `DELIVERING` | `DELIVERY_FAILED` | cả hai | có lý do; **vẫn giữ hàng** (xem mục 0, điểm 1) |
| `DELIVERY_FAILED` | `DELIVERING` | cả hai | giao lại |
| `DELIVERY_FAILED` | `CANCELLED` | chủ shop | như hủy từ `CONFIRMED` |
| `COMPLETED`, `CANCELLED` | không | | trạng thái cuối |

Nhãn cho đơn `PICKUP`: `DELIVERING` hiển thị là "Sẵn sàng nhận".

### 5.2 Trạng thái tính ra

**Sản xuất** (chỉ áp dụng khi đơn `CONFIRMED`, `DELIVERING`, `DELIVERY_FAILED`):
- Mọi dòng có `qty_made >= qty_to_make` thì **Đã đủ hàng**. Dòng có `qty_to_make = 0` luôn đủ.
- Ngược lại, có dòng nào `qty_made > 0` thì **Đang làm**.
- Còn lại là **Chưa làm**.

**Thanh toán**:
- Đã thu ròng = 0 → **Chưa thanh toán**.
- 0 < đã thu ròng < `total` → **Đã cọc**.
- Đã thu ròng >= `total` → **Đã thanh toán đủ**.
- Còn lại = `total − đã thu ròng`.

### 5.3 Xác nhận đơn (một transaction)

1. Khóa dòng đơn (`SELECT ... FOR UPDATE`). Nếu `status != NEW` thì dừng (chống bấm hai lần).
2. Lấy các `product_id` của đơn, **sắp xếp theo id** rồi khóa các dòng `products` tương ứng (thứ tự cố định để không deadlock).
3. Với từng dòng đơn, theo thứ tự dòng:
   - Dòng tự do: `from_stock = 0`, `to_make = qty`.
   - Sản phẩm `MADE_TO_ORDER`: `from_stock = 0`, `to_make = qty`.
   - Sản phẩm `FLEXIBLE`: `from_stock = min(qty, available)`, `to_make = qty − from_stock`.
   - Sản phẩm `STOCK_ONLY`: nếu `available < qty` thì **hủy cả transaction**, báo rõ sản phẩm nào thiếu và còn bao nhiêu; ngược lại `from_stock = qty`, `to_make = 0`.
   - Cùng một sản phẩm xuất hiện ở nhiều dòng: `available` được trừ dần trong bộ nhớ khi duyệt từng dòng.
4. Với dòng có `from_stock > 0`: tăng `products.reserved`, ghi `RESERVE`, đặt `stock_state = RESERVED`.
5. Cập nhật dòng đơn (`qty_from_stock`, `qty_to_make`, `allocated_at`), đơn thành `CONFIRMED` với `confirmed_at`, ghi `audit_logs`.

Giá trị phân bổ do hàm thuần `allocate()` tính (mục 8.2); service chỉ áp dụng kết quả.

### 5.4 Hủy hoặc hủy xác nhận

Đầu vào: lý do và, với **mỗi dòng có sản phẩm và `qty_made > 0`**, lựa chọn `RESTOCK` hoặc `WRITE_OFF` (kèm lý do khi `WRITE_OFF`). Dòng tự do không có lựa chọn, chỉ ghi `audit_logs`.

Trong một transaction, khóa đơn và các sản phẩm như mục 5.3. Với mỗi dòng:
- Nếu `stock_state = RESERVED` và `qty_from_stock > 0`: giảm `reserved`, ghi `RELEASE`, `stock_state = RELEASED`.
- Nếu `qty_made > 0` và chọn `RESTOCK`: tăng `on_hand` bằng `qty_made`, ghi `RESTOCK_FROM_ORDER`.
- Nếu `qty_made > 0` và chọn `WRITE_OFF`: ghi `WRITE_OFF` (không đổi tồn).
- Hủy xác nhận: đưa dòng về chưa phân bổ (`qty_from_stock = qty_to_make = qty_made = 0`, `allocated_at = null`, `stock_state = NONE`) và đơn về `NEW`.
- Hủy: đơn `CANCELLED`, đặt `cancelled_at` và `cancel_reason`.

Hủy từ `NEW` không có phân bổ nên không đụng tồn kho.

### 5.5 Hoàn thành đơn

Với mỗi dòng `stock_state = RESERVED` và `qty_from_stock > 0`: giảm cả `on_hand` và `reserved` bằng `qty_from_stock`, ghi `CONSUME`, `stock_state = CONSUMED`. Đơn `COMPLETED` với `completed_at`.

### 5.6 Hủy đơn đã có tiền

Hệ thống **không tự hoàn tiền**. Khi hủy đơn có đã thu ròng > 0, giao diện nhắc chủ shop ghi nhận một dòng `REFUND` (hoặc giữ tiền cọc theo thỏa thuận, và ghi chú lý do). Hủy không bị chặn vì chưa hoàn tiền.

### 5.7 Nhập thêm hàng làm sẵn

Nhân viên chọn sản phẩm (không phải `MADE_TO_ORDER`), nhập số lượng, ghi chú tùy chọn. Tăng `on_hand`, ghi `PRODUCE`. Phần "cần làm" của các đơn đang chờ **không tự lấy** từ hàng vừa nhập; hàng này dùng cho các đơn xác nhận sau. Muốn dùng cho đơn đang chờ thì hủy xác nhận và xác nhận lại (chủ shop), hoặc cập nhật `qty_made` trực tiếp.

### 5.8 Cập nhật đã làm

Nhân viên đặt `qty_made` cho một dòng trong khoảng `0..qty_to_make`, chỉ khi đơn `CONFIRMED` hoặc `DELIVERY_FAILED`. Cập nhật này không đụng tồn kho: hàng làm cho đơn được dành cho đơn, không vào kho tự do.

### 5.9 Sửa đơn

- `NEW`: sửa mọi trường, thêm xóa dòng, tính lại `subtotal` và `total`.
- `CONFIRMED`, `DELIVERING`, `DELIVERY_FAILED`: chỉ sửa ghi chú, địa chỉ, giờ giao, người giao, lời chúc, người nhận. Chủ shop có thể sửa giảm giá và phí giao với điều kiện `total` mới không nhỏ hơn đã thu ròng.
- Muốn đổi dòng hàng: chủ shop hủy xác nhận, sửa, rồi xác nhận lại.

### 5.10 Thanh toán

- `DEPOSIT` và `PAYMENT`: số tiền không vượt quá phần còn lại.
- `REFUND`: không vượt đã thu ròng.
- Chỉ ghi nhận cho đơn chưa `CANCELLED` (riêng `REFUND` được ghi cả sau khi hủy).
- Mọi dòng ghi `audit_logs`.

## 6. Nhãn tiếng Việt

| Enum | Hiển thị |
|---|---|
| `OrderStatus` | Mới, Đã xác nhận, Đang giao (Sẵn sàng nhận với đơn lấy tại tiệm), Hoàn thành, Đã hủy, Giao thất bại |
| Sản xuất | Chưa làm, Đang làm, Đã đủ hàng |
| Thanh toán | Chưa thanh toán, Đã cọc, Đã thanh toán đủ |
| `FulfillmentMode` | Có sẵn, Làm theo đơn, Linh hoạt |
| `ProductStatus` | Đang bán, Tạm ẩn, Lưu trữ (kèm nhãn tính ra "Hết hàng") |
| `PaymentMethod` | Tiền mặt, Chuyển khoản, Khác |
| `PaymentType` | Cọc, Thanh toán, Hoàn tiền |
| `MovementType` | Số dư ban đầu, Làm sẵn, Giữ cho đơn, Trả lại, Xuất cho đơn hoàn thành, Nhập lại từ đơn hủy, Hư hao, Điều chỉnh |

## 7. Màn hình

| Đường dẫn | Nội dung | Ai |
|---|---|---|
| `/login` | Đăng nhập | công khai |
| `/today` | Đơn cần giao hôm nay, việc cần làm, đơn mới chưa xác nhận | cả hai |
| `/orders` | Danh sách đơn, lọc theo trạng thái, ngày giao, tìm theo mã, tên, số điện thoại | cả hai |
| `/orders/new`, `/orders/[id]` | Tạo, xem, sửa đơn; thao tác trạng thái; thanh toán; lịch sử | cả hai |
| `/production` | Danh sách cần làm gom theo sản phẩm và theo đơn, cập nhật số đã làm | cả hai |
| `/products`, `/products/[id]` | Danh sách, chi tiết, ảnh, nhập thêm hàng làm sẵn, lịch sử tồn kho | xem: cả hai; sửa: chủ shop |
| `/categories` | Quản lý danh mục | chủ shop |
| `/customers`, `/customers/[id]` | Danh sách, chi tiết, lịch sử đơn | cả hai |
| `/exports` | Chọn bộ lọc và tải Excel | chủ shop |
| `/staff` | Quản lý tài khoản nhân viên | chủ shop |
| `/audit` | Lịch sử thao tác | chủ shop |

Giao diện ưu tiên điện thoại: danh sách dạng thẻ, nút thao tác lớn, bộ lọc thu gọn.

## 8. Kiến trúc mã nguồn

### 8.1 Cấu trúc thư mục (sau khi chuyển site tĩnh vào `legacy/`)

```
legacy/                   site tĩnh hiện tại (index.html, hero.jpg, images/)
docs/                     tài liệu (scope, spec)
prisma/
  schema.prisma
  migrations/             gồm SQL tay cho CHECK, chỉ mục một phần, RLS
  seed.ts                 tạo chủ shop đầu tiên từ biến môi trường
  import-catalog.ts       nhập sản phẩm và ảnh từ legacy/ (chạy một lần)
src/
  app/
    (auth)/login/
    (admin)/              layout có điều hướng và kiểm tra phiên
      today/ orders/ production/ products/ categories/
      customers/ exports/ staff/ audit/
    api/
      auth/[...all]/      route của thư viện auth
      exports/[kind]/     tải file .xlsx
  server/
    auth/                 cấu hình auth, lấy người dùng hiện tại, kiểm quyền
    db/                   Prisma client, helper transaction và khóa dòng
    domain/               HÀM THUẦN, không truy cập DB
      allocate.ts         phân bổ tồn kho
      order-totals.ts     tính tổng, tổng tiền, kiểm giảm giá
      order-status.ts     bảng chuyển trạng thái, trạng thái sản xuất, thanh toán
      phone.ts            chuẩn hóa số điện thoại
      order-code.ts       định dạng mã đơn
    services/             nghiệp vụ, mỗi hàm là một transaction
      orders.service.ts
      inventory.service.ts
      payments.service.ts
      products.service.ts
      customers.service.ts
      users.service.ts
      exports.service.ts
      audit.service.ts
    actions/              server action mỏng: kiểm quyền, Zod, gọi service
  components/
  lib/                    định dạng tiền, ngày, nhãn tiếng Việt
tests/
  domain/                 kiểm thử hàm thuần
  integration/            kiểm thử với PostgreSQL thật (xem 8.4)
```

Quy tắc: `domain/` không import Prisma, `services/` là nơi **duy nhất** ghi vào tồn kho, `actions/` không chứa logic nghiệp vụ.

### 8.2 Hàm phân bổ

`allocate(items, productsById) → kết quả hoặc lỗi thiếu hàng`. Đầu vào: danh sách dòng (số lượng, product hoặc null) và với mỗi sản phẩm `mode` và `available`. Đầu ra: với mỗi dòng `{ qty_from_stock, qty_to_make }`, hoặc danh sách sản phẩm `STOCK_ONLY` thiếu. Hàm thuần nên kiểm thử đầy đủ không cần database.

### 8.3 Truy cập dữ liệu và tải ảnh

- Mutation dùng server action. Tải Excel dùng route handler.
- Backend dùng **chuỗi kết nối qua pooler** của Supabase cho runtime, **kết nối trực tiếp** cho migration.
- Tải ảnh: trình duyệt tự thu nhỏ và nén (khoảng 1200 px, WebP) rồi tải thẳng lên Storage bằng URL ký sẵn do server cấp, sau đó server ghi `storage_path` và `url`. Cách này tránh đi qua hàm serverless, vốn có giới hạn kích thước body.
- Bucket ảnh sản phẩm công khai chỉ đọc; chỉ server mới ghi.

### 8.4 Kiểm thử

- **Hàm thuần** (Vitest): ví dụ 20/3/17, 0/10, `STOCK_ONLY` thiếu hàng, cùng sản phẩm ở nhiều dòng, bảng chuyển trạng thái, tính tổng, chuẩn hóa số điện thoại.
- **Tích hợp** với Postgres thật (database thử riêng): xác nhận, hủy có nhập kho và hư hao, hoàn thành, giao thất bại rồi giao lại rồi hủy, bấm xác nhận hai lần, hai đơn tranh một tồn kho chạy song song, kiểm tra bất biến `on_hand = tổng delta` sau mỗi kịch bản, nhân viên bị chặn đúng quyền.
- Kiểm thử thủ công trên điện thoại ở bước 5.

### 8.5 Biến môi trường

```
DATABASE_URL            chuỗi pooler (runtime)
DIRECT_URL              chuỗi trực tiếp (migration)
AUTH_SECRET             khóa ký phiên
APP_URL                 địa chỉ ứng dụng
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY   chỉ trên server, dùng cấp URL ký sẵn cho Storage
STORAGE_BUCKET          tên bucket ảnh sản phẩm
SEED_OWNER_USERNAME     chỉ dùng khi chạy seed
SEED_OWNER_PASSWORD     chỉ dùng khi chạy seed
```

Không đưa giá trị thật vào repo. Chỉ có `.env.example` với giá trị giả. Tài khoản chủ shop đầu tiên có `must_change_password = true`.

## 9. Bảo mật

- Mật khẩu băm bởi thư viện auth. Tối thiểu 8 ký tự.
- Giới hạn số lần đăng nhập sai theo tên đăng nhập và theo IP.
- Cookie phiên `HttpOnly`, `Secure`, `SameSite=Lax`.
- Kiểm quyền ở service. Ẩn nút chỉ là tiện lợi.
- Dữ liệu nhập đi qua Zod ở biên server. Không dựng SQL bằng chuỗi nối (khóa dòng dùng truy vấn tham số hóa).
- Excel: ô bắt đầu bằng `=`, `+`, `-`, `@` thêm tiền tố `'`.
- Khóa tài khoản hủy mọi phiên đang có.
- RLS bật, không có policy; khóa service role không bao giờ gửi xuống trình duyệt.
- Nhân viên không nhận trường `cost_price` và `unit_cost_snapshot` trong dữ liệu trả về (loại ở service, không chỉ ẩn ở giao diện).

## 10. Đặc tả xuất Excel

Chỉ chủ shop. Bộ lọc: khoảng thời gian (mặc định theo ngày giao, tùy chọn ngày tạo), trạng thái đơn, khách hàng, danh mục, sản phẩm. Tên file: `bao-cao-{từ}-{đến}.xlsx`.

Mọi sheet có tiêu đề tiếng Việt in đậm, bộ lọc tự động, cố định dòng đầu, độ rộng cột hợp lý. Tiền định dạng `#,##0` kèm "đ" ở tiêu đề cột, ngày giờ theo giờ Việt Nam.

| Sheet | Cột |
|---|---|
| Tổng hợp | Khoảng thời gian, Tổng số đơn, Doanh thu (đơn Hoàn thành), Đã thu, Còn phải thu, số đơn theo từng trạng thái |
| Danh sách đơn | Mã đơn, Ngày tạo, Ngày giao, Khung giờ, Khách, SĐT, Người nhận, SĐT người nhận, Địa chỉ, Kênh, Hình thức nhận, Trạng thái, Thanh toán, Tạm tính, Giảm giá, Phí giao, Tổng, Đã thu, Còn lại, Người tạo, Ghi chú |
| Chi tiết đơn | Mã đơn, Mã SP, Tên SP, SL đặt, Lấy từ kho, Cần làm, Đã làm, Đơn giá, Thành tiền, Giá vốn |
| Khách hàng | Tên, SĐT, Email, Địa chỉ, Số đơn hoàn thành, Tổng tiền, Ngày mua gần nhất, Ghi chú |
| Sản phẩm và tồn kho | Mã, Tên, Danh mục, Phương thức, Giá bán, Giá vốn, Đang có, Đã giữ, Sẵn sàng bán, Trạng thái |

Với lượng dữ liệu một tiệm, tạo file trong một request là đủ. Nếu sau này vượt giới hạn thời gian thì chuyển sang xuất theo luồng hoặc theo khoảng nhỏ hơn.

## 11. Nhập dữ liệu hiện có

`prisma/import-catalog.ts` chạy một lần và có thể chạy lại không tạo trùng (khóa theo `code`):
1. Đọc danh sách sản phẩm và danh mục trong `legacy/index.html`; tên và giá lấy theo dữ liệu hiện có.
2. Tạo danh mục theo nhóm đang dùng (bó hoa, lồng đèn, hộp hoa, giỏ hoa).
3. Tạo sản phẩm `Linh hoạt`, `Đang bán`, tồn 0, `cost_price` để trống để chủ shop điền sau.
4. Thu nhỏ và nén 89 ảnh, tải lên Storage, gán ảnh chính.
5. In báo cáo: số danh mục, số sản phẩm, số ảnh, các dòng bỏ qua và lý do.

Cấu trúc dữ liệu trong `index.html` sẽ được đọc kỹ ở bước 2 trước khi viết script.

## 12. Đối chiếu tiêu chí hoàn thành

| Tiêu chí (scope mục 9) | Nơi được bảo đảm |
|---|---|
| 1 | Mục 4, 9; kiểm thử quyền |
| 2 | Bước 2; mục 8.3 |
| 3 | Mục 3.6–3.8 |
| 4, 5 | Mục 5.3, `allocate()`, kiểm thử hàm thuần |
| 6 | Mục 5.4 |
| 7 | Khóa dòng ở 5.3; kiểm thử song song |
| 8 | `stock_state` ở 3.7 và 5.3–5.5 |
| 9 | Snapshot ở 3.7 |
| 10 | Bất biến ở 3.9; payments bất biến ở 3.8 |
| 11 | Mục 10 và 9 |
| 12 | Mục 3.10 |

## 13. Ghi chú triển khai (khác bản nháp)

| Mục | Bản nháp | Đã làm | Lý do |
|---|---|---|---|
| Giá sản phẩm | `price` integer `>= 0` | `price` cho phép null = "Chưa có giá" | Catalog cũ không có giá. Sản phẩm chưa có giá không thêm vào đơn được; trang Sản phẩm có bộ lọc "Chưa có giá". |
| Bảng người dùng | `users` riêng + bảng của thư viện auth | Dùng bảng `users`, `sessions`, `accounts`, `verifications` của Better Auth (đổi tên sang snake_case), thêm `must_change_password`, `last_login_at` | Một nguồn dữ liệu người dùng duy nhất. Vai trò lưu dạng chuỗi `owner` / `staff`. Email là địa chỉ giả `<username>@users.bichngoc.invalid` vì Better Auth bắt buộc email. |
| Tải ảnh | URL ký sẵn, trình duyệt tải thẳng lên Storage | Trình duyệt thu nhỏ ảnh (tối đa 1600 px), gửi qua server action; server chuyển WebP 1200 px rồi lưu | Đơn giản hơn, ảnh sau khi thu nhỏ luôn dưới giới hạn body. Có hai driver: `local` (thư mục `storage/`, phục vụ qua `/api/files/...`) và `supabase`. |
| Xác nhận đơn | Bắt buộc ngày giao nếu giao tận nơi | Bắt buộc ngày giao hoặc ngày nhận cho mọi đơn, và địa chỉ nếu giao tận nơi | Mọi màn hình theo ngày đều dựa trên ngày giao. |
| Đổi mật khẩu tạm | Bắt đổi khi đăng nhập lần đầu | Hiện thông báo nhắc đổi trên mọi trang cho tới khi đổi | Không chặn công việc của nhân viên mới. |
| Giới hạn đăng nhập sai | Theo tên đăng nhập và IP | Theo IP (5 lần/phút cho đăng nhập), chỉ bật ở production | Cơ chế có sẵn của Better Auth. |
| Màn hình "Hôm nay" | Chỉ ngày hôm nay | "Theo ngày": chọn ngày bất kỳ (lùi, tiến, chọn lịch) | Yêu cầu bổ sung lọc theo ngày (scope mục 12). |
| Khách hàng tạo cùng lúc | Không nêu | Tạo khách khi tạo đơn dùng `INSERT ... ON CONFLICT (phone) DO NOTHING` | Kiểm thử phát hiện hai đơn tạo cùng lúc cho cùng một số điện thoại mới gây lỗi trùng. |
