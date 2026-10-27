import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db/prisma";
import {
  archiveProduct,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  previewProductCode,
  publicCatalog,
  quickUpdate,
  searchOrderableProducts,
  setCategoryVisible,
  setProductVisible,
  updateCategory,
  updateProduct,
} from "@/server/services/catalog.service";
import { createOrder } from "@/server/services/orders.service";
import { updateShopSettings } from "@/server/services/settings.service";
import { readLocal, storage } from "@/server/storage";
import { makeCategory, makeProduct, orderInput, resetDb } from "./helpers";

afterAll(() => prisma.$disconnect());
beforeEach(() => resetDb());

const base = { price: 300000, isVisible: true };

describe("automatic product codes", () => {
  it("continues after the highest imported code of the prefix", async () => {
    const bo = await makeCategory("Hoa bó", "BO");
    await makeProduct(bo.id, { code: "BO-054" });
    await makeProduct(bo.id, { code: "BO-007" });
    expect(await previewProductCode(bo.id)).toBe("BO-055");
    const p = await createProduct({ ...base, name: "Bó mới", categoryId: bo.id });
    expect(p.code).toBe("BO-055");
    expect((await createProduct({ ...base, name: "Bó mới 2", categoryId: bo.id })).code).toBe("BO-056");
  });

  it("never hands out the same code to products created at the same time", async () => {
    const bo = await makeCategory("Hoa bó", "BO");
    const created = await Promise.all(Array.from({ length: 8 }, (_, i) => createProduct({ ...base, name: `Mẫu ${i}`, categoryId: bo.id })));
    expect(new Set(created.map((p) => p.code)).size).toBe(8);
  });

  it("keeps the code when the product moves to another category, and new prefixes apply only to new products", async () => {
    const bo = await makeCategory("Hoa bó", "BO");
    const hop = await makeCategory("Hoa hộp", "HOP");
    const p = await createProduct({ ...base, name: "Bó", categoryId: bo.id });
    const moved = await updateProduct(p.id, { ...base, name: "Bó", categoryId: hop.id });
    expect(moved.code).toBe("BO-001");
    await updateCategory(bo.id, { name: "Hoa bó", codePrefix: "BOQ", isVisible: true });
    expect((await createProduct({ ...base, name: "Bó 2", categoryId: bo.id })).code).toBe("BOQ-001");
  });

  it("validates category prefixes and keeps them unique", async () => {
    await createCategory({ name: "Hoa cưới", codePrefix: "hc" });
    await expect(createCategory({ name: "Hoa chậu", codePrefix: "HC" })).rejects.toThrow(/Tiền tố HC/);
    await expect(createCategory({ name: "Hoa khác", codePrefix: "H-1" })).rejects.toThrow();
  });
});

describe("visibility on the public site", () => {
  it("hides hidden products, hidden categories and empty categories", async () => {
    const bo = await makeCategory("Hoa bó", "BO");
    const gio = await makeCategory("Hoa giỏ", "GIO");
    const ld = await makeCategory("Hoa lồng đèn", "LD");
    const a = await makeProduct(bo.id, { name: "Hiện" });
    const b = await makeProduct(bo.id, { name: "Ẩn" });
    await makeProduct(gio.id, { name: "Trong danh mục ẩn" });
    await setProductVisible(b.id, false);
    await setCategoryVisible(gio.id, false);
    const cat = await publicCatalog();
    expect(cat.map((c) => c.name)).toEqual(["Hoa bó"]);
    expect(cat[0].products.map((p) => p.id)).toEqual([a.id]);
    expect(ld.id).toBeTruthy();
  });

  it("filters order products by category while keeping hidden and unpriced products selectable", async () => {
    const bo = await makeCategory("Hoa bó", "BO");
    const hop = await makeCategory("Hoa hộp", "HOP");
    const visible = await makeProduct(bo.id, { name: "Bó pastel" });
    const hidden = await makeProduct(bo.id, { name: "Bó đang ẩn", isVisible: false, price: null });
    await makeProduct(hop.id, { name: "Hộp hoa" });

    const rows = await searchOrderableProducts("", { categoryId: bo.id });

    expect(rows.map((p) => p.id)).toEqual([visible.id, hidden.id]);
    expect(rows[1].price).toBeNull();
  });

  it("quick edit saves names, prices and visibility together", async () => {
    const bo = await makeCategory();
    const p = await makeProduct(bo.id, { price: null, name: "Hoa bó 01" });
    await quickUpdate([{ id: p.id, name: "Bó hồng pastel", price: 350000, isVisible: false }]);
    expect(await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ name: "Bó hồng pastel", price: 350000, isVisible: false });
    await expect(quickUpdate([{ id: p.id, name: " ", price: 1, isVisible: true }])).rejects.toThrow();
  });

  it("keeps archiving separate from permanent deletion", async () => {
    const category = await makeCategory();
    const product = await makeProduct(category.id);

    await archiveProduct(product.id);

    expect(await prisma.product.findUnique({ where: { id: product.id } })).toMatchObject({ isArchived: true, isVisible: false });
    expect(await searchOrderableProducts(product.code)).toEqual([]);
    expect((await publicCatalog()).flatMap((c) => c.products).map((p) => p.id)).not.toContain(product.id);
  });
});

describe("hard delete catalog data", () => {
  it("deletes an unused product together with its image rows and stored files", async () => {
    const category = await makeCategory();
    const product = await makeProduct(category.id, { isVisible: false });
    const storagePath = `products/${product.id}/delete-test.webp`;
    const { url } = await storage().put(storagePath, Buffer.from("test image"), "image/webp");
    const image = await prisma.productImage.create({ data: { productId: product.id, storagePath, url, isPrimary: true } });

    try {
      await deleteProduct(product.id);

      expect(await prisma.product.findUnique({ where: { id: product.id } })).toBeNull();
      expect(await prisma.productImage.findUnique({ where: { id: image.id } })).toBeNull();
      await expect(readLocal(storagePath)).rejects.toThrow();
    } finally {
      await storage().remove(storagePath);
    }
  });

  it("keeps product data available for retry when stored files cannot be removed", async () => {
    const category = await makeCategory();
    const product = await makeProduct(category.id, { isVisible: false });
    const storagePath = `products/${product.id}/retry-delete.webp`;
    const image = await prisma.productImage.create({ data: { productId: product.id, storagePath, url: `/api/files/${storagePath}`, isPrimary: true } });
    const remove = vi.spyOn(storage(), "remove").mockRejectedValueOnce(new Error("Storage unavailable"));

    try {
      await expect(deleteProduct(product.id)).rejects.toThrow("Storage unavailable");
      expect(await prisma.product.findUnique({ where: { id: product.id } })).not.toBeNull();
      expect(await prisma.productImage.findUnique({ where: { id: image.id } })).not.toBeNull();
    } finally {
      remove.mockRestore();
    }
  });

  it("keeps products used by orders and categories that still contain products", async () => {
    const category = await makeCategory();
    const product = await makeProduct(category.id);
    await createOrder(orderInput([{ productId: product.id, qty: 1 }]));

    await expect(deleteProduct(product.id)).rejects.toThrow(/đã có trong đơn hàng/);
    await expect(deleteCategory(category.id)).rejects.toThrow(/còn 1 sản phẩm/);
  });

  it("deletes an empty category", async () => {
    const category = await makeCategory();
    await deleteCategory(category.id);
    expect(await prisma.category.findUnique({ where: { id: category.id } })).toBeNull();
  });

  it("keeps a category that contains only archived products", async () => {
    const category = await makeCategory();
    const product = await makeProduct(category.id);
    await prisma.product.update({ where: { id: product.id }, data: { isArchived: true } });

    await expect(deleteCategory(category.id)).rejects.toThrow(/còn 1 sản phẩm/);
    expect(await prisma.category.findUnique({ where: { id: category.id } })).not.toBeNull();
  });
});

describe("shop settings", () => {
  it("accepts proper links and normalizes phones, rejects links to the wrong site", async () => {
    const s = await updateShopSettings({ shopName: "Bích Ngọc Florist", phone: "+84 912 345 678", zaloPhone: "0912345678", facebookUrl: "https://www.facebook.com/BichNgocFlorist", tiktokUrl: "https://www.tiktok.com/@bichngoc" });
    expect(s).toMatchObject({ phone: "0912345678", zaloPhone: "0912345678" });
    await expect(updateShopSettings({ shopName: "x", tiktokUrl: "https://evil.example.com/@x" })).rejects.toThrow();
    await expect(updateShopSettings({ shopName: "x", facebookUrl: "javascript:alert(1)" })).rejects.toThrow();
  });
});
