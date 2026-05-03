"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminUsers } from "./data/admins";

export default function AdminLoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleLogin() {
    const user = adminUsers.find(
      (u) => u.username === username && u.password === password
    );

    if (!user) {
      alert("Invalid credentials");
      return;
    }

    localStorage.setItem("adminRole", user.role);
    localStorage.setItem("adminUsername", user.username);

    if (user.role === "founder") {
      localStorage.setItem("adminRoom", "founder");
      router.push("/founder/dashboard");
      return;
    }

    if (user.room) {
      localStorage.setItem("adminRoom", user.room);
      router.push(`/sections/${user.room}`);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5e6d3]">
      <div className="w-[350px] rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-6 text-center text-2xl font-bold text-[#7a3b1d]">
          Admin Login
        </h1>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 w-full rounded-xl border px-4 py-3"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded-xl border px-4 py-3"
        />

        <button
          onClick={handleLogin}
          className="w-full rounded-xl bg-[#7a3b1d] py-3 font-bold text-white"
        >
          Login
        </button>
      </div>
    </main>
  );
}