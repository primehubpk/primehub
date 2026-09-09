import { NextResponse } from 'next/server';
import { isExistingPrimeHubAdminRequest } from '@/lib/salar/adminAuth';
import { createBrainFile, listBrainFiles } from '@/lib/salar/brainStore';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function GET(request:Request){ if(!isExistingPrimeHubAdminRequest(request)) return NextResponse.json({error:'Authentication required.'},{status:401}); try{return NextResponse.json({files:await listBrainFiles()},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Unable to load Salar brain files.'},{status:500});} }
export async function POST(request:Request){ if(!isExistingPrimeHubAdminRequest(request)) return NextResponse.json({error:'Authentication required.'},{status:401}); try{return NextResponse.json({file:await createBrainFile()});}catch{return NextResponse.json({error:'Unable to create Salar brain file.'},{status:500});} }
