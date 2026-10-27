import ExcelJS from "exceljs";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { netPaid, paymentState } from "@/server/domain/order-totals";
import { formatPhone } from "@/server/domain/phone";
import { formatRange, vnDayRange, ymdToDbDate, type Ymd } from "@/lib/dates";
import {
  CHANNEL_LABELS,
  FULFILLMENT_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  PAYMENT_STATE_LABELS,
  PRODUCT_STATUS_LABELS,
  RECEIVE_TYPE_LABELS,
} from "@/lib/labels";

export interface ExportFilter {
  from: Ymd;
  to: Ymd;
  dateField: "delivery" | "created";
  statuses?: OrderStatus[];
  customerId?: string;
  categoryId?: string;
  productId?: string;
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const MONEY = "#,##0";

/** Excel has no time zones: shift instants so the sheet shows Vietnam wall-clock time. */
const vnTime = (d: Date | null) => (d ? new Date(d.getTime() + VN_OFFSET_MS) : null);

/** Cells are typed text; risky leading characters are also prefixed so nothing reads as a formula. */
export function safeText(value: string | null | undefined): string {
  if (!value) return "";
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function sheet(wb: ExcelJS.Workbook, name: string, columns: { header: string; key: string; width: number; money?: boolean; date?: string }[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.money ? { numFmt: MONEY } : c.date ? { numFmt: c.date } : {} }));
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FF16335B" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF6" } };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 30;
  return ws;
}

function finish(ws: ExcelJS.Worksheet) {
  if (ws.rowCount >= 1) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, ws.rowCount), column: ws.columnCount } };
}

export function exportFileName(f: ExportFilter) {
  return `bao-cao-${f.from}-${f.to}.xlsx`;
}

export async function buildWorkbook(f: ExportFilter): Promise<Buffer> {
  const itemFilter: Prisma.OrderItemWhereInput = {
    ...(f.productId ? { productId: f.productId } : {}),
    ...(f.categoryId ? { product: { categoryId: f.categoryId } } : {}),
  };
  const hasItemFilter = Boolean(f.productId || f.categoryId);
  const where: Prisma.OrderWhereInput = {
    ...(f.dateField === "created" ? { createdAt: vnDayRange(f.from, f.to) } : { deliveryDate: { gte: ymdToDbDate(f.from), lte: ymdToDbDate(f.to) } }),
    ...(f.statuses?.length ? { status: { in: f.statuses } } : {}),
    ...(f.customerId ? { customerId: f.customerId } : {}),
    ...(hasItemFilter ? { items: { some: itemFilter } } : {}),
  };
  const orders = await prisma.order.findMany({
    where,
    orderBy: [{ deliveryDate: "asc" }, { createdAt: "asc" }],
    include: {
      customer: true,
      createdBy: { select: { name: true } },
      items: { where: itemFilter, orderBy: { sortOrder: "asc" } },
      payments: { select: { type: true, amount: true, voidedAt: true } },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Bích Ngọc Florist";
  wb.created = new Date();

  // --- Tổng hợp
  const live = orders.filter((o) => o.status !== "CANCELLED");
  const revenue = orders.filter((o) => o.status === "COMPLETED").reduce((s, o) => s + o.total, 0);
  const collected = orders.reduce((s, o) => s + netPaid(o.payments), 0);
  const owed = live.reduce((s, o) => s + Math.max(0, o.total - netPaid(o.payments)), 0);
  const summary = wb.addWorksheet("Tổng hợp");
  summary.columns = [{ width: 34 }, { width: 22 }];
  const rows: [string, string | number][] = [
    ["Khoảng thời gian", formatRange(f.from, f.to)],
    ["Tính theo", f.dateField === "created" ? "Ngày tạo đơn" : "Ngày giao"],
    ["Tổng số đơn", orders.length],
    ["Doanh thu (đơn Hoàn thành)", revenue],
    ["Đã thu", collected],
    ["Còn phải thu (trừ đơn đã hủy)", owed],
    ["", ""],
    ["Số đơn theo trạng thái", ""],
    ...ORDER_STATUSES.map((s) => [ORDER_STATUS_LABELS[s], orders.filter((o) => o.status === s).length] as [string, number]),
  ];
  rows.forEach(([k, v], i) => {
    const r = summary.addRow([k, v]);
    if ([3, 4, 5].includes(i)) r.getCell(2).numFmt = MONEY;
    if (i === 7) r.font = { bold: true };
  });
  summary.getColumn(1).font = { bold: false };
  summary.getCell("A1").font = { bold: true };

  // --- Danh sách đơn
  const os = sheet(wb, "Danh sách đơn", [
    { header: "Mã đơn", key: "code", width: 16 },
    { header: "Ngày tạo", key: "createdAt", width: 17, date: "dd/mm/yyyy hh:mm" },
    { header: "Ngày giao", key: "deliveryDate", width: 12, date: "dd/mm/yyyy" },
    { header: "Khung giờ", key: "time", width: 13 },
    { header: "Khách", key: "customer", width: 22 },
    { header: "SĐT", key: "phone", width: 14 },
    { header: "Người nhận", key: "recipient", width: 22 },
    { header: "SĐT người nhận", key: "rphone", width: 14 },
    { header: "Địa chỉ", key: "address", width: 34 },
    { header: "Kênh", key: "channel", width: 11 },
    { header: "Hình thức nhận", key: "receive", width: 14 },
    { header: "Trạng thái", key: "status", width: 14 },
    { header: "Thanh toán", key: "pay", width: 16 },
    { header: "Tạm tính (đ)", key: "subtotal", width: 14, money: true },
    { header: "Giảm giá (đ)", key: "discount", width: 13, money: true },
    { header: "Phí giao (đ)", key: "ship", width: 12, money: true },
    { header: "Tổng (đ)", key: "total", width: 14, money: true },
    { header: "Đã thu (đ)", key: "paid", width: 14, money: true },
    { header: "Còn lại (đ)", key: "owed", width: 14, money: true },
    { header: "Người tạo", key: "createdBy", width: 16 },
    { header: "Ghi chú", key: "note", width: 30 },
  ]);
  for (const o of orders) {
    const paid = netPaid(o.payments);
    os.addRow({
      code: o.code,
      createdAt: vnTime(o.createdAt),
      deliveryDate: o.deliveryDate,
      time: [o.deliveryTimeFrom, o.deliveryTimeTo].filter(Boolean).join(" - "),
      customer: safeText(o.customer.name),
      phone: formatPhone(o.customer.phone),
      recipient: safeText(o.recipientName),
      rphone: formatPhone(o.recipientPhone),
      address: safeText(o.deliveryAddress),
      channel: CHANNEL_LABELS[o.channel],
      receive: RECEIVE_TYPE_LABELS[o.receiveType],
      status: ORDER_STATUS_LABELS[o.status],
      pay: PAYMENT_STATE_LABELS[paymentState(o.total, paid)],
      subtotal: o.subtotal,
      discount: o.discount,
      ship: o.shippingFee,
      total: o.total,
      paid,
      owed: o.status === "CANCELLED" ? 0 : Math.max(0, o.total - paid),
      createdBy: safeText(o.createdBy.name),
      note: safeText(o.note),
    });
  }
  finish(os);

  // --- Chi tiết đơn
  const ds = sheet(wb, "Chi tiết đơn", [
    { header: "Mã đơn", key: "code", width: 16 },
    { header: "Ngày giao", key: "deliveryDate", width: 12, date: "dd/mm/yyyy" },
    { header: "Trạng thái đơn", key: "status", width: 14 },
    { header: "Mã SP", key: "sku", width: 12 },
    { header: "Tên SP", key: "name", width: 30 },
    { header: "SL đặt", key: "qty", width: 8 },
    { header: "Lấy từ kho", key: "fromStock", width: 10 },
    { header: "Cần làm", key: "toMake", width: 9 },
    { header: "Đã làm", key: "made", width: 8 },
    { header: "Đơn giá (đ)", key: "price", width: 13, money: true },
    { header: "Thành tiền (đ)", key: "amount", width: 14, money: true },
    { header: "Giá vốn (đ)", key: "cost", width: 12, money: true },
  ]);
  for (const o of orders) {
    for (const it of o.items) {
      ds.addRow({
        code: o.code,
        deliveryDate: o.deliveryDate,
        status: ORDER_STATUS_LABELS[o.status],
        sku: it.productCodeSnapshot ?? "Dòng tự do",
        name: safeText(it.nameSnapshot),
        qty: it.qtyOrdered,
        fromStock: it.qtyFromStock,
        toMake: it.qtyToMake,
        made: it.qtyMade,
        price: it.unitPriceSnapshot,
        amount: it.unitPriceSnapshot * it.qtyOrdered,
        cost: it.unitCostSnapshot,
      });
    }
  }
  finish(ds);

  // --- Khách hàng (khách có đơn trong bộ lọc)
  const customerIds = [...new Set(orders.map((o) => o.customerId))];
  const allTime = customerIds.length
    ? await prisma.order.groupBy({
        by: ["customerId"],
        where: { customerId: { in: customerIds }, status: "COMPLETED" },
        _count: { _all: true },
        _sum: { total: true },
        _max: { completedAt: true },
      })
    : [];
  const statMap = new Map(allTime.map((g) => [g.customerId, g]));
  const cs = sheet(wb, "Khách hàng", [
    { header: "Tên", key: "name", width: 24 },
    { header: "SĐT", key: "phone", width: 14 },
    { header: "Email", key: "email", width: 24 },
    { header: "Địa chỉ", key: "address", width: 34 },
    { header: "Số đơn trong kỳ", key: "inRange", width: 12 },
    { header: "Số đơn hoàn thành (tất cả)", key: "count", width: 14 },
    { header: "Tổng tiền đã mua (đ)", key: "spent", width: 16, money: true },
    { header: "Ngày mua gần nhất", key: "last", width: 16, date: "dd/mm/yyyy" },
    { header: "Ghi chú", key: "note", width: 30 },
  ]);
  const seen = new Set<string>();
  for (const o of orders) {
    if (seen.has(o.customerId)) continue;
    seen.add(o.customerId);
    const st = statMap.get(o.customerId);
    cs.addRow({
      name: safeText(o.customer.name),
      phone: formatPhone(o.customer.phone),
      email: safeText(o.customer.email),
      address: safeText(o.customer.address),
      inRange: orders.filter((x) => x.customerId === o.customerId).length,
      count: st?._count._all ?? 0,
      spent: st?._sum.total ?? 0,
      last: vnTime(st?._max.completedAt ?? null),
      note: safeText(o.customer.note),
    });
  }
  finish(cs);

  // --- Sản phẩm và tồn kho
  const products = await prisma.product.findMany({
    where: {
      status: { not: "ARCHIVED" },
      ...(f.productId ? { id: f.productId } : {}),
      ...(f.categoryId ? { categoryId: f.categoryId } : {}),
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { code: "asc" }],
    include: { category: { select: { name: true } } },
  });
  const ps = sheet(wb, "Sản phẩm và tồn kho", [
    { header: "Mã", key: "code", width: 12 },
    { header: "Tên", key: "name", width: 30 },
    { header: "Danh mục", key: "category", width: 16 },
    { header: "Phương thức", key: "mode", width: 14 },
    { header: "Giá bán (đ)", key: "price", width: 13, money: true },
    { header: "Giá vốn (đ)", key: "cost", width: 12, money: true },
    { header: "Đang có", key: "onHand", width: 9 },
    { header: "Đã giữ", key: "reserved", width: 9 },
    { header: "Sẵn sàng bán", key: "available", width: 12 },
    { header: "Trạng thái", key: "status", width: 12 },
  ]);
  for (const p of products) {
    ps.addRow({
      code: p.code,
      name: safeText(p.name),
      category: safeText(p.category.name),
      mode: FULFILLMENT_LABELS[p.fulfillmentMode],
      price: p.price,
      cost: p.costPrice,
      onHand: p.onHand,
      reserved: p.reserved,
      available: p.onHand - p.reserved,
      status: PRODUCT_STATUS_LABELS[p.status],
    });
  }
  finish(ps);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
