import { NextResponse } from 'next/server';
import { isExistingPrimeHubAdminRequest } from '@/lib/salar/adminAuth';
import { saveBrainFile } from '@/lib/salar/brainStore';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function PUT(request:Request,{params}:{params:{id:string}}){ if(!isExistingPrimeHubAdminRequest(request)) return NextResponse.json({error:'Authentication required.'},{status:401}); try{const body=await request.json().catch(()=>null); const file=await saveBrainFile(String(params.id||''),body||{}); if(!file)return NextResponse.json({error:'Brain file not found.'},{status:404}); return NextResponse.json({file});}catch{return NextResponse.json({error:'Unable to save Salar brain file.'},{status:500});} }
