import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const PROD_BASE_URL = "https://www.staturalabs.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
const COOKIE_NAME = `sb-${projectRef}-auth-token`;

const supabase = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
const { data, error } = await supabase.auth.signInWithPassword({
  email: "demo-admin@statura.local",
  password: "demo1234",
});
if (error) {
  console.log("Sign-in against this Supabase project FAILED:", error.message);
  process.exit(0);
}
console.log("Sign-in succeeded — this Supabase project has the demo-admin user.");

const encoded =
  "base64-" + Buffer.from(JSON.stringify(data.session), "utf8").toString("base64url");
const cookie = `${COOKIE_NAME}=${encoded}`;

const [, , path] = process.argv;
const res = await fetch(`${PROD_BASE_URL}${path}`, {
  headers: { cookie },
  redirect: "manual",
});
const body = await res.text();
console.log(`status: ${res.status}`);
console.log(body);
