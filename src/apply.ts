import { GROUP_CONFIG_FILE, PROTOTYPE_GROUPS_CATEGORY } from "./const";
import { addToGroup, createGroup, editGroup, writeGroups } from "./groups";
import { synchronise } from "./synchronise";

async function runWrapper() {
  const results = await synchronise();
  const events = results.events;

  try {
    for (let index = 0; index < events.groupsToCreate.length; index++) {
      const event = events.groupsToCreate[index];
      const group = await createGroup(PROTOTYPE_GROUPS_CATEGORY, event.name);
      event.specification.id = group.id;

      for (let j = 0; j < event.members.length; j++) {
        const memberToAdd = event.members[j];
        const result = await addToGroup(group.id, memberToAdd.id);
      }
    }

    await writeGroups(GROUP_CONFIG_FILE, results.configGroups);

    for (let index = 0; index < events.groupsToUpdate.length; index++) {
      const event = events.groupsToUpdate[index];
      const result = await editGroup(event.group, event.newName);
    }

    for (let index = 0; index < events.membersToAdd.length; index++) {
      const event = events.membersToAdd[index];
      const result = await addToGroup(event.group, event.member.id);
    }
  } catch (err) {
    console.error(`Failed to read actions from file: ${err}`);
    process.exit(1);
  }
}

runWrapper();
