import { PROTOTYPE_GROUPS_CATEGORY, SEPP_COURSE } from "./const";
import { Events, makeEmptyActions } from "./event";
import {
  CanvasGroup,
  getCourseGroups,
  getGroupMembers,
  GroupsById,
  GroupSpecification,
  readGroups,
} from "./groups";
import {
  cacheIdMapping,
  CourseStudents,
  getStudents,
  restoreIdMapping,
} from "./students";

let students: CourseStudents;
let prototypeGroups: GroupsById<CanvasGroup>;

async function validateExistingGroup(
  info: SynchroniseInfo,
  configGroup: GroupSpecification,
) {
  // Ensure that there is only one group with a given name.
  if (info.groupNames.has(configGroup.name)) {
    throw new Error(
      `There are multiple groups named '${configGroup.name}' in the configuration.`,
    );
  }
  info.groupNames.add(configGroup.name);

  // Check that the members of this group don't already belong to another.
  for (let index = 0; index < configGroup.members.length; index++) {
    const member = configGroup.members[index];

    if (info.allocatedStudents.has(member)) {
      throw new Error(`Student '${member}' is assigned to multiple groups.`);
    }
    info.allocatedStudents.add(member);
  }

  if (configGroup.id !== undefined) {
    const matchingGroup = prototypeGroups[configGroup.id];

    if (matchingGroup !== undefined) {
      console.log(
        `Group ${configGroup.name} exists as group ${configGroup.id} on Canvas.`,
      );

      // Check that the name returned by Canvas matches what we have in the configuration.
      if (matchingGroup.name !== configGroup.name) {
        console.log(
          `Name needs to be changed from ${matchingGroup.name} to ${configGroup.name}`,
        );

        info.events.groupsToUpdate.push({
          group: matchingGroup.id,
          newName: configGroup.name,
          oldName: matchingGroup.name,
        });
      }

      // Check which members need to be added to the group, based on which students are
      // configured locally, but aren't members of the group on Canvas.
      const canvasMembers = await getGroupMembers(configGroup.id);
      // console.log(canvasMembers);

      configGroup.members.forEach((member) => {
        const canvasId = students.byId[member];

        if (canvasId === undefined) {
          console.error(`Unable to retrieve student matching ${member}`);
        } else {
          if (canvasMembers[canvasId] !== undefined) {
            console.log(
              `Student ${member} (${canvasId}) is a member of the group.`,
            );
          } else {
            console.log(
              `Student ${member} (${canvasId}) is a member in the configuration file, but not on Canvas.`,
            );
            info.events.membersToAdd.push({
              group: matchingGroup.id,
              member: { id: canvasId, sis_user_id: member },
            });
          }
        }
      });

      Object.keys(canvasMembers).forEach((canvasMember) => {
        const id = students.byCanvasId[Number.parseInt(canvasMember)];

        if (id === undefined) {
          console.error(`Unable to resolve id of ${canvasMember}`);
        } else {
          let found: boolean = false;

          configGroup.members.forEach((configMember) => {
            if (configMember === id) {
              found = true;
            }
          });

          if (!found) {
            console.log(
              `Student ${id} (${canvasMember}) needs to be removed from the group on Canvas.`,
            );
            info.events.membersToRemove.push({
              group: matchingGroup.id,
              member: { id: Number(canvasMember), sis_user_id: id },
            });
          }
        }
      });
    } else {
      console.error(
        `Group ${configGroup.name} has id ${configGroup.id}, which does not exist on Canvas.`,
      );
    }
  } else {
    // create group
    console.log(`Group ${configGroup.name} does not exist yet.`);

    info.events.groupsToCreate.push({
      specification: configGroup,
      name: configGroup.name,
      members: configGroup.members.map((member) => {
        return { id: students.byId[member], sis_user_id: member };
      }),
    });
  }
}

export interface SynchroniseInfo {
  events: Events;
  configGroups: GroupSpecification[];
  allocatedStudents: Set<string>;
  groupNames: Set<string>;
}

export async function synchronise(): Promise<SynchroniseInfo> {
  const results: SynchroniseInfo = {
    events: makeEmptyActions(),
    configGroups: await readGroups(),
    allocatedStudents: new Set(),
    groupNames: new Set(),
  };

  if (results.configGroups === null) {
    console.log(`Configuration file is empty, nothing to do!`);
    return results;
  }

  console.log(
    `Found ${results.configGroups.length} group(s) in the local configuration file.`,
  );

  students = await restoreIdMapping("config/students.json").catch(
    async (err) => {
      console.log(`Unable to restore student id mapping: ${err}`);

      console.log("Fetching students from Canvas...");
      const result = await getStudents(SEPP_COURSE);
      await cacheIdMapping("config/students.json", result);
      return result;
    },
  );
  const groups = await getCourseGroups(SEPP_COURSE);
  prototypeGroups = groups[PROTOTYPE_GROUPS_CATEGORY];
  console.log(
    `Found ${Object.keys(prototypeGroups).length} group(s) on Canvas.`,
  );

  for (let index = 0; index < results.configGroups.length; index++) {
    await validateExistingGroup(results, results.configGroups[index]);
  }

  return results;
}
