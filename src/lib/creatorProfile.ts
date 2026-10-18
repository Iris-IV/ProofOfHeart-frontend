import { z } from "zod";

export const MAX_BANNER_BYTES = 2 * 1024 * 1024;
export const BANNER_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PROFILE_LINKS = ["website", "twitter", "linkedin"] as const;

export function isSafeProfileLink(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

const link = z.string().trim().max(2048).refine(isSafeProfileLink);
const profileSchema = z.object({
  displayName: z.string().trim().max(80),
  banner: z
    .string()
    .max(2_800_000)
    .refine(
      (value) => value === "" || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value),
    ),
  links: z.object({ website: link, twitter: link, linkedin: link }),
});

export type CreatorProfile = z.infer<typeof profileSchema>;

export const EMPTY_CREATOR_PROFILE: CreatorProfile = {
  displayName: "",
  banner: "",
  links: { website: "", twitter: "", linkedin: "" },
};

export function creatorProfileKey(address: string): string {
  return `poh:creator-profile:v1:${address}`;
}

export function parseCreatorProfile(raw: string | null): CreatorProfile {
  try {
    const result = profileSchema.safeParse(JSON.parse(raw ?? "null"));
    return result.success ? result.data : EMPTY_CREATOR_PROFILE;
  } catch {
    return EMPTY_CREATOR_PROFILE;
  }
}

/** Local presentation preferences; never a source of verification or identity. */
export function saveCreatorProfile(address: string, profile: CreatorProfile): void {
  const validated = profileSchema.parse(profile);
  window.localStorage.setItem(creatorProfileKey(address), JSON.stringify(validated));
  window.dispatchEvent(new Event("poh:creator-profile-changed"));
}
