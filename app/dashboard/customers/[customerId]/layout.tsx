import { Tabs } from "@/components/ui/tabs";

export default async function Layout({children,params}:{children:React.ReactNode;params:Promise<{customerId:string}>}){const{customerId}=await params;return <><Tabs id="customer-sections-navigation" ariaLabel="Customer sections" className="mx-auto mb-4 max-w-5xl" items={[{id:`customer-overview-tab-${customerId}`,label:"Overview",href:`/dashboard/customers/${customerId}`},{id:`customer-preferences-tab-${customerId}`,label:"Communication consent",href:`/dashboard/customers/${customerId}/preferences`}]}/>{children}</>}
