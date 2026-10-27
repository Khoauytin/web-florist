# Bích Ngọc Florist: quản lý tiệm hoa

Web app quản lý đơn hàng, sản phẩm, tồn kho thành phẩm, sản xuất theo đơn và khách hàng cho tiệm hoa. Có hai vai trò (chủ shop, nhân viên) và xuất Excel.

- Phạm vi nghiệp vụ: [docs/milestone-1-scope.md](docs/milestone-1-scope.md)
- Đặc tả kỹ thuật: [docs/milestone-1-spec.md](docs/milestone-1-spec.md)
- Mockup giao diện đã duyệt: [docs/ui-mockups/index.html](docs/ui-mockups/index.html)
- Catalog tĩnh cũ: [legacy/](legacy/)

## Công nghệ

Next.js 16 (App Router, server actions), React 19, TypeScript, Prisma 7 + PostgreSQL, Better Auth (đăng nhập bằng tên đăng nhập, plugin admin), Zod, ExcelJS, sharp, Vitest.

## Chạy ở máy

Yêu cầu: Node.js 22+, Docker.

```bash
npm install
cp .env.example .env          # rồi sửa BETTER_AUTH_SECRET và SEED_OWNER_PASSWORD
npm run db:up                 # Postgres trong Docker, cổng 5433 (tạo sẵn database florist_test)
npx prisma migrate deploy     # tạo bảng, ràng buộc, RLS
npm run db:seed               # tạo tài khoản chủ shop đầu tiên và 4 danh mục
npm run db:import-catalog     # (một lần) nhập 68 sản phẩm và ảnh từ legacy/
npm run dev                   # http://localhost:3000
```

Đăng nhập bằng `SEED_OWNER_USERNAME` / `SEED_OWNER_PASSWORD` trong `.env`. Sản phẩm nhập từ catalog cũ chưa có giá: chủ shop vào Sản phẩm, lọc "Chưa có giá" để điền.

## Kiểm thử

```bash
npm test             # toàn bộ: logic thuần + tích hợp với Postgres thật
npm run test:unit    # chỉ logic thuần (không cần database)
npm run typecheck
npm run lint
```

Kiểm thử tích hợp chạy trên database `florist_test` (`TEST_DATABASE_URL`) và xóa sạch dữ liệu của database đó mỗi lần chạy. Trước lần đầu, tạo bảng cho nó:

```bash
DIRECT_URL="postgresql://florist:florist@localhost:5433/florist_test" npx prisma migrate deploy
```

## Cấu trúc

```
src/
  app/(app)/        các màn hình sau đăng nhập (today, orders, production, products, ...)
  app/login/        đăng nhập
  app/api/          auth, xuất Excel, phục vụ ảnh khi lưu cục bộ
  server/domain/    logic thuần: phân bổ tồn kho, tính tiền, trạng thái, ngày
  server/services/  nghiệp vụ, mỗi thao tác ghi là một transaction
  server/actions/   server action: kiểm quyền + Zod, rồi gọi service
  components/       giao diện
  lib/              ngày giờ (Asia/Ho_Chi_Minh), định dạng tiền, nhãn tiếng Việt
prisma/             schema, migrations (có SQL viết tay cho CHECK và RLS), seed, import
tests/              domain/ (thuần) và integration/ (Postgres)
```

Quy tắc: chỉ `inventory.service.applyMovement` được thay đổi `on_hand`/`reserved`, luôn kèm một dòng `inventory_movements` trong cùng transaction.

## Đưa lên mạng

Kiến trúc dự kiến là Vercel cho ứng dụng và Supabase cho Postgres và ảnh. Cả hai đều cần tài khoản của chủ dự án:

1. Tạo project Supabase (khu vực Singapore). Lấy chuỗi kết nối **pooler** cho `DATABASE_URL` và **direct** cho `DIRECT_URL`. Tạo bucket công khai `product-images`.
2. Chạy `npx prisma migrate deploy` với `DIRECT_URL` của Supabase, rồi `npm run db:seed`.
3. Trên Vercel, khai báo các biến trong `.env.example`, đặt `STORAGE_DRIVER=supabase`, `BETTER_AUTH_URL` là địa chỉ thật, và chọn region gần Supabase.

Lưu ý: gói Hobby của Vercel chỉ dành cho mục đích phi thương mại. Khi tiệm dùng thật cần gói trả phí, hoặc một nơi host Node.js khác.
