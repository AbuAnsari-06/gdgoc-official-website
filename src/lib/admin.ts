import { api } from "./profile";
import type { EventFormat } from "./events";

export type AdminStats = {
  usersCount: number;
  eventsCount: number;
  publishedEventsCount: number;
  registrationsCount: number;
  attendedCount: number;
  attendanceRate: number;
};

export type AdminEvent = {
  _id: string;
  title: string;
  summary: string;
  description: string;
  startsAt: string;
  endsAt?: string | null;
  venue: string;
  poster?: string;
  cancelled: boolean;
  published: boolean;
  category: string;
  format: EventFormat;
  host: string;
  prerequisites: string;
  capacity: number | null;
  registeredCount?: number;
  registrationDeadline: string | null;
  meetingUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminRegistration = {
  _id: string;
  ticketId: string;
  status: "confirmed" | "cancelled" | "pending";
  attendedAt: string | null;
  checkedInBy?: string | null;
  overrideReason?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    _id?: string;
    name: string;
    email: string;
    branch?: string;
    year?: number;
    enrollmentNo?: string;
  };
};

export type ScanResult = {
  status: "admitted" | "already_attended" | "cancelled" | "not_found" | "invalid" | "invalid_event" | "expired" | "pending" | "event_cancelled";
  message: string;
  registration?: AdminRegistration;
  user?: {
    name: string;
    email: string;
    branch?: string;
    year?: number;
  };
  event?: {
    title: string;
    startsAt: string;
    venue: string;
  };
};

export type AdminUser = {
  name: string;
  email: string;
  role: "student" | "admin";
  branch?: string;
  year?: number;
  bio?: string;
  enrollmentNo?: string;
  emailVerified?: boolean;
  createdAt: string;
};

export async function getAdminStats(): Promise<AdminStats> {
  return api<AdminStats>("/admin/stats");
}

export async function getAdminEvents(): Promise<AdminEvent[]> {
  const res = await api<{ events: AdminEvent[] }>("/admin/events");
  return res.events;
}

export async function createAdminEvent(data: Partial<AdminEvent>): Promise<AdminEvent> {
  return api<AdminEvent>("/admin/events", "POST", data);
}

export async function updateAdminEvent(id: string, data: Partial<AdminEvent>): Promise<AdminEvent> {
  return api<AdminEvent>(`/admin/events/${id}`, "PUT", data);
}

export async function deleteAdminEvent(id: string): Promise<{ message: string; id: string }> {
  return api<{ message: string; id: string }>(`/admin/events/${id}`, "DELETE");
}

export async function getEventRegistrations(id: string): Promise<{
  event: AdminEvent;
  stats: { total: number; confirmed: number; cancelled: number; attended: number };
  registrations: AdminRegistration[];
}> {
  return api(`/admin/events/${id}/registrations`);
}

export async function scanTicketAttendance(ticketId: string, eventId?: string): Promise<ScanResult> {
  return api<ScanResult>("/admin/attendance/scan", "POST", { ticketId, eventId });
}

export async function toggleManualAttendance(
  registrationId: string,
  attended: boolean,
  reason?: string
): Promise<{ message: string; registration: AdminRegistration }> {
  return api("/admin/attendance/manual", "POST", { registrationId, attended, reason });
}

export async function getAdminUsers(
  q = "",
  role = "",
  page = 1,
  limit = 50
): Promise<{ users: AdminUser[]; total?: number; page?: number; totalPages?: number }> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (role) params.set("role", role);
  if (page) params.set("page", String(page));
  if (limit) params.set("limit", String(limit));
  const queryStr = params.toString() ? `?${params.toString()}` : "";
  const res = await api<{ users: AdminUser[]; total?: number; page?: number; totalPages?: number }>(
    `/admin/users${queryStr}`
  );
  return res;
}

export async function updateUserRole(
  email: string,
  role: "student" | "admin"
): Promise<{ message: string; user: AdminUser }> {
  return api(`/admin/users/${encodeURIComponent(email)}/role`, "PATCH", { role });
}

export function getExportCsvUrl(eventId: string): string {
  const API_BASE = import.meta.env?.VITE_API_URL ?? "/api";
  return `${API_BASE}/admin/events/${eventId}/export`;
}

export async function uploadEventPoster(file: File): Promise<{ url: string; key: string }> {
  const API_BASE = import.meta.env?.VITE_API_URL ?? "/api";
  const res = await fetch(`${API_BASE}/admin/events/upload-poster`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to upload event poster.");
  }

  return res.json();
}
