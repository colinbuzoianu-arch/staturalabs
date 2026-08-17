import { execFile } from "node:child_process";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";

// SLD_IMPLEMENTATION_PLAN_austria-first.md §7 B6: "npm run reset:demo
// reachable from the UI for super_admin only, so a failed demo is
// recoverable in one click instead of a terminal." Deliberately shells out
// to the exact same, already-verified scripts/{reset,seed}-demo-fixture.mjs
// a human would run from a terminal, rather than reimplementing their raw-
// SQL reset/seed logic (including the DEMO_MARKER safety guard) a second
// time inside the app — one source of truth for what "reset the demo"
// means, CLI and UI alike.
function runScript(scriptPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [scriptPath],
      { cwd: process.cwd(), timeout: 60_000 },
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve();
      },
    );
  });
}

export default async function DemoResetPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; message?: string }>;
}) {
  await requireSuperAdmin();
  const { status, message } = await searchParams;
  const locale = await getLocale();
  const dict = getAdminDictionary(locale).demoResetPage;

  async function resetDemoAction() {
    "use server";
    await requireSuperAdmin();

    try {
      await runScript("scripts/reset-demo-fixture.mjs");
      await runScript("scripts/seed-demo-fixture.mjs");
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error);
      redirect(
        `/admin/demo-reset?status=error&message=${encodeURIComponent(rawMessage.slice(0, 800))}`,
      );
    }
    redirect("/admin/demo-reset?status=success");
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{dict.heading}</h1>
      <p className="text-sm">{dict.description}</p>

      {status === "success" && (
        <p className="rounded border border-green-600 bg-green-50 p-2 text-sm text-green-800">
          {dict.successMessage}
        </p>
      )}
      {status === "error" && (
        <pre className="whitespace-pre-wrap rounded border border-red-400 bg-red-50 p-2 text-xs text-red-800">
          {message ?? dict.unknownError}
        </pre>
      )}

      <form action={resetDemoAction}>
        <button
          type="submit"
          className="self-start rounded bg-black px-3 py-1 text-white dark:bg-white dark:text-black"
        >
          {dict.resetButton}
        </button>
      </form>
    </div>
  );
}
