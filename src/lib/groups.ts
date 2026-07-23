import { ProfileRow } from "./types";

type ProfileGroups = Pick<ProfileRow, "group_id" | "group_ids">;

export function normalizeGroupIds(groupIds: string[]): string[] {
  return [...new Set(groupIds.filter(Boolean))];
}

export function groupIdsForProfile(profile: ProfileGroups): string[] {
  if (profile.group_ids !== undefined) return normalizeGroupIds(profile.group_ids);
  return profile.group_id ? [profile.group_id] : [];
}

export function profileIsInGroup(profile: ProfileGroups, groupId: string): boolean {
  return groupIdsForProfile(profile).includes(groupId);
}
