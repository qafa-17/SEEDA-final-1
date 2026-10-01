"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireApprover } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type TeamActionState = { message?: string; ok?: boolean };

const memberChange = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("access"), userId: z.uuid(), value: z.enum(["active", "disabled"]) }),
  z.object({ kind: z.literal("role"), userId: z.uuid(), value: z.enum(["publisher", "approver"]) }),
]);

// One action for every button on the Team page. The database functions
// re-check that the caller is an approver and not changing themselves,
// so this cannot be bypassed by calling the action with crafted data.
export async function changeMember(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const me = await requireApprover();
  const parsed = memberChange.safeParse({
    kind: formData.get("kind"),
    userId: formData.get("userId"),
    value: formData.get("value"),
  });
  if (!parsed.success) return { message: "That request wasn't valid. Refresh and try again." };
  if (parsed.data.userId === me.id) return { message: "You can't change your own access or role." };

  const supabase = await createClient();
  const { error } =
    parsed.data.kind === "access"
      ? await supabase.rpc("set_member_access", { p_user: parsed.data.userId, p_access: parsed.data.value })
      : await supabase.rpc("set_member_role", { p_user: parsed.data.userId, p_role: parsed.data.value });

  if (error) {
    return {
      message:
        error.code === "42501"
          ? "You don't have permission to do that."
          : error.code === "P0002"
            ? "That person no longer exists."
            : "Couldn't save the change. Please try again.",
    };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
