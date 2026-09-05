import { z } from "zod";

export const staffRoles = ["manager", "advisor", "technician", "cashier", "viewer"] as const;
export type StaffRole = (typeof staffRoles)[number];

export type StaffRoleOption = {
  value: StaffRole;
  label: string;
  description: string;
};

const automotiveStaffRoleOptions: readonly StaffRoleOption[] = [
  { value: "manager", label: "Manager", description: "Manages daily operations, staff, and business records." },
  { value: "advisor", label: "Service Advisor", description: "Coordinates customers, vehicles, appointments, estimates, and Job Orders." },
  { value: "technician", label: "Technician", description: "Works on assigned Automotive jobs." },
  { value: "cashier", label: "Cashier", description: "Handles invoices and payments." },
  { value: "viewer", label: "Viewer", description: "Has read-only operational access." },
];

const salonStaffRoleOptions: readonly StaffRoleOption[] = [
  { value: "manager", label: "Manager", description: "Manages daily Salon operations, Staff, and business records." },
  { value: "advisor", label: "Front Desk / Coordinator", description: "Coordinates Clients, Appointments, and Treatments." },
  { value: "technician", label: "Service Provider", description: "Views assigned visits; use Job Function for Stylist, Therapist, or similar titles." },
  { value: "cashier", label: "Cashier", description: "Handles Appointment payments." },
  { value: "viewer", label: "Viewer", description: "Has read-only operational access." },
];

export function staffRoleOptionsForIndustry(industry: string): readonly StaffRoleOption[] {
  if (industry === "automotive") return automotiveStaffRoleOptions;
  if (industry === "salon") return salonStaffRoleOptions;
  return [];
}

export function staffRoleLabelForIndustry(role: string, industry: string): string {
  if (role === "owner") return "Owner";
  return staffRoleOptionsForIndustry(industry).find((option) => option.value === role)?.label ?? "Unknown access role";
}

export function isStaffRoleAvailableForIndustry(role: StaffRole, industry: string): boolean {
  return staffRoleOptionsForIndustry(industry).some((option) => option.value === role);
}

export const inviteStaffSchema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  role: z.enum(staffRoles),
  branchIds: z.array(z.uuid()).max(100),
  expiresHours: z.coerce.number().int().min(1).max(168),
});

export const updateStaffSchema = z.object({
  membershipId: z.uuid(),
  role: z.enum(staffRoles),
  isActive: z.boolean(),
  branchIds: z.array(z.uuid()).max(100),
});

export type Permission =
  | "organization.manage"
  | "branches.manage"
  | "staff.manage"
  | "customers.read"
  | "customers.write"
  | "vehicles.read"
  | "vehicles.write"
  | "services.manage"
  | "appointments.manage"
  | "jobs.manage"
  | "jobs.execute"
  | "estimates.manage"
  | "invoices.manage"
  | "payments.record"
  | "inventory.manage"
  | "reports.view"
  | "settings.manage";

const permissions: Record<"owner" | StaffRole, readonly Permission[]> = {
  owner: ["organization.manage", "branches.manage", "staff.manage", "customers.read", "customers.write", "vehicles.read", "vehicles.write", "services.manage", "appointments.manage", "jobs.manage", "jobs.execute", "estimates.manage", "invoices.manage", "payments.record", "inventory.manage", "reports.view", "settings.manage"],
  manager: ["branches.manage", "customers.read", "customers.write", "vehicles.read", "vehicles.write", "services.manage", "appointments.manage", "jobs.manage", "jobs.execute", "estimates.manage", "invoices.manage", "payments.record", "inventory.manage", "reports.view", "settings.manage"],
  advisor: ["customers.read", "customers.write", "vehicles.read", "vehicles.write", "appointments.manage", "jobs.manage", "estimates.manage"],
  technician: ["customers.read", "vehicles.read", "jobs.execute"],
  cashier: ["customers.read", "vehicles.read", "invoices.manage", "payments.record"],
  viewer: ["customers.read", "vehicles.read", "reports.view"],
};

export function roleHasPermission(role: keyof typeof permissions, permission: Permission) {
  return permissions[role].includes(permission);
}
