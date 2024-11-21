import { Events, writeMarkdown } from "./event";
import { synchronise } from "./synchronise";

async function runValidate(): Promise<Events> {
  try {
    const results = await synchronise();
    return results.events;
  } catch (err) {
    console.error(`Failed to validate configuration: ${err}`);
    process.exit(1);
  }
}

async function runWrapper() {
  const events = await runValidate();

  // Write a summary of the changes as markdown, if there are any changes.
  if (
    events.groupsToCreate.length > 0 ||
    events.groupsToUpdate.length > 0 ||
    events.membersToAdd.length > 0 ||
    events.membersToRemove.length > 0
  ) {
    writeMarkdown(events);
  }
}

runWrapper();
