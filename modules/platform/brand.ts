export const productBrand = {
  name: "NegOSu",
  shortName: "NegOSu",
  tagline: "The Operating System for Your Negosyo.",
  description:
    "Manage customers, appointments, staff, services, inventory, payments, and daily operations from one business operating system.",
} as const;

export const supportedVerticalKeys = ["automotive", "salon"] as const;
export type SupportedVerticalKey = (typeof supportedVerticalKeys)[number];

export const verticalBrands = {
  automotive: {
    displayName: "NegOSu Automotive",
    shortName: "Automotive",
    path: "/automotive",
    signupPath: "/signup?industry=automotive",
    loginPath: "/login?industry=automotive",
  },
  salon: {
    displayName: "NegOSu Salon & Beauty",
    shortName: "Salon & Beauty",
    path: "/salon",
    signupPath: "/signup?industry=salon",
    loginPath: "/login?industry=salon",
  },
} as const satisfies Record<
  SupportedVerticalKey,
  {
    displayName: string;
    shortName: string;
    path: string;
    signupPath: string;
    loginPath: string;
  }
>;
