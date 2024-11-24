import {
  GROUP_CONFIG_FILE,
  SEPP_COURSE,
  STUDENT_GROUPS_CATEGORY,
} from "./const";
import {
  CanvasGroup,
  getCourseGroups,
  getGroupMembers,
  GroupSpecification,
  readGroups,
  writeGroups,
} from "./groups";
import { ByCanvasId, Student, StudentsByCanvasId } from "./students";

let studentsInGroups: Set<string> = new Set();

function exactMemberMatch(
  canvasGroupId: number,
  canvasGroup: ByCanvasId<Student>,
  configGroup: GroupSpecification,
): boolean {
  const keys = Object.keys(canvasGroup);
  // if the two groups have different member counts, then they can't be identical
  if (keys.length != configGroup.members.length) {
    // console.debug(
    //   `Skipping ${configGroup.name} because it has ${configGroup.members.length}<${keys.length} members.`,
    // );
    return false;
  }

  for (let index = 0; index < keys.length; index++) {
    const sisMember = canvasGroup[Number(keys[index])];
    let found = false;

    for (let j = 0; j < configGroup.members.length; j++) {
      if (configGroup.members[j] === sisMember.sis_user_id) {
        console.log(`For ${canvasGroupId}: Found ${sisMember.sis_user_id}`);
        found = true;
        break;
      }
    }

    if (found === false) {
      // console.debug(
      //   `Skipping ${configGroup.name} because ${sisMember.sis_user_id} isn't a member.`,
      // );
      return false;
    }
  }

  return true;
}

async function shouldDeleteGroup(
  group: CanvasGroup,
  canvasMembers: ByCanvasId<Student> | undefined,
  configGroups: GroupSpecification[],
): Promise<boolean> {
  const groupId = group.id;

  if (group.members_count === 0) {
    console.log(`Would delete group '${groupId}' because it has no members.`);
    return true;
  } else if (canvasMembers !== undefined) {
    for (let index = 0; index < configGroups.length; index++) {
      const configGroup = configGroups[index];

      if (exactMemberMatch(groupId, canvasMembers, configGroup)) {
        console.log(
          `Would delete group '${groupId}' because there is an identical group in the configuration.`,
        );
        console.log(configGroup);
        return true;
      }
    }
  }

  return false;
}

async function runWrapper() {
  try {
    const canvasGroups = await getCourseGroups(SEPP_COURSE);
    const studentGroups = canvasGroups[STUDENT_GROUPS_CATEGORY];
    const configGroups = await readGroups();

    configGroups.forEach((configGroup) => {
      configGroup.members.forEach((member) => {
        studentsInGroups.add(member);
      });
    });
    console.log(`${studentsInGroups.size} students are already in groups.`);

    for (
      let canvasIndex = 0;
      canvasIndex < Object.keys(studentGroups).length;
      canvasIndex++
    ) {
      const groupId = Number(Object.keys(studentGroups)[canvasIndex]);
      const group = studentGroups[groupId];
      let canvasMembers: ByCanvasId<Student> | undefined;

      console.log(`Checking group ${groupId}: ${group.name}...`);

      try {
        canvasMembers = await getGroupMembers(groupId);
      } catch (err) {
        console.error(`Cannot get members for ${groupId}: ${err}`);
      }

      const shouldDelete = await shouldDeleteGroup(
        group,
        canvasMembers,
        configGroups,
      );

      if (shouldDelete) {
        console.log(group);
      } else if (canvasMembers !== undefined) {
        console.log(`Would migrate group '${groupId}' to assignment groups`);
        const membersToAdd: Set<string> = new Set(
          Object.values(canvasMembers).map((member) => member.sis_user_id),
        );

        const values = Object.values(canvasMembers);
        for (let index = 0; index < values.length; index++) {
          const memberToAdd = values[index];
          if (studentsInGroups.has(memberToAdd.sis_user_id)) {
            console.log(
              `${memberToAdd.sis_user_id} is already in a group, skipping...`,
            );
            membersToAdd.delete(memberToAdd.sis_user_id);
          }
        }

        console.log(membersToAdd.keys());

        if (membersToAdd.size > 0) {
          const configGroupToAdd: GroupSpecification = {
            name: group.name,
            members: Array.from(membersToAdd.values()),
          };
          console.log(configGroupToAdd);
          configGroups.push(configGroupToAdd);
        } else {
          console.log(`Group would be empty, skipping...`);
        }
      }
    }

    await writeGroups(GROUP_CONFIG_FILE, configGroups);
  } catch (err) {
    console.error(`Failed to clean up Student Canvas groups: ${err}`);
    process.exit(1);
  }
}

runWrapper();
