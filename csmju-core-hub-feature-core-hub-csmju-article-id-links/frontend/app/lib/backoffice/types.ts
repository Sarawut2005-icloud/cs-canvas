/** Colour family a status badge renders with. */
export type StatusTone = "success" | "info" | "warning" | "error" | "neutral";

/** Admin-defined status that can be assigned to rooms or students. */
export type Status = {
  id: string;
  label: string;
  tone: StatusTone;
};

export type StatusInput = Omit<Status, "id">;

export type Room = {
  id: string;
  code: string;
  name: string;
  floor: number;
  statusId: string;
};

export type RoomInput = Omit<Room, "id" | "floor">;

export type Student = {
  id: string;
  studentId: string;
  fullName: string;
  /** University-issued address (@mju.ac.th). */
  email: string;
  statusId: string;
};

export type StudentInput = Omit<Student, "id">;
