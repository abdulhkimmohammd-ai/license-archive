import { readFileSync } from "node:fs";

const tokenOutput = readFileSync("/tmp/license_archive_test_session.txt", "utf8").trim().split("\n");
const sessionToken = tokenOutput[tokenOutput.length - 1];
if (!sessionToken || sessionToken.length < 20) throw new Error("test session missing");

const endpoint = "http://localhost:3000/api/trpc";
const query = async (path, cookie) => {
  const response = await fetch(`${endpoint}/${path}?input=${encodeURIComponent(JSON.stringify({ json: null }))}`, { headers: { cookie } });
  return { response, body: await response.json() };
};

const sessionCookie = `app_session_id=${sessionToken}`;
const before = await query("auth.me", sessionCookie);
if (!before.response.ok || !before.body?.result?.data?.json) throw new Error(`authenticated session was not accepted: ${before.response.status} ${JSON.stringify(before.body)}`);

const logoutResponse = await fetch(`${endpoint}/auth.logout?batch=1`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: sessionCookie },
  body: JSON.stringify({ "0": { json: null } }),
});
if (!logoutResponse.ok) throw new Error(`logout request failed with ${logoutResponse.status}`);
const clearedCookie = logoutResponse.headers.get("set-cookie")?.split(";")[0] || "";
if (!clearedCookie.includes("app_session_id=")) throw new Error("logout did not clear the session cookie");

const after = await query("auth.me", clearedCookie);
if (!after.response.ok || after.body?.result?.data?.json !== null) throw new Error("protected session remained active after logout");

const protectedList = await fetch(`${endpoint}/licenses.list?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`, {
  headers: { cookie: clearedCookie },
});
const protectedListBody = await protectedList.json();
if (!protectedListBody?.error) throw new Error("license list remained accessible after logout");

console.log("logout-flow: PASS");
