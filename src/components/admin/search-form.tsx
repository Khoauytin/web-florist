"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/admin/icon";

/** Search box that writes ?q= and keeps the other filters. Re-mounts when the URL value changes. */
export function SearchForm(props: { value: string; placeholder: string; label: string }) {
  return <Inner key={props.value} {...props} />;
}

function Inner({ value, placeholder, label }: { value: string; placeholder: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(value);
  return (
    <form
      role="search"
      className="search"
      onSubmit={(e) => {
        e.preventDefault();
        const next = new URLSearchParams(params.toString());
        if (q.trim()) next.set("q", q.trim());
        else next.delete("q");
        const s = next.toString();
        router.push(s ? `${pathname}?${s}` : pathname);
      }}
    >
      <Icon name="search" />
      <label className="sr" htmlFor="search-q">
        {label}
      </label>
      <input id="search-q" className="input" type="search" inputMode="search" enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
    </form>
  );
}
