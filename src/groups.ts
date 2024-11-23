import fetch from "node-fetch";
import { makeCanvasRequest } from "./canvas";
import * as fs from "fs";
import { ByCanvasId, Student, StudentsByCanvasId } from "./students";
import { GROUP_CONFIG_FILE } from "./const";
import * as yaml from "yaml";

/**
 * Represents information about a group that is shared between
 * our local configuration and Canvas.
 */
export interface BaseGroup {
  id?: number;
  name: string;
}

/**
 * Represents information about a group returned by Canvas.
 */
export interface CanvasGroup extends BaseGroup {
  id: number;
  join_level: "parent_context_auto_join" | "invitation_only";
  group_category_id: number;
  members_count: number;
  context_type: string;
  course_id: number;
  role: string;
}

/** Represents information about a group stored in our configuration file. */
export interface GroupSpecification extends BaseGroup {
  // An array of SIS User IDs.
  members: string[];
}

/** Represents a mapping of groups by group category. */
export interface GroupsByCategory<T extends BaseGroup> {
  [index: number]: GroupsById<T>;
}

/** Represents a mapping of groups to their IDs. */
export interface GroupsById<T extends BaseGroup> {
  [index: number]: T;
}

/** Reads the local group configuration file. */
export async function readGroups(
  path: string = GROUP_CONFIG_FILE,
): Promise<GroupSpecification[]> {
  const groups: GroupSpecification[] = yaml.parse(
    fs.readFileSync(path, "utf-8"),
  );

  return groups;
}

/**
 * Writes the local group configuration file.
 *
 * @param path The path of the file to write.
 * @param groups The groups to write to the file.
 */
export async function writeGroups(
  path: string,
  groups: GroupSpecification[],
): Promise<void> {
  fs.writeFileSync(
    path,
    yaml.stringify(groups, {
      collectionStyle: "block",
      defaultStringType: "QUOTE_DOUBLE",
      defaultKeyType: "PLAIN",
    }),
  );
}

/**
 * Fetches the groups for the specified course from Canvas.
 *
 * @param course The ID of the course to fetch groups for.
 * @returns Returns the groups, organised by group category.
 */
export async function getCourseGroups(
  course: number,
): Promise<GroupsByCategory<CanvasGroup>> {
  const request = makeCanvasRequest(`/courses/${course}/groups?per_page=200`);
  const response = await fetch(request);
  if (response.status == 200) {
    const groups: CanvasGroup[] = await response.json();
    const result: GroupsByCategory<CanvasGroup> = {};

    groups.forEach((group) => {
      if (result[group.group_category_id] === undefined) {
        result[group.group_category_id] = {};
      }

      result[group.group_category_id][group.id] = group;
    });

    return result;
  } else {
    throw response.statusText;
  }
}

/**
 * Fetches the members of the group with the specified ID.
 *
 * @param id The ID of the group to fetch members for.
 * @returns Returns the members of the specified group, organised by Canvas ID.
 */
export async function getGroupMembers(
  id: number,
): Promise<ByCanvasId<Student>> {
  const request = makeCanvasRequest(`/groups/${id}/users`);
  const response = await fetch(request);
  try {
    const json: any[] = await response.json();
    const result: ByCanvasId<Student> = {};

    json.forEach((member) => {
      result[member.id] = member;
    });

    return result;
  } catch (err) {
    throw err;
  }
}

/**
 * Creates a new group.
 *
 * @param category The ID of the category under which the group should be created.
 * @param name The name of the new group.
 * @returns Returns information about the new group.
 */
export async function createGroup(
  category: number,
  name: string,
): Promise<CanvasGroup> {
  const data = new URLSearchParams();
  data.append("name", name);

  const request = makeCanvasRequest(
    `group_categories/${category}/groups`,
    data,
  );
  const response = await fetch(request);
  return response.json();
}

/**
 * Edits the specified group.
 * @param group The ID of the group to edit.
 * @param name The new name for the group.
 * @returns Returns information about the group.
 */
export async function editGroup(
  group: number,
  name: string,
): Promise<CanvasGroup> {
  const data = new URLSearchParams();
  data.append("name", name);

  const request = makeCanvasRequest(`groups/${group}`, data, "PUT");
  const response = await fetch(request);
  return response.json();
}

export interface AddToGroupResult {
  id: number;
  group_id: number;
  workflow_state: string;
  created_at: string;
  user_id: number;
  moderator: boolean;
  just_created: boolean;
}

/**
 * Add a member to a group.
 *
 * @param group The ID of the group.
 * @param student The ID of the student to add.
 * @returns Returns information about the outcome of the request.
 */
export async function addToGroup(
  group: number,
  student: number,
): Promise<AddToGroupResult> {
  const data = new URLSearchParams();
  data.append("user_id", student.toString());

  const request = makeCanvasRequest(`groups/${group}/memberships`, data);
  const response = await fetch(request);
  return response.json();
}
