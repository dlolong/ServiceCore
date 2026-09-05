import { Tabs } from "@/components/ui/tabs";

export default async function Layout({children,params}:{children:React.ReactNode;params:Promise<{jobId:string}>}) { const {jobId}=await params; return <><Tabs id="job-order-sections-navigation" ariaLabel="Job sections" className="mx-auto mb-4 max-w-6xl print:hidden" items={[{id:`job-order-overview-tab-${jobId}`,label:"Overview",href:`/dashboard/jobs/${jobId}`},{id:`job-order-work-tab-${jobId}`,label:"Work & approvals",href:`/dashboard/jobs/${jobId}/work`}]}/>{children}</>; }
