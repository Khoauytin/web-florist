"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { Icon } from "@/components/icon";
import { toast } from "@/components/ui";
import { removeImageAction, setPrimaryImageAction, uploadImageAction } from "@/server/actions/catalog.actions";

/** Downscale in the browser so phone photos upload fast and stay under the request limit. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.88));
}

export function ImageManager({ productId, images }: { productId: string; images: { id: string; url: string; isPrimary: boolean }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    start(async () => {
      for (const file of Array.from(files)) {
        let blob: Blob = file;
        try {
          blob = await shrink(file);
        } catch {
          /* keep original if the browser cannot decode it */
        }
        const fd = new FormData();
        fd.set("file", new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: blob.type || file.type }));
        const r = await uploadImageAction(productId, fd);
        toast(r.ok ? (r.message ?? "Đã thêm ảnh") : (r.error ?? "Không tải được ảnh"));
        if (!r.ok) break;
      }
      if (input.current) input.current.value = "";
      router.refresh();
    });
  };

  const act = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? "Đã lưu") : (r.error ?? "Có lỗi xảy ra"));
      router.refresh();
    });

  return (
    <div className="stack">
      {images.length ? (
        <div className="imggrid">
          {images.map((img) => (
            <figure key={img.id} className={img.isPrimary ? "primary" : undefined}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.isPrimary ? "Ảnh chính" : "Ảnh sản phẩm"} width={120} height={120} loading="lazy" />
              <figcaption>
                {img.isPrimary ? (
                  <span className="tag">Ảnh chính</span>
                ) : (
                  <button className="btn btn-ghost btn-sm" type="button" disabled={pending} onClick={() => act(() => setPrimaryImageAction(productId, img.id))}>
                    Đặt chính
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" type="button" disabled={pending} onClick={() => act(() => removeImageAction(productId, img.id))} aria-label="Xóa ảnh">
                  Xóa
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="small muted">Chưa có ảnh.</p>
      )}
      <div>
        <input ref={input} id="img-upload" type="file" accept="image/*" multiple className="sr" onChange={(e) => upload(e.target.files)} />
        <label htmlFor="img-upload" className="btn btn-secondary" aria-disabled={pending}>
          {pending ? <span className="spinner" aria-hidden="true" /> : <Icon name="image" />}
          {pending ? "Đang tải ảnh..." : "Thêm ảnh"}
        </label>
      </div>
    </div>
  );
}
