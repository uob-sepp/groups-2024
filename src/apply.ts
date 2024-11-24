import { GROUP_CONFIG_FILE, PROTOTYPE_GROUPS_CATEGORY } from "./const";
import {
  addToGroup,
  createGroup,
  editGroup,
  removeFromGroup,
  writeGroups,
} from "./groups";
import { synchronise } from "./synchronise";

async function runWrapper() {
  const results = await synchronise();
  const events = results.events;

  try {
    console.log(`Removing students from groups...`);

    for (let index = 0; index < events.membersToRemove.length; index++) {
      const event = events.membersToRemove[index];
      console.log(
        `Removing ${event.member.sis_user_id} from group ${event.group}...`,
      );

      try {
        const result = await removeFromGroup(event.group, event.member.id);
      } catch (err) {
        console.error(
          `Unable to remove ${event.member.sis_user_id} from group ${event.group}: ${err}`,
        );
      }
    }

    console.log(`Creating groups...`);

    for (let index = 0; index < events.groupsToCreate.length; index++) {
      const event = events.groupsToCreate[index];
      console.log(`Creating group ${event.name}...`);

      const group = await createGroup(PROTOTYPE_GROUPS_CATEGORY, event.name);
      event.specification.id = group.id;

      for (let j = 0; j < event.members.length; j++) {
        const memberToAdd = event.members[j];
        console.log(
          `Adding ${memberToAdd.sis_user_id} to group ${event.name} (${group.id})...`,
        );

        const result = await addToGroup(group.id, memberToAdd.id);
      }
    }

    console.log(`Updating configuration file with any new group ids...`);
    await writeGroups(GROUP_CONFIG_FILE, results.configGroups);

    for (let index = 0; index < events.groupsToUpdate.length; index++) {
      const event = events.groupsToUpdate[index];
      console.log(
        `Changing name of group ${event.oldName} (${event.group}) to ${event.newName}...`,
      );

      const result = await editGroup(event.group, event.newName);
    }

    for (let index = 0; index < events.membersToAdd.length; index++) {
      const event = events.membersToAdd[index];
      console.log(
        `Adding ${event.member.sis_user_id} to group ${event.group}...`,
      );
      const result = await addToGroup(event.group, event.member.id);
    }

    console.log(`All done!`);
  } catch (err) {
    console.error(`Failed to apply configuration: ${err}`);
    process.exit(1);
  }
}

runWrapper();
