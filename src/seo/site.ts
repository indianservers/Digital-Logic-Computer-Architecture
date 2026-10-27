/** Public identity shared by browser metadata and the static publisher. */
export const SITE_ORIGIN = "https://digital.aimersociety.com";
export const SITE_NAME = "LogicLab";
export const PUBLISHER = "AIMER Society";
export function siteOrigin(value?:string) {
  const origin=(value || SITE_ORIGIN).replace(/\/$/, "");
  if(!/^https?:\/\/[^/]+$/.test(origin))throw new Error("VITE_SITE_URL must be an absolute HTTP(S) origin");
  return origin;
}
