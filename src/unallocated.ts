import { Events, writeMarkdown } from "./event";
import { synchronise } from "./synchronise";

async function runValidate(): Promise<Events> {
  try {
    const results = await synchronise();

    results.module.students.ids.forEach((sisID) => {
      if (!results.allocatedStudents.has(sisID)) {
        console.log(
          `Student '${sisID}' ('${results.module.students.byId[sisID]}') does not have a group, yet.`,
        );
      }
    });

    return results.events;
  } catch (err) {
    console.error(`Failed to obtain list of unallocated students: ${err}`);
    process.exit(1);
  }
}

async function runWrapper() {
  const events = await runValidate();
}

runWrapper();
