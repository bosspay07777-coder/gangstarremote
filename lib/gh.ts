import { decrypt } from "./crypto";
export async function getGhToken(sb: any, userId: string): Promise<string | null> {
  const { data } = await sb.from("integrations").select("config").eq("user_id", userId).eq("provider", "github").single();
  if (data?.config?.token) return decrypt(data.config.token);
  return process.env.GITHUB_TOKEN || null;
}
