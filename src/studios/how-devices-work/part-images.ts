import images from './part-images.json';
import identities from './part-identities.json';
export interface PartImage {src:string;kind:string;caption:string;family?:string;thumbnail?:string;preview?:string;sourceUrl?:string;sourceTitle?:string;attribution?:string;license?:string;licenseUrl?:string}
const library=images as unknown as {byId:Record<string,PartImage>;byUsage:Record<string,PartImage>};
export function partImage(deviceId:string,name:string):PartImage|undefined{
 const key=`${deviceId}::${name}`;
 const id=(identities as Record<string,string>)[key];
 return library.byUsage[key]??library.byId[id??''];
}

