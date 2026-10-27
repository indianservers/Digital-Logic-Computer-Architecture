import { next } from '@vercel/functions';
import { publicUrl } from './urls';

/** Runs before filesystem routing, including on legacy URLs with query parameters. */
export default function proxy(request:Request) {
  if(request.method!=='GET'&&request.method!=='HEAD')return next();
  const url=new URL(request.url);
  const input=url.pathname+url.search;
  const canonical=publicUrl(input);
  if(canonical!==input)return new Response(null,{status:308,headers:{Location:canonical}});
  return next();
}
