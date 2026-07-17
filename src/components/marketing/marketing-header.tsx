import Image from "next/image";
import Link from "next/link";
import { PILOT_MAILTO } from "./constants";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-sage-dark/30 bg-teal">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo/statura_logo_on_dark.svg"
            alt="Statura Labs Dynamics"
            width={38}
            height={38}
            unoptimized
            priority
            className="size-[38px] shrink-0"
          />
          {/* Badge-only below the responsive floor — see constants.ts. */}
          <span className="hidden min-[860px]:inline font-wordmark text-sm tracking-[0.15em] text-ivory">
            STATURA LABS DYNAMICS
          </span>
        </Link>

        <a
          href={PILOT_MAILTO}
          className="rounded-md bg-coral px-4 py-2 font-heading text-sm font-bold text-teal transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
        >
          Request a pilot
        </a>
      </div>
    </header>
  );
}
