export function privateEstimateResponseHeaders(pathname:string){
  if(!pathname.startsWith("/estimate/"))return null;
  return{
    "Cache-Control":"private, no-store, max-age=0",
    Pragma:"no-cache",
    "X-Robots-Tag":"noindex, nofollow, noarchive",
  } as const;
}
