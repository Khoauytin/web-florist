"use client";

import { useRouter } from "next/navigation";

export function RangeSelect({ value, status }: { value: string; status: string }) {
  const router = useRouter();
  return (
    <>
      <label className="sr" htmlFor="range">
        Khoảng thời gian
      </label>
      <select
        className="select"
        id="range"
        value={value}
        onChange={(e) => router.push(`/admin?${new URLSearchParams({ ...(e.target.value !== "week" ? { range: e.target.value } : {}), status })}`)}
      >
        <option value="week">Tuần này</option>
        <option value="month">Tháng này</option>
        <option value="all">Tất cả</option>
      </select>
    </>
  );
}
