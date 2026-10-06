import { listReference, type Curriculum, type Department, type Faculty } from "../../lib/api";

/** Reference rows the add-person forms offer — codes only travel to the API. */
export type PeopleFormOptions = {
  faculties: { code: string; nameTh: string }[];
  departments: { code: string; nameTh: string; facultyCode: string }[];
  curricula: { code: string; nameTh: string; curriculumYear: number; departmentCode: string }[];
};

/**
 * Active faculties, departments and curricula for the selects (server-side).
 * A failed list just leaves its select empty; the import still validates.
 */
export async function loadPeopleFormOptions(): Promise<PeopleFormOptions> {
  const safe = async <T,>(load: () => Promise<{ data: T[] }>) => {
    try {
      return (await load()).data;
    } catch {
      return [];
    }
  };
  const [faculties, departments, curricula] = await Promise.all([
    safe(() => listReference<Faculty>("faculties", { limit: 100 })),
    safe(() => listReference<Department>("departments", { limit: 100 })),
    safe(() => listReference<Curriculum>("curricula", { limit: 100 })),
  ]);
  return {
    faculties: faculties.map(({ code, nameTh }) => ({ code, nameTh })),
    departments: departments.map(({ code, nameTh, facultyCode }) => ({ code, nameTh, facultyCode })),
    curricula: curricula.map(({ code, nameTh, curriculumYear, departmentCode }) => ({
      code,
      nameTh,
      curriculumYear,
      departmentCode,
    })),
  };
}
