import type { OrganizationMembership } from "@/lib/auth/context";
import { roleHasPermission } from "@/lib/rbac";
import type { FeatureAccessRequirement } from "@/modules/platform/features";
import { industrySupportsFeature, type IndustryConfig } from "@/modules/platform/industry";

export const navigationGroupOrder = ["dashboard", "operations", "customers", "business", "more"] as const;
export type NavigationGroupKey = (typeof navigationGroupOrder)[number];

export type NavigationItem = FeatureAccessRequirement & {
  key: string;
  label: string;
  href: string;
  mobileLabel?: string;
  group: NavigationGroupKey;
};

const navigationGroupLabels: Record<NavigationGroupKey, string> = {
  dashboard: "Dashboard",
  operations: "Operations",
  customers: "Customers",
  business: "Business",
  more: "More",
};

export type NavigationGroup = {
  key: NavigationGroupKey;
  label: string;
  items: readonly NavigationItem[];
};

export const karkrNavigation = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", group: "dashboard" },
  { key: "appointments", label: "Appointments", mobileLabel: "Bookings", href: "/dashboard/appointments", group: "operations", industryFeature: "appointments", permission: "appointments.manage" },
  { key: "queue", label: "Queue", href: "/dashboard/queue", group: "operations", industryFeature: "queue", permission: "appointments.manage" },
  { key: "jobs", label: "Job Orders", href: "/dashboard/jobs", group: "operations", industryFeature: "job_orders", permission: "jobs.execute" },
  { key: "my_work", label: "My Work", href: "/dashboard/my-work", group: "operations", industryFeature: "job_orders", permission: "jobs.execute" },
  { key: "bookings", label: "Booking Requests", href: "/dashboard/bookings", group: "operations", industryFeature: "booking_requests", permission: "appointments.manage" },
  { key: "customers", label: "Customers", href: "/dashboard/customers", group: "customers", permission: "customers.read" },
  { key: "vehicles", label: "Vehicles", href: "/dashboard/vehicles", group: "customers", industryFeature: "vehicles", permission: "vehicles.read" },
  { key: "services", label: "Services", href: "/dashboard/services", group: "business", permission: "services.manage" },
  { key: "staff", label: "Staff", href: "/dashboard/settings/staff", group: "business", permission: "settings.manage" },
  { key: "inventory", label: "Inventory", href: "/dashboard/inventory", group: "business", industryFeature: "inventory", permission: "inventory.manage" },
  { key: "payments", label: "Payments", href: "/dashboard/payments", group: "business", industryFeature: "payments", permission: "payments.record" },
  { key: "reminders", label: "Maintenance", href: "/dashboard/reminders", group: "more", industryFeature: "maintenance", subscriptionFeature: "reminders" },
  { key: "branches", label: "Branches", href: "/dashboard/settings/branches", group: "more", permission: "branches.manage" },
  { key: "resources", label: "Service Bays", href: "/dashboard/settings/resources", group: "more", industryFeature: "resources", permission: "settings.manage" },
  { key: "reports", label: "Reports", href: "/dashboard/reports", group: "more", subscriptionFeature: "advanced_reports", permission: "reports.view" },
  { key: "settings", label: "Settings", href: "/dashboard/settings", group: "more", permission: "settings.manage" },
] as const satisfies readonly NavigationItem[];

const salonNavigation = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", group: "dashboard" },
  { key: "appointments", label: "Appointments", mobileLabel: "Bookings", href: "/dashboard/appointments", group: "operations", industryFeature: "appointments", permission: "appointments.manage" },
  { key: "bookings", label: "Booking Requests", href: "/dashboard/bookings", group: "operations", industryFeature: "booking_requests", permission: "appointments.manage" },
  { key: "customers", label: "Clients", href: "/dashboard/customers", group: "customers", permission: "customers.read" },
  { key: "services", label: "Treatments", href: "/dashboard/services", group: "business", permission: "services.manage" },
  { key: "staff", label: "Staff", href: "/dashboard/settings/staff", group: "business", permission: "settings.manage" },
  { key: "inventory", label: "Inventory", href: "/dashboard/inventory", group: "business", industryFeature: "inventory", permission: "inventory.manage" },
  { key: "resources", label: "Resources", href: "/dashboard/settings/resources", group: "more", industryFeature: "resources", permission: "settings.manage" },
  { key: "branches", label: "Branches", href: "/dashboard/settings/branches", group: "more", permission: "branches.manage" },
  { key: "settings", label: "Settings", href: "/dashboard/settings", group: "more", permission: "settings.manage" },
] as const satisfies readonly NavigationItem[];

export function navigationForIndustry(config: IndustryConfig, role?: OrganizationMembership["role"]): readonly NavigationItem[] {
  const navigation: readonly NavigationItem[] = config.key === "salon" ? salonNavigation : karkrNavigation;
  return navigation.filter((item) =>
    (!item.industryFeature || industrySupportsFeature(config, item.industryFeature))
    && (!role || !item.permission || roleHasPermission(role, item.permission)),
  );
}

export function groupNavigation(items: readonly NavigationItem[]): NavigationGroup[] {
  return navigationGroupOrder.flatMap((key) => {
    const groupItems = items.filter((item) => item.group === key);
    const label = key === "customers" && groupItems.some((item) => item.key === "customers" && item.label === "Clients")
      ? "Clients"
      : navigationGroupLabels[key];
    return groupItems.length > 0
      ? [{ key, label, items: groupItems }]
      : [];
  });
}
