---
title: Xóa sản phẩm và danh mục an toàn
date: 2026-10-27
summary: "Thêm xóa vĩnh viễn có bảo vệ đơn hàng, ảnh và sản phẩm lưu trữ"
---

# Xóa sản phẩm và danh mục an toàn

## Kết quả
Đã bổ sung xóa vĩnh viễn sản phẩm và xóa danh mục trong trang quản trị. Sản phẩm đã có trong đơn bị chặn xóa; danh mục còn bất kỳ sản phẩm nào, kể cả đã lưu trữ, cũng bị chặn.

## Thay đổi chính
- Xóa sản phẩm sẽ xóa bản ghi ảnh và tệp ảnh lưu trữ.
- Giao diện có hộp xác nhận và hiển thị lỗi an toàn.
- Chức năng ẩn khỏi web và lưu trữ sản phẩm giữ nguyên, tách biệt với xóa vĩnh viễn.
- Đặc tả V2 được cập nhật với các quy tắc xóa.

## Xác minh
TypeScript, ESLint, Prisma validate, 41 bài kiểm thử và build production đều đạt. Kiểm thử bao gồm tệp ảnh thật, sản phẩm đã có trong đơn, danh mục chứa sản phẩm đã lưu trữ và hành vi lưu trữ.

## Tiếp theo
Chuẩn bị lại staging trước khi commit vì worktree V2 hiện còn nhiều thay đổi staged, unstaged và untracked xen kẽ.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
