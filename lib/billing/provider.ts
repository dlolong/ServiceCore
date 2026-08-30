import "server-only";
export type CheckoutInput={organizationId:string;planId:string;priceId:string;interval:"month"|"year";customerId?:string;email:string;successUrl:string;cancelUrl:string;trialDays?:number};
export interface BillingProvider{createCheckout(input:CheckoutInput):Promise<string>;createPortal(customerId:string,returnUrl:string):Promise<string>}
