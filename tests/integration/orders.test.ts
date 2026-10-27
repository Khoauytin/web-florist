import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import {
  addPayment,
  cancelOrder,
  completeOrder,
  confirmOrder,
  createOrder,
  failDelivery,
  getOrder,
  retryDelivery,
  setMade,
  startDelivery,
  unconfirmOrder,
  updateOrderFull,
  updateOrderLogistics,
  voidPayment,
} from "@/server/services/orders.service";
import { adjustStock, produceStock } from "@/server/services/inventory.service";
import { updateProduct } from "@/server/services/catalog.service";
import { expectLedgerMatches, makeProduct, makeUser, orderInput, resetDb, stockOf } from "./helpers";

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
});

async function itemsOf(orderId: string) {
  return prisma.orderItem.findMany({ where: { orderId }, orderBy: { sortOrder: "asc" } });
}

describe("confirming orders allocates stock first", () => {
  it("20 ordered, 3 in stock: holds 3 and makes 17", async () => {
    const owner = await makeUser("owner");
    const red = await makeProduct(owner, { onHand: 3, name: "Bó hoa sáp đỏ" });
    const { id } = await createOrder(owner, orderInput([{ productId: red.id, qty: 20 }]));
    await confirmOrder(owner, id);
    const [item] = await itemsOf(id);
    expect(item).toMatchObject({ qtyFromStock: 3, qtyToMake: 17, qtyMade: 0, stockState: "RESERVED" });
    expect(await stockOf(red.id)).toEqual({ onHand: 3, reserved: 3 });
    expect((await expectLedgerMatches(red.id)).ok).toBe(true);
  });

  it("10 ordered, nothing in stock: makes 10 and stock stays at zero", async () => {
    const owner = await makeUser("owner");
    const red = await makeProduct(owner, { onHand: 0 });
    const { id } = await createOrder(owner, orderInput([{ productId: red.id, qty: 10 }]));
    await confirmOrder(owner, id);
    const [item] = await itemsOf(id);
    expect(item).toMatchObject({ qtyFromStock: 0, qtyToMake: 10, stockState: "NONE" });
    expect(await stockOf(red.id)).toEqual({ onHand: 0, reserved: 0 });
  });

  it("stock-only product without enough stock cannot be confirmed and nothing changes", async () => {
    const owner = await makeUser("owner");
    const box = await makeProduct(owner, { mode: "STOCK_ONLY", onHand: 2, name: "Hộp hoa hồng" });
    const { id } = await createOrder(owner, orderInput([{ productId: box.id, qty: 3 }]));
    await expect(confirmOrder(owner, id)).rejects.toThrow(/Hộp hoa hồng: cần 3, còn 2/);
    expect((await prisma.order.findUniqueOrThrow({ where: { id } })).status).toBe("NEW");
    expect(await stockOf(box.id)).toEqual({ onHand: 2, reserved: 0 });
  });

  it("confirming twice is rejected (stock is held once)", async () => {
    const owner = await makeUser("owner");
    const red = await makeProduct(owner, { onHand: 5 });
    const { id } = await createOrder(owner, orderInput([{ productId: red.id, qty: 2 }]));
    await confirmOrder(owner, id);
    await expect(confirmOrder(owner, id)).rejects.toThrow();
    expect(await stockOf(red.id)).toEqual({ onHand: 5, reserved: 2 });
  });

  it("two people confirming orders that compete for the same stock never oversell", async () => {
    const owner = await makeUser("owner");
    const staff = await makeUser("staff");
    const box = await makeProduct(owner, { mode: "STOCK_ONLY", onHand: 3 });
    const a = await createOrder(owner, orderInput([{ productId: box.id, qty: 3 }]));
    const b = await createOrder(staff, orderInput([{ productId: box.id, qty: 3 }], { customerPhone: "0912345678", customerName: "Nguyễn Thu Hà" }));
    const results = await Promise.allSettled([confirmOrder(owner, a.id), confirmOrder(staff, b.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await stockOf(box.id)).toEqual({ onHand: 3, reserved: 3 });
    expect((await expectLedgerMatches(box.id)).ok).toBe(true);
  });

  it("flexible orders competing for stock split it without going negative", async () => {
    const owner = await makeUser("owner");
    const red = await makeProduct(owner, { onHand: 4 });
    const a = await createOrder(owner, orderInput([{ productId: red.id, qty: 3 }]));
    const b = await createOrder(owner, orderInput([{ productId: red.id, qty: 3 }]));
    await Promise.all([confirmOrder(owner, a.id), confirmOrder(owner, b.id)]);
    const fromStock = (await itemsOf(a.id))[0].qtyFromStock + (await itemsOf(b.id))[0].qtyFromStock;
    expect(fromStock).toBe(4);
    expect(await stockOf(red.id)).toEqual({ onHand: 4, reserved: 4 });
  });
});

describe("production, delivery and completion", () => {
  it("cannot start delivery until everything is made; completion consumes held stock", async () => {
    const owner = await makeUser("owner");
    const staff = await makeUser("staff");
    const red = await makeProduct(owner, { onHand: 3 });
    const { id } = await createOrder(staff, orderInput([{ productId: red.id, qty: 20 }]));
    await confirmOrder(staff, id);
    await expect(startDelivery(staff, id)).rejects.toThrow(/Còn 17/);
    const [item] = await itemsOf(id);
    await expect(setMade(staff, item.id, 18)).rejects.toThrow();
    await setMade(staff, item.id, 17);
    await startDelivery(staff, id);
    await completeOrder(staff, id);
    expect(await stockOf(red.id)).toEqual({ onHand: 0, reserved: 0 });
    expect((await itemsOf(id))[0].stockState).toBe("CONSUMED");
    expect((await expectLedgerMatches(red.id)).ok).toBe(true);
  });

  it("failed delivery keeps the hold; retry then cancel releases it", async () => {
    const owner = await makeUser("owner");
    const box = await makeProduct(owner, { mode: "STOCK_ONLY", onHand: 2 });
    const { id } = await createOrder(owner, orderInput([{ productId: box.id, qty: 1 }]));
    await confirmOrder(owner, id);
    await startDelivery(owner, id);
    await failDelivery(owner, id, "Người nhận vắng nhà");
    expect(await stockOf(box.id)).toEqual({ onHand: 2, reserved: 1 });
    await retryDelivery(owner, id);
    await failDelivery(owner, id, "Vẫn vắng nhà");
    await cancelOrder(owner, id, "Khách hủy");
    expect(await stockOf(box.id)).toEqual({ onHand: 2, reserved: 0 });
  });
});

describe("cancelling and unconfirming", () => {
  it("cancel after making: restock puts made items back into stock", async () => {
    const owner = await makeUser("owner");
    const red = await makeProduct(owner, { onHand: 3 });
    const { id } = await createOrder(owner, orderInput([{ productId: red.id, qty: 20 }]));
    await confirmOrder(owner, id);
    const [item] = await itemsOf(id);
    await setMade(owner, item.id, 12);
    await cancelOrder(owner, id, "Khách đổi ý", { [item.id]: "RESTOCK" });
    expect(await stockOf(red.id)).toEqual({ onHand: 15, reserved: 0 });
    expect((await itemsOf(id))[0].stockState).toBe("RELEASED");
    expect((await expectLedgerMatches(red.id)).ok).toBe(true);
  });

  it("cancel after making: write-off records the loss without adding stock", async () => {
    const owner = await makeUser("owner");
    const red = await makeProduct(owner, { onHand: 3 });
    const { id } = await createOrder(owner, orderInput([{ productId: red.id, qty: 5 }]));
    await confirmOrder(owner, id);
    const [item] = await itemsOf(id);
    await setMade(owner, item.id, 2);
    await expect(cancelOrder(owner, id, "Khách hủy", { [item.id]: "WRITE_OFF" })).rejects.toThrow(/lý do hư hao/);
    await cancelOrder(owner, id, "Khách hủy", { [item.id]: "WRITE_OFF" }, "Đã ghi tên khách lên thiệp");
    expect(await stockOf(red.id)).toEqual({ onHand: 3, reserved: 0 });
    const wo = await prisma.inventoryMovement.findFirst({ where: { productId: red.id, type: "WRITE_OFF" } });
    expect(wo).toMatchObject({ quantity: 2, deltaOnHand: 0, deltaReserved: 0 });
  });

  it("requires a decision for made items and refuses restocking made-to-order products", async () => {
    const owner = await makeUser("owner");
    const basket = await makeProduct(owner, { mode: "MADE_TO_ORDER" });
    const { id } = await createOrder(owner, orderInput([{ productId: basket.id, qty: 2 }]));
    await confirmOrder(owner, id);
    const [item] = await itemsOf(id);
    await setMade(owner, item.id, 1);
    await expect(cancelOrder(owner, id, "Hủy")).rejects.toThrow(/nhập kho hay hư hao/);
    await expect(cancelOrder(owner, id, "Hủy", { [item.id]: "RESTOCK" })).rejects.toThrow(/làm theo đơn/);
  });

  it("staff can cancel only new orders", async () => {
    const owner = await makeUser("owner");
    const staff = await makeUser("staff");
    const red = await makeProduct(owner, { onHand: 1 });
    const fresh = await createOrder(staff, orderInput([{ productId: red.id, qty: 1 }]));
    const confirmed = await createOrder(staff, orderInput([{ productId: red.id, qty: 1 }]));
    await confirmOrder(staff, confirmed.id);
    await cancelOrder(staff, fresh.id, "Khách hủy");
    await expect(cancelOrder(staff, confirmed.id, "Khách hủy")).rejects.toThrow();
  });

  it("unconfirm returns stock and resets the allocation so lines can be edited", async () => {
    const owner = await makeUser("owner");
    const red = await makeProduct(owner, { onHand: 3 });
    const { id } = await createOrder(owner, orderInput([{ productId: red.id, qty: 4 }]));
    await confirmOrder(owner, id);
    await unconfirmOrder(owner, id);
    expect(await stockOf(red.id)).toEqual({ onHand: 3, reserved: 0 });
    expect((await itemsOf(id))[0]).toMatchObject({ qtyFromStock: 0, qtyToMake: 0, allocatedAt: null, stockState: "NONE" });
    await updateOrderFull(owner, id, orderInput([{ productId: red.id, qty: 2 }]));
    await confirmOrder(owner, id);
    expect((await itemsOf(id))[0]).toMatchObject({ qtyFromStock: 2, qtyToMake: 0 });
  });
});

describe("orders keep their snapshot and money stays consistent", () => {
  it("old orders keep the name and price at order time", async () => {
    const owner = await makeUser("owner");
    const red = await makeProduct(owner, { price: 350000, name: "Bó hoa sáp đỏ" });
    const { id } = await createOrder(owner, orderInput([{ productId: red.id, qty: 2 }, { name: "Thiệp viết tay", unitPrice: 20000, qty: 1 }]));
    const p = await prisma.product.findUniqueOrThrow({ where: { id: red.id } });
    await updateProduct(owner, red.id, {
      code: p.code,
      name: "Bó hoa sáp đỏ mẫu mới",
      categoryId: p.categoryId,
      price: 400000,
      costPrice: p.costPrice,
      fulfillmentMode: p.fulfillmentMode,
      status: p.status,
    });
    const order = await getOrder(id, { includeCost: true });
    expect(order?.items[0]).toMatchObject({ nameSnapshot: "Bó hoa sáp đỏ", unitPriceSnapshot: 350000 });
    expect(order?.total).toBe(720000);
  });

  it("editing a new order keeps existing line prices and lets hidden products stay on the order", async () => {
    const owner = await makeUser("owner");
    const red = await makeProduct(owner, { price: 350000, name: "Bó hoa sáp đỏ" });
    const blue = await makeProduct(owner, { price: 420000, name: "Bó cẩm tú cầu" });
    const { id } = await createOrder(owner, orderInput([{ productId: red.id, qty: 2 }]));
    const [line] = await itemsOf(id);
    await prisma.product.update({ where: { id: red.id }, data: { price: 400000, status: "HIDDEN" } });
    await updateOrderFull(owner, id, orderInput([
      { id: line.id, productId: red.id, qty: 3 },
      { productId: blue.id, qty: 1 },
    ]));
    const items = await itemsOf(id);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: line.id, unitPriceSnapshot: 350000, qtyOrdered: 3 });
    expect(items[1]).toMatchObject({ unitPriceSnapshot: 420000, qtyOrdered: 1 });
    expect((await prisma.order.findUniqueOrThrow({ where: { id } })).total).toBe(3 * 350000 + 420000);
    // a newly added hidden product is still refused
    await expect(updateOrderFull(owner, id, orderInput([{ productId: red.id, qty: 1 }]))).rejects.toThrow(/đang không bán/);
  });

  it("logistics edit of a confirmed order cannot drop the delivery date or address", async () => {
    const owner = await makeUser("owner");
    const red = await makeProduct(owner, { onHand: 1 });
    const { id } = await createOrder(owner, orderInput([{ productId: red.id, qty: 1 }]));
    await confirmOrder(owner, id);
    const base = { recipientName: "Phạm Minh Châu", recipientPhone: "0988123456", receiveType: "DELIVERY" as const, deliveryAddress: "Đống Đa", deliveryDate: null };
    await expect(updateOrderLogistics(owner, id, base)).rejects.toThrow(/ngày giao/);
    await expect(updateOrderLogistics(owner, id, { ...base, deliveryDate: "2026-11-01", deliveryAddress: "" })).rejects.toThrow(/địa chỉ/);
    await updateOrderLogistics(owner, id, { ...base, deliveryDate: "2026-11-01" });
    expect(await prisma.order.findUniqueOrThrow({ where: { id } })).toMatchObject({ recipientName: "Phạm Minh Châu", recipientPhone: "0988123456" });
  });

  it("voiding the same payment twice at once only voids it once", async () => {
    const owner = await makeUser("owner");
    const red = await makeProduct(owner, { price: 500000 });
    const { id } = await createOrder(owner, orderInput([{ productId: red.id, qty: 1 }], { deposit: { amount: 200000, method: "CASH" } }));
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: id } });
    const results = await Promise.allSettled([voidPayment(owner, payment.id, "Nhầm"), voidPayment(owner, payment.id, "Nhầm")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { action: "payment.void" } })).toBe(1);
  });

  it("strips cost snapshots for staff readers", async () => {
    const owner = await makeUser("owner");
    const red = await makeProduct(owner);
    const { id } = await createOrder(owner, orderInput([{ productId: red.id, qty: 1 }]));
    expect((await getOrder(id, { includeCost: false }))?.items[0].unitCostSnapshot).toBeNull();
    expect((await getOrder(id, { includeCost: true }))?.items[0].unitCostSnapshot).toBe(180000);
  });

  it("reuses the customer found by phone instead of creating a duplicate", async () => {
    const owner = await makeUser("owner");
    const red = await makeProduct(owner);
    await createOrder(owner, orderInput([{ productId: red.id, qty: 1 }], { customerPhone: "+84 935 662 019" }));
    await createOrder(owner, orderInput([{ productId: red.id, qty: 1 }], { customerPhone: "0935.662.019" }));
    expect(await prisma.customer.count()).toBe(1);
  });

  it("issues unique order codes when created at the same time", async () => {
    const owner = await makeUser("owner");
    const red = await makeProduct(owner);
    const created = await Promise.all(Array.from({ length: 6 }, () => createOrder(owner, orderInput([{ productId: red.id, qty: 1 }]))));
    expect(new Set(created.map((c) => c.code)).size).toBe(6);
  });

  it("validates deposits, payments, refunds and voids", async () => {
    const owner = await makeUser("owner");
    const staff = await makeUser("staff");
    const red = await makeProduct(owner, { price: 500000 });
    await expect(createOrder(staff, orderInput([{ productId: red.id, qty: 1 }], { deposit: { amount: 600000, method: "CASH" } }))).rejects.toThrow(/cọc/);
    const { id } = await createOrder(staff, orderInput([{ productId: red.id, qty: 1 }], { deposit: { amount: 200000, method: "BANK_TRANSFER" } }));
    await expect(addPayment(staff, id, { type: "PAYMENT", amount: 400000, method: "CASH" })).rejects.toThrow(/vượt quá/);
    await addPayment(staff, id, { type: "PAYMENT", amount: 300000, method: "CASH" });
    expect((await getOrder(id, { includeCost: true }))?.payState).toBe("PAID");
    await expect(addPayment(staff, id, { type: "REFUND", amount: 100000, method: "CASH" })).rejects.toThrow(/chủ shop/);
    await addPayment(owner, id, { type: "REFUND", amount: 100000, method: "CASH" });
    const order = await getOrder(id, { includeCost: true });
    expect(order?.paid).toBe(400000);
    await voidPayment(owner, order!.payments[2].id, "Nhập nhầm");
    expect((await getOrder(id, { includeCost: true }))?.paid).toBe(500000);
  });
});

describe("stock adjustments", () => {
  it("adjust cannot drop below what is held for orders; staff cannot adjust", async () => {
    const owner = await makeUser("owner");
    const staff = await makeUser("staff");
    const red = await makeProduct(owner, { onHand: 5 });
    const { id } = await createOrder(owner, orderInput([{ productId: red.id, qty: 4 }]));
    await confirmOrder(owner, id);
    await expect(adjustStock(owner, red.id, -2, "Kiểm kê")).rejects.toThrow(/đang giữ/);
    await expect(adjustStock(staff, red.id, 1, "x")).rejects.toThrow();
    await adjustStock(owner, red.id, -1, "Kiểm kê thiếu 1");
    await produceStock(staff, red.id, 3, "Làm buổi chiều");
    expect(await stockOf(red.id)).toEqual({ onHand: 7, reserved: 4 });
    expect((await expectLedgerMatches(red.id)).ok).toBe(true);
  });
});
