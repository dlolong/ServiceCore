import Image from "next/image";

import { cn } from "@/lib/utils";
import { productBrand } from "@/modules/platform/brand";

type BrandWordmarkProps = {
  className?: string;
  inverse?: boolean;
};

export function BrandWordmark({ className, inverse = false }: BrandWordmarkProps) {
  return (
    <Image
      src={inverse ? "/images/NegOSu_logo_light.png" : "/images/NegOSu_logo_dark.png"}
      alt={productBrand.name}
      width={inverse ? 1916 : 2172}
      height={inverse ? 821 : 724}
      className={cn("h-auto w-28 object-contain object-left", className)}
    />
  );
}
