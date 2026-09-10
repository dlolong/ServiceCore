import { Tabs, type TabItem } from "@/components/ui/tabs";
import { getDashboardContext } from "@/lib/auth/context";

export default async function Layout({children}:{children:React.ReactNode}){
  const{activeMembership}=await getDashboardContext();
  const salon=activeMembership.industry==="salon";
  const prefix=salon?"salon-settings":"settings";
  const items:TabItem[]=[
    {id:`${prefix}-tab-profile`,label:"Profile",href:"/dashboard/settings"},
    {id:`${prefix}-tab-branches`,label:"Branches",href:"/dashboard/settings/branches"},
    {id:`${prefix}-tab-staff`,label:"Staff",href:"/dashboard/settings/staff"},
    {id:`${prefix}-tab-resources`,label:salon?"Resources":"Service bays",href:"/dashboard/settings/resources"},
    {id:`${prefix}-tab-public-page`,label:"Public page",href:"/dashboard/settings/public-page"},
    {id:`${prefix}-tab-billing`,label:"Billing",href:"/dashboard/settings/billing"},
  ];
  return <><Tabs id={salon?"salon-settings-navigation":"settings-sections-navigation"} ariaLabel="Settings sections" className="mx-auto mb-4 max-w-6xl" items={items}/>{children}</>;
}
