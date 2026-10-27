/**
 * One-off import of the old static catalog (legacy/index.html + legacy/images) into the database.
 * The old data has no names or prices: products get placeholder names ("Hoa bó 01") and price = null
 * ("Liên hệ báo giá"), visible on the website. Re-running skips products whose code already exists.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/server/db/prisma";
import { storage } from "../src/server/storage";
import { processImage } from "../src/server/services/images.service";

const LEGACY = path.resolve(process.cwd(), "legacy");
const CATEGORY_MAP: Record<string, { name: string; prefix: string }> = {
  bo: { name: "Hoa bó", prefix: "BO" },
  hop: { name: "Hoa hộp", prefix: "HOP" },
  gio: { name: "Hoa giỏ", prefix: "GIO" },
  longden: { name: "Hoa lồng đèn", prefix: "LD" },
};

interface LegacyProduct {
  category: string;
  images: string[];
}

function parseLegacy(html: string): LegacyProduct[] {
  const block = html.match(/const PRODUCTS = \[([\s\S]*?)\n\];/);
  if (!block) throw new Error("PRODUCTS array not found in legacy/index.html");
  const out: LegacyProduct[] = [];
  const re = /\{\s*category:\s*'([a-z]+)',\s*images:\s*\[([^\]]*)\]/g;
  for (const m of block[1].matchAll(re)) {
    const images = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    out.push({ category: m[1], images });
  }
  return out;
}

async function main() {
  const legacy = parseLegacy(await readFile(path.join(LEGACY, "index.html"), "utf8"));
  const counters: Record<string, number> = {};
  const report = { created: 0, skipped: 0, images: 0, problems: [] as string[] };

  for (const item of legacy) {
    const cat = CATEGORY_MAP[item.category];
    if (!cat) {
      report.problems.push(`Bỏ qua: danh mục lạ "${item.category}"`);
      continue;
    }
    counters[item.category] = (counters[item.category] ?? 0) + 1;
    const n = counters[item.category];
    const code = `${cat.prefix}-${String(n).padStart(3, "0")}`;
    if (await prisma.product.findUnique({ where: { code } })) {
      report.skipped += 1;
      continue;
    }
    const category = await prisma.category.upsert({ where: { name: cat.name }, update: {}, create: { name: cat.name, codePrefix: cat.prefix } });
    const product = await prisma.product.create({
      data: {
        code,
        name: `${cat.name} ${String(n).padStart(2, "0")}`,
        categoryId: category.id,
        price: null,
        isVisible: true,
      },
    });
    for (const [i, rel] of item.images.entries()) {
      try {
        const webp = await processImage(await readFile(path.join(LEGACY, rel)));
        const key = `products/${product.id}/${randomUUID()}.webp`;
        const { url } = await storage().put(key, webp, "image/webp");
        await prisma.productImage.create({ data: { productId: product.id, storagePath: key, url, sortOrder: i, isPrimary: i === 0 } });
        report.images += 1;
      } catch (e) {
        report.problems.push(`${code}: không đọc được ảnh ${rel} (${(e as Error).message})`);
      }
    }
    report.created += 1;
  }

  console.log(`Sản phẩm mới: ${report.created}, bỏ qua (đã có): ${report.skipped}, ảnh: ${report.images}`);
  for (const p of report.problems) console.log(`- ${p}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
