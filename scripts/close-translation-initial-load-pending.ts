import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

loadEnvConfig(process.cwd())
void main().catch((error) => { console.error(`[close-pending] ${error instanceof Error ? error.message : 'Error inesperado'}`); process.exitCode = 1 })

async function main() {
  const args=parse(process.argv.slice(2));const url=required('NEXT_PUBLIC_SUPABASE_URL');const key=required('SUPABASE_SERVICE_ROLE_KEY')
  const ref=new URL(url).hostname.split('.')[0];if(!args.execute||!args.allowProduction||args.confirmProjectRef!==ref||process.env.TRANSLATION_INITIAL_LOAD_APPROVED!==args.runId)throw new Error('Destino bloqueado: faltan confirmaciones exactas.')
  const report=JSON.parse(readFileSync(args.report,'utf8')) as {corrections:Correction[]}
  const unsafe=report.corrections.filter((item)=>item.corrected_qa.status==='failed');if(unsafe.length)throw new Error(`${unsafe.length} grupos todavía fallan QA.`)
  const items=report.corrections.flatMap((group)=>group.members.map((member)=>({state_id:member.state_id,expected_lock_version:member.lock_version,source_hash:group.source_hash,source_revision:member.source_revision,value:group.corrected_value})))
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});let published=0,skipped=0,errors=0
  for(let index=0;index<items.length;index+=25){const batch=items.slice(index,index+25);const result=await db.rpc('translation_initial_load_close_pending',{p_run_id:args.runId,p_items:batch});if(result.error)throw new Error(result.error.message);const row=result.data as {published:number;skipped:number;errors:number;items:unknown[]};published+=Number(row.published);skipped+=Number(row.skipped);errors+=Number(row.errors);console.log(`[close-pending] ${JSON.stringify({batch:index/25+1,...row,totalPublished:published,totalSkipped:skipped,totalErrors:errors})}`)}
  console.log(`[close-pending] final ${JSON.stringify({selected:items.length,published,skipped,errors})}`)
}
function parse(argv:string[]){const value=(name:string)=>{const index=argv.indexOf(name);return index>=0?argv[index+1]:undefined};const runId=value('--run-id'),report=value('--report');if(!runId?.match(/^[0-9a-f-]{36}$/i)||!report)throw new Error('--run-id y --report son obligatorios.');return{runId,report,execute:argv.includes('--execute'),allowProduction:argv.includes('--allow-production'),confirmProjectRef:value('--confirm-project-ref')}}
function required(name:string){const value=process.env[name]?.trim();if(!value)throw new Error(`Falta ${name}.`);return value}
type Correction={source_hash:string;corrected_value:unknown;corrected_qa:{status:'passed'|'requires_review'|'failed'};members:{state_id:string;lock_version:number;source_revision:number}[]}
