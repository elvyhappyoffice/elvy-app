export type AdminUser = {
  username: string;
  password: string;
  role: "founder" | "admin";
  room?: "daily-support" | "talk-to-elvy" | "meet-elvy";
};

export const adminUsers: AdminUser[] = [
  {
    username: "founder",
    password: "1234",
    role: "founder",
  },

  {
    username: "daily_admin",
    password: "1234",
    role: "admin",
    room: "daily-support",
  },

  {
    username: "talk_admin",
    password: "1234",
    role: "admin",
    room: "talk-to-elvy",
  },

  {
    username: "meet_admin",
    password: "1234",
    role: "admin",
    room: "meet-elvy",
  },
];