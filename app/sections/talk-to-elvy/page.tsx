"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ApplicationLink = {
  id: string;
  name: string;
  description: string;
  url: string;
  isOpen: boolean;
  sortOrder: number;
};

const APPLICATIONS_STORAGE_KEY = "elvy_applications_links";

const defaultApplications: ApplicationLink[] = [
  {
    id: "elvy-mobile-app",
    name: "Elvy Mobile Application",
    description:
      "Create an account, activate your ticket, and communicate with Elvy through the mobile application.",
    url: "/mobile",
    isOpen: true,
    sortOrder: 1,
  },
  {
    id: "android-application",
    name: "Android Application",
    description: "Available later on Google Play.",
    url: "",
    isOpen: true,
    sortOrder: 2,
  },
];

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function sortApplications(apps: ApplicationLink[]) {
  return [...apps].sort((a, b) => a.sortOrder - b.sortOrder);
}

export default function ElvyApplicationsPage() {
  const [applications, setApplications] =
    useState<ApplicationLink[]>(defaultApplications);

  const [role, setRole] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newSortOrder, setNewSortOrder] = useState(1);
  const [newIsOpen, setNewIsOpen] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(1);
  const [editIsOpen, setEditIsOpen] = useState(true);

  useEffect(() => {
    const savedApplications = safeParse<ApplicationLink[]>(
      localStorage.getItem(APPLICATIONS_STORAGE_KEY),
      defaultApplications
    );

    setApplications(sortApplications(savedApplications));

    const savedRole = localStorage.getItem("adminRole");
    const room = localStorage.getItem("adminRoom");

    setRole(savedRole);
    setIsAdmin(
      savedRole === "founder" ||
        (savedRole === "admin" && room === "talk-to-elvy")
    );
  }, []);

  useEffect(() => {
    localStorage.setItem(
      APPLICATIONS_STORAGE_KEY,
      JSON.stringify(sortApplications(applications))
    );
  }, [applications]);

  function handleLogout() {
    localStorage.removeItem("adminRole");
    localStorage.removeItem("adminRoom");
    localStorage.removeItem("adminUsername");
    setIsAdmin(false);
    setShowAdminDashboard(false);
  }

  function addApplication() {
    const cleanName = newName.trim();
    const cleanDescription = newDescription.trim();
    const cleanUrl = newUrl.trim();

    if (!cleanName) return;

    const created: ApplicationLink = {
      id: `application_${Date.now()}`,
      name: cleanName,
      description: cleanDescription,
      url: cleanUrl,
      isOpen: newIsOpen,
      sortOrder: Math.max(1, newSortOrder),
    };

    setApplications((prev) => sortApplications([...prev, created]));
    setNewName("");
    setNewDescription("");
    setNewUrl("");
    setNewSortOrder(applications.length + 2);
    setNewIsOpen(true);
  }

  function startEdit(app: ApplicationLink) {
    setEditingId(app.id);
    setEditName(app.name);
    setEditDescription(app.description);
    setEditUrl(app.url);
    setEditSortOrder(app.sortOrder);
    setEditIsOpen(app.isOpen);
  }

  function saveEdit() {
    if (!editingId) return;

    setApplications((prev) =>
      sortApplications(
        prev.map((app) =>
          app.id === editingId
            ? {
                ...app,
                name: editName.trim() || app.name,
                description: editDescription.trim(),
                url: editUrl.trim(),
                sortOrder: Math.max(1, editSortOrder),
                isOpen: editIsOpen,
              }
            : app
        )
      )
    );

    setEditingId(null);
  }

  function deleteApplication(id: string) {
    setApplications((prev) => prev.filter((app) => app.id !== id));
  }

  const visibleApplications = sortApplications(applications).filter(
    (app) => app.isOpen
  );

  return (
    <main
      className="relative min-h-screen w-full overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/images/talk-to-elvy.png')" }}
    >
      <div className="absolute inset-0 bg-[#fff1dc]/10" />

      <div className="relative z-10 min-h-screen px-5 py-6">
        {role === "founder" ? (
          <button
            onClick={() => {
              window.location.href = "/founder/dashboard";
            }}
            className="absolute left-[2%] top-[4%] z-30 rounded-full bg-black px-6 py-3 text-white shadow-lg"
          >
            ← Back to Dashboard
          </button>
        ) : (
          <Link
            href="/happy-office"
            className="absolute left-[2%] top-[4%] z-30 rounded-full bg-black px-6 py-3 text-white shadow-lg"
          >
            ← Back to Happy Office
          </Link>
        )}

        {isAdmin && (
          <div className="absolute right-5 top-5 z-50 flex gap-2">
            <button
              onClick={() => setShowAdminDashboard(true)}
              className="rounded-full bg-black px-4 py-2 text-white shadow-lg"
            >
              Open Controls
            </button>

            <button
              onClick={handleLogout}
              className="rounded-full bg-red-600 px-4 py-2 text-white shadow-lg hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        )}

        <section
          className="absolute top-[45px] w-[620px] max-w-[calc(100vw-40px)]"
          style={{ left: "calc(43% + 60px)" }}
        >
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-[0.32em] text-[#8a4b24] drop-shadow-sm">
              Welcome to
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight text-[#6f3719] drop-shadow-sm">
              Elvy Applications
            </h1>

            <p className="mx-auto mt-2 max-w-[430px] whitespace-pre-line text-base font-semibold leading-7 text-[#4f3524]">
              {`Elvy Applications gives access to communication tools developed by Happy Office.

Choose an application below to continue.`}
            </p>
          </div>

          <div className="mt-3 flex flex-col gap-3">
            {visibleApplications.length === 0 ? (
              <div className="rounded-[24px] border border-[#d2a36f]/70 bg-[#fff7ec]/90 p-5 text-center font-semibold text-[#4a2d1f] shadow-xl backdrop-blur-sm">
                No application links are available at the moment.
              </div>
            ) : (
              visibleApplications.map((app) => (
                <div
                  key={app.id}
                  className="w-full rounded-[24px] border border-[#d4a06c]/75 bg-[#fff7ec]/90 p-5 shadow-2xl backdrop-blur-sm"
                >
                  <h2 className="text-2xl font-black text-[#6f3719]">
                    {app.name}
                  </h2>

                  {app.description && (
                    <p className="mt-3 min-h-[45px] text-sm font-semibold leading-6 text-[#573923]">
                      {app.description}
                    </p>
                  )}

                  {app.url ? (
                    <a
                      href={app.url}
                      target={app.url.startsWith("http") ? "_blank" : "_self"}
                      rel="noopener noreferrer"
                      className="mt-5 block w-full rounded-2xl bg-[#1f6b2b] px-5 py-3 text-center font-extrabold text-white shadow-lg transition hover:bg-[#185622] active:scale-[0.98]"
                    >
                      Open Elvy Application
                    </a>
                  ) : (
                    <div className="mt-5 rounded-2xl bg-[#ecd2ad]/95 px-5 py-3 text-center font-extrabold text-[#6f3719] shadow-inner">
                      Coming Soon
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {isAdmin && showAdminDashboard && (
          <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/50 p-4">
            <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">
                    Elvy Applications Control Center
                  </h2>
                  <p className="text-sm text-stone-600">
                    Add, edit, describe, show, hide, or delete application links.
                  </p>
                </div>

                <button
                  onClick={() => setShowAdminDashboard(false)}
                  className="rounded bg-black px-4 py-2 text-white"
                >
                  Close
                </button>
              </div>

              <div className="rounded-xl border bg-stone-50 p-4">
                <h3 className="mb-3 text-lg font-semibold">
                  Add Application Link
                </h3>

                <div className="grid gap-3 md:grid-cols-5">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Application name"
                    className="rounded border p-2"
                  />

                  <input
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Short description"
                    className="rounded border p-2 md:col-span-2"
                  />

                  <input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="Application link"
                    className="rounded border p-2"
                  />

                  <input
                    type="number"
                    value={newSortOrder}
                    onChange={(e) => setNewSortOrder(Number(e.target.value))}
                    placeholder="Order"
                    className="rounded border p-2"
                  />
                </div>

                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newIsOpen}
                    onChange={(e) => setNewIsOpen(e.target.checked)}
                  />
                  Show this application to users
                </label>

                <button
                  onClick={addApplication}
                  className="mt-3 rounded bg-black px-4 py-2 text-white"
                >
                  Add Link
                </button>
              </div>

              <div className="mt-6 rounded-xl border bg-stone-50 p-4">
                <h3 className="mb-3 text-lg font-semibold">
                  Application Links
                </h3>

                <div className="space-y-3">
                  {sortApplications(applications).map((app) => (
                    <div
                      key={app.id}
                      className="rounded-xl border bg-white p-3 shadow-sm"
                    >
                      {editingId === app.id ? (
                        <div className="grid gap-3 md:grid-cols-5">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="rounded border p-2"
                          />

                          <input
                            value={editDescription}
                            onChange={(e) =>
                              setEditDescription(e.target.value)
                            }
                            className="rounded border p-2 md:col-span-2"
                          />

                          <input
                            value={editUrl}
                            onChange={(e) => setEditUrl(e.target.value)}
                            className="rounded border p-2"
                          />

                          <input
                            type="number"
                            value={editSortOrder}
                            onChange={(e) =>
                              setEditSortOrder(Number(e.target.value))
                            }
                            className="rounded border p-2"
                          />

                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={editIsOpen}
                              onChange={(e) =>
                                setEditIsOpen(e.target.checked)
                              }
                            />
                            Show
                          </label>

                          <button
                            onClick={saveEdit}
                            className="rounded bg-green-700 px-3 py-2 text-white"
                          >
                            Save
                          </button>

                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded bg-stone-500 px-3 py-2 text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="text-lg font-semibold">
                              {app.name}
                            </div>

                            <div className="mt-1 text-sm text-stone-600">
                              {app.description || "No description"}
                            </div>

                            <div className="mt-1 break-all text-xs text-stone-500">
                              {app.url || "No link / Coming soon"}
                            </div>

                            <div className="mt-1 text-xs text-stone-600">
                              {app.isOpen ? "Visible" : "Hidden"} • Order:{" "}
                              {app.sortOrder}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => startEdit(app)}
                              className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() =>
                                setApplications((prev) =>
                                  prev.map((item) =>
                                    item.id === app.id
                                      ? { ...item, isOpen: !item.isOpen }
                                      : item
                                  )
                                )
                              }
                              className="rounded bg-stone-700 px-3 py-1 text-sm text-white"
                            >
                              {app.isOpen ? "Hide" : "Show"}
                            </button>

                            <button
                              onClick={() => deleteApplication(app.id)}
                              className="rounded bg-red-700 px-3 py-1 text-sm text-white"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {applications.length === 0 && (
                    <div className="rounded-xl bg-white p-4 text-center text-stone-600">
                      No application links yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
