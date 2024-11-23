import { SEPP_COURSE, STUDENT_MAPPING_FILE } from "./const";
import {
  cacheIdMapping,
  CourseStudents,
  getStudents,
  restoreIdMapping,
} from "./students";

/** Represents information about a module on Canvas. */
export interface ModuleInfo {
  students: CourseStudents;
}

/**
 * Fetches information about the module from Canvas.
 * @returns Returns the information about the module.
 */
export async function getModuleInfo(): Promise<ModuleInfo> {
  // Try to restore the student information from a local file, or retrieve it from
  // Canvas if it's not available locally.
  const students = await restoreIdMapping(STUDENT_MAPPING_FILE).catch(
    async (err) => {
      console.log(`Unable to restore student id mapping: ${err}`);
      console.log("Fetching students from Canvas...");
      const result = await getStudents(SEPP_COURSE);

      // Try to write the students as JSON to a file, but continue if this fails.
      try {
        await cacheIdMapping(STUDENT_MAPPING_FILE, result);
      } catch (writeErr) {
        console.error(
          `Unable to write student information to file: ${writeErr}`,
        );
      }

      // Return the list of students.
      return result;
    },
  );

  return { students };
}
