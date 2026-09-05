import { Tabs } from "@/components/ui/tabs";

export default async function Layout({children,params}:{children:React.ReactNode;params:Promise<{vehicleId:string}>}){const{vehicleId}=await params;return <><Tabs id="vehicle-sections-navigation" ariaLabel="Vehicle sections" className="mx-auto mb-4 max-w-5xl" items={[{id:`vehicle-overview-tab-${vehicleId}`,label:"Overview",href:`/dashboard/vehicles/${vehicleId}`},{id:`vehicle-history-tab-${vehicleId}`,label:"History & timeline",href:`/dashboard/vehicles/${vehicleId}/history`}]}/>{children}</>}
