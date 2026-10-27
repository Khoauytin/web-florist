---
title: Hiển thị thông tin shop trên tổng quan
date: 2026-10-27
summary: Bổ sung thẻ thông tin shop vào trang quản trị và kiểm tra đầy đủ.
---

# Hiển thị thông tin shop trên tổng quan

## What happened
Trang `/admin` đã lấy `shop_settings` nhưng chỉ hiển thị tên shop ở phần đầu, nên chủ shop không thấy điện thoại, Zalo và các liên kết mạng xã hội trên trang tổng quan.

## Decision
Thêm component `ShopSummary` ngay sau bốn thẻ tổng quan, giữ màn hình chỉnh sửa hiện có tại `/admin/settings`. Giá trị trống hiển thị `Chưa thiết lập`; số điện thoại và kênh liên hệ có liên kết phù hợp; URL dài được phép xuống dòng trên màn hình nhỏ.

## Verification
Đã thêm hai test render phía server và xác nhận chu trình đỏ/xanh. `npm run typecheck`, `npm run lint`, `npm run test:unit` (17 test) và `npm run build` đều đạt. Kiểm tra trực quan bằng dev server không chạy được do dịch vụ phê duyệt môi trường trả lỗi 404, không phải lỗi ứng dụng.

## Next steps
Mở `/admin` trong môi trường chạy ứng dụng để xác nhận trực quan trên thiết bị 375px khi dịch vụ phê duyệt hoạt động lại.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
