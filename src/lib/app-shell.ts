import "server-only";
import { headers } from "next/headers";

/**
 * Is this page open inside the SEEDA Android or iPhone app? The app adds
 * "SEEDAHubApp" to its browser name (capacitor.config.ts). Google and GitHub
 * refuse sign-in inside apps (error: disallowed_useragent), so those buttons
 * are hidden there and email sign-in is used instead.
 */
export async function isInApp(): Promise<boolean> {
  return ((await headers()).get("user-agent") ?? "").includes("SEEDAHubApp");
}
