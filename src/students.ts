import fetch from "node-fetch";
import { makeCanvasRequest } from "./canvas";
import { existsSync, readFileSync, writeFileSync } from "fs";

/** Canvas IDs are always numeric. */
type CanvasID = number;
/** SIS IDs are typically numeric, but are represented as strings. */
type StudentID = string;

/**
 * Represents a mapping of Canvas IDs to SIS IDs, and vice-versa.
 */
export interface CourseStudents {
  /** All SIS IDs. */
  ids: StudentID[];
  /** Maps Canvas IDs to SIS IDs. */
  byCanvasId: StudentsByCanvasId;
  /** Maps SIS IDs to Canvas IDs. */
  byId: StudentsById;
}

export interface ByCanvasId<T> {
  [index: CanvasID]: T;
}

/** Represents a mapping of Canvas IDs to SIS IDs. */
export type StudentsByCanvasId = ByCanvasId<StudentID>;

/** Represents a mapping of SIS IDs to Canvas IDs. */
export interface StudentsById {
  [index: StudentID]: CanvasID;
}

/** Represents IDs a student returned by Canvas will have. */
export interface StudentIDs {
  /** Canvas' own ID for the student. */
  id: CanvasID;
  /** The ID of the student used across systems. */
  sis_user_id: StudentID;
}

/** Represents information about a student returned by Canvas. */
export interface Student extends StudentIDs {
  name: string;
  sortable_name: string;
  short_name: string;
}

/**
 * Fetches all students for the specified course.
 *
 * @param course The ID of the course to fetch all students for.
 * @returns Returns the list of students for the specified course.
 */
export async function getStudents(course: number): Promise<CourseStudents> {
  const request = makeCanvasRequest(`courses/${course}/students`);
  const response = await fetch(request);
  const data: Student[] = await response.json();
  const result: CourseStudents = {
    ids: [],
    byCanvasId: {},
    byId: {},
  };

  data.forEach((student) => {
    result.ids.push(student.sis_user_id);
    result.byCanvasId[student.id] = student.sis_user_id;
    result.byId[student.sis_user_id] = student.id;
  });

  return result;
}

/**
 * Tries to restore a cached student ID mapping from disk.
 *
 * @param path The path to retrieve the mappings from.
 * @returns If successful, returns the student ID mappings.
 */
export async function restoreIdMapping(path: string): Promise<CourseStudents> {
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, "utf-8"));
  } else {
    throw `File ${path} does not exist.`;
  }
}

/**
 * Writes a student ID mapping to disk.
 *
 * @param path The path to which to write the mappings.
 * @param mapping The student ID mappings to write to the file.
 */
export async function cacheIdMapping(
  path: string,
  mapping: CourseStudents,
): Promise<void> {
  writeFileSync(path, JSON.stringify(mapping));
}
