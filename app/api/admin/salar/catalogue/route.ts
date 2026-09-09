import { NextResponse } from 'next/server';
import { isExistingPrimeHubAdminRequest } from '@/lib/salar/adminAuth';
import { readIndexMeta, refreshSalarCatalogue } from '@/lib/salar/catalogIndex';
export const runtime='nodejs'; export const dynamic='force-dynamic'; export const maxDuration=60;
export async function GET(request:Request){ if(!isExistingPrimeHubAdminRequest(request)) return NextResponse.json({error:'Authentication required.'},{status:401}); try{return NextResponse.json({meta:await readIndexMeta()},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Unable to load catalogue status.'},{status:500});} }
export async function POST(request:Request){ if(!isExistingPrimeHubAdminRequest(request)) return NextResponse.json({error:'Authentication required.'},{status:401}); try{return NextResponse.json(await refreshSalarCatalogue(request));}catch{return NextResponse.json({error:'Catalogue Refresh failed.'},{status:500});} }
