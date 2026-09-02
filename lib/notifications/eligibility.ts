export type NotificationChannel="email"|"sms";
export type DeliveryEligibilityReason=
  |"ELIGIBLE"
  |"EMAIL_MISSING"
  |"EMAIL_INVALID"
  |"EMAIL_OPTED_OUT"
  |"SMS_MISSING"
  |"SMS_INVALID"
  |"SMS_OPTED_OUT";

export type DeliveryEligibility={eligible:true;reason:"ELIGIBLE"}|{eligible:false;reason:Exclude<DeliveryEligibilityReason,"ELIGIBLE">};

export function normalizeNotificationEmail(value:string|null|undefined){
  const normalized=value?.trim().toLowerCase()??"";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)?normalized:null;
}

export function normalizePhilippineMobile(value:string|null|undefined){
  const digits=(value??"").replace(/\D/g,"");
  if(/^09\d{9}$/.test(digits))return `+63${digits.slice(1)}`;
  if(/^639\d{9}$/.test(digits))return `+${digits}`;
  return null;
}

export function evaluateNotificationDeliveryEligibility(input:{channel:NotificationChannel;recipientAddress:string|null;optedIn:boolean}):DeliveryEligibility{
  if(input.channel==="email"){
    if(!input.recipientAddress)return{eligible:false,reason:"EMAIL_MISSING"};
    if(!normalizeNotificationEmail(input.recipientAddress))return{eligible:false,reason:"EMAIL_INVALID"};
    if(!input.optedIn)return{eligible:false,reason:"EMAIL_OPTED_OUT"};
  }else{
    if(!input.recipientAddress)return{eligible:false,reason:"SMS_MISSING"};
    if(!normalizePhilippineMobile(input.recipientAddress))return{eligible:false,reason:"SMS_INVALID"};
    if(!input.optedIn)return{eligible:false,reason:"SMS_OPTED_OUT"};
  }
  return{eligible:true,reason:"ELIGIBLE"};
}
