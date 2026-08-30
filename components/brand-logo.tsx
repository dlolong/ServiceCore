import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandLogo({ long = true, tone = "black", className, priority = false }: { long?: boolean; tone?: "black" | "white"; className?: string; priority?: boolean }) {
  const src = `/images/KarKR_logo_${tone}${long ? "_long" : ""}.png`;
  return <Image src={src} alt="KarKR" width={long ? 446 : 124} height={130} className={cn("h-auto object-contain", className)} priority={priority} />;
}
