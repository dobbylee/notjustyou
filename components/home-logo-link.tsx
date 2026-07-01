"use client";

import Image from "next/image";
import Link from "next/link";
import type { MouseEvent } from "react";

export function HomeLogoLink() {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (window.location.pathname !== "/") {
      return;
    }

    event.preventDefault();
    window.history.pushState(null, "", "/");
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <Link
      href="/"
      aria-label="Not Just You home"
      title="Not Just You"
      onClick={handleClick}
      className="inline-flex w-fit min-w-0 items-center gap-2 rounded-md text-slate-900 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25"
    >
      <Image
        src="/logo.png"
        alt=""
        width={40}
        height={40}
        priority
        className="h-10 w-10 shrink-0"
      />
      <span className="hidden truncate text-lg font-extrabold sm:inline text-slate-800">
        Not Just You
      </span>
    </Link>
  );
}
