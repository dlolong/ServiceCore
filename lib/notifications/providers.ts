import type { NotificationChannel } from "@/lib/notifications/eligibility";

export type DeliveryProviderMessage={
  notificationId:string;
  to:string;
  subject?:string;
  body:string;
  idempotencyKey:string;
  templateKey:string;
};

export type DeliveryProviderResult={accepted:boolean;providerMessageId?:string|null};

export interface NotificationDeliveryProvider{
  readonly name:string;
  readonly configured:boolean;
  send(message:DeliveryProviderMessage):Promise<DeliveryProviderResult>;
}

export class DeliveryProviderError extends Error{
  constructor(public readonly code:string,message:string,public readonly retryable:boolean){super(message);this.name="DeliveryProviderError";}
}

export class DisabledDeliveryProvider implements NotificationDeliveryProvider{
  readonly name="disabled";readonly configured=false;
  async send(message:DeliveryProviderMessage):Promise<DeliveryProviderResult>{
    void message;
    throw new DeliveryProviderError("CHANNEL_DISABLED","Delivery provider is not configured.",false);
  }
}

export class ConsoleDeliveryProvider implements NotificationDeliveryProvider{
  readonly configured=true;
  constructor(public readonly name:string,private readonly channel:NotificationChannel){}
  async send(message:DeliveryProviderMessage):Promise<DeliveryProviderResult>{
    console.info("notification.dev_delivery",{
      operation:"provider_accept",notificationId:message.notificationId,channel:this.channel,
      template:message.templateKey,recipient:maskRecipient(message.to),
    });
    return{accepted:true,providerMessageId:`dev-${message.notificationId}`};
  }
}

function maskRecipient(value:string){
  if(value.includes("@")){
    const[local,domain]=value.split("@");
    return `${local.slice(0,1)}***@${domain}`;
  }
  return `${value.slice(0,3)}******${value.slice(-2)}`;
}

export type ProviderSelection="disabled"|"console";
export type DeliveryProviders={email:NotificationDeliveryProvider;sms:NotificationDeliveryProvider};

function selectProvider(channel:NotificationChannel,selection:ProviderSelection|undefined,nodeEnvironment:string|undefined){
  if(selection==="console"&&nodeEnvironment!=="production")return new ConsoleDeliveryProvider(`console-${channel}`,channel);
  return new DisabledDeliveryProvider();
}

export function createDeliveryProviders(config:{emailProvider?:ProviderSelection;smsProvider?:ProviderSelection;nodeEnvironment?:string}):DeliveryProviders{
  return{
    email:selectProvider("email",config.emailProvider,config.nodeEnvironment),
    sms:selectProvider("sms",config.smsProvider,config.nodeEnvironment),
  };
}
