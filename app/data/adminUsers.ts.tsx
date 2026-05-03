export type AdminUser = {
  username: string;
  password: string;
  role: "founder" | "room_admin";
  room?: string;
};

export const adminUsers: AdminUser[] = [
  {
    username: "founder",
    password: "1234",
    role: "founder",
  },
  {
    username: "admin_messages",
    password: "1234",
    role: "room_admin",
    room: "messages",
  },
  {
    username: "admin_stories",
    password: "1234",
    role: "room_admin",
    room: "stories",
  },
  {
    username: "admin_gallery",
    password: "1234",
    role: "room_admin",
    room: "gallery",
  },
  {
    username: "admin_greetings",
    password: "1234",
    role: "room_admin",
    room: "greetings",
  },
  {
    username: "admin_countries",
    password: "1234",
    role: "room_admin",
    room: "countries",
  },
  {
    username: "admin_letstalk",
    password: "1234",
    role: "room_admin",
    room: "lets-talk",
  },
{
  username: "admin_elvystudio",
  password: "1234",
  role: "room_admin",
  room: "elvy-studio", 
},
];