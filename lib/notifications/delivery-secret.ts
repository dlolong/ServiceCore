import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM="aes-256-gcm";
const KEY_BYTES=32;

export type EncryptedDeliverySecret={
  ciphertext:string;
  initializationVector:string;
  authenticationTag:string;
};

function decodeKey(encodedKey:string){
  const key=Buffer.from(encodedKey,"base64");
  if(key.length!==KEY_BYTES)throw new Error("NOTIFICATION_LINK_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}

export function encryptDeliverySecret(value:string,encodedKey:string):EncryptedDeliverySecret{
  const initializationVector=randomBytes(12);
  const cipher=createCipheriv(ALGORITHM,decodeKey(encodedKey),initializationVector);
  const ciphertext=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  return{
    ciphertext:ciphertext.toString("base64"),
    initializationVector:initializationVector.toString("base64"),
    authenticationTag:cipher.getAuthTag().toString("base64"),
  };
}

export function decryptDeliverySecret(secret:EncryptedDeliverySecret,encodedKey:string){
  const decipher=createDecipheriv(ALGORITHM,decodeKey(encodedKey),Buffer.from(secret.initializationVector,"base64"));
  decipher.setAuthTag(Buffer.from(secret.authenticationTag,"base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext,"base64")),
    decipher.final(),
  ]).toString("utf8");
}
