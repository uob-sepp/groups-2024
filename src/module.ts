import fetch from "node-fetch";
import { makeCanvasRequest } from "./canvas";
import {
  DUBAI_SECTION,
  EDGBASTON_SECTION,
  SEPP_COURSE,
  STUDENT_MAPPING_FILE,
} from "./const";
import {
  cacheIdMapping,
  CourseStudents,
  getStudents,
  restoreIdMapping,
  Student,
} from "./students";

/** Represents information about a module on Canvas. */
export interface ModuleInfo {
  students: CourseStudents;
  edgbaston: Set<number>;
  dubai: Set<number>;
}

/** Information about a section returned by Canvas. */
export interface CanvasSection {
  id: number;
  course_id: number;
  name: string;
  students: Student[];
}

/**
 * Fetches all sections, including students, for the module.
 * @returns
 */
export async function getSections(): Promise<CanvasSection[]> {
  const request = makeCanvasRequest(
    `courses/${SEPP_COURSE}/sections?include[]=students`,
  );
  const response = await fetch(request);
  const json = await response.json();
  return json;
}

/**
 * Fetches information about the module from Canvas.
 * @returns Returns the information about the module.
 */
export async function getModuleInfo(): Promise<ModuleInfo> {
  const sections = await getSections();
  const edgbaston = new Set<number>();
  const dubai = new Set<number>();

  sections.forEach((section) => {
    if (section.id === EDGBASTON_SECTION) {
      section.students.forEach((student) => {
        edgbaston.add(student.id);
      });
    } else if (section.id === DUBAI_SECTION) {
      section.students.forEach((student) => {
        dubai.add(student.id);
      });
    }
  });

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

  return { students, edgbaston, dubai };
}
