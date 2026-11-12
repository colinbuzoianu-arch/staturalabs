import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getMarketingDictionary } from "@/lib/i18n/dictionaries/marketing";
import { getLocale } from "@/lib/i18n/get-locale";
import { PILOT_MAILTO } from "./constants";

export async function MarketingHeader() {
  const locale = await getLocale();
  const dict = getMarketingDictionary(locale);

  return (
    <header className="sticky top-0 z-50 border-b border-sage-dark/30 bg-teal text-ivory">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 min-[860px]:gap-4 min-[860px]:px-6 min-[860px]:py-4">
        <Link href="/" className="flex items-center gap-2 min-[860px]:gap-3">
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

        <div className="flex items-center gap-2.5 min-[860px]:gap-5">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="whitespace-nowrap font-heading text-xs font-bold text-ivory transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral min-[860px]:text-sm"
          >
            {dict.header.signIn}
          </Link>
          <a
            href={PILOT_MAILTO}
            className="whitespace-nowrap rounded-md bg-coral px-3 py-1.5 font-heading text-xs font-bold text-teal transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral min-[860px]:px-4 min-[860px]:py-2 min-[860px]:text-sm"
          >
            {dict.header.requestPilot}
          </a>
        </div>
      </div>
    </header>
  );
}
