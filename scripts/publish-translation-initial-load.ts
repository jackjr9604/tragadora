import { createClient } from '@supabase/supabase-js'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())
void main().catch((error)=>{console.error(`[initial-load-publish] ${error instanceof Error?error.message:'Error inesperado'}`);process.exitCode=1})

async function main(){
  const args=parse(process.argv.slice(2));const url=required('NEXT_PUBLIC_SUPABASE_URL');const key=required('SUPABASE_SERVICE_ROLE_KEY')
  const ref=new URL(url).hostname.split('.')[0];if(!args.execute||!args.allowProduction||args.confirmProjectRef!==ref||process.env.TRANSLATION_INITIAL_LOAD_APPROVED!==args.runId)throw new Error('Destino bloqueado: faltan las confirmaciones exactas de ejecución.')
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});let total=0
  for(;;){const {data,error}=await db.rpc('translation_initial_load_publish',{p_run_id:args.runId,p_limit:args.batchSize});if(error)throw new Error(error.message);const row=data as {published:number;failed:number;quarantined?:number;remaining:number};const quarantined=Number(row.quarantined??row.failed??0);total+=Number(row.published??0);console.log(`[initial-load-publish] ${JSON.stringify({...row,quarantined,totalPublished:total})}`);if(Number(row.remaining??0)===0)break;if(Number(row.published??0)===0&&quarantined===0)throw new Error('El lote no avanzó; se detiene para preservar integridad.')}
}
function parse(argv:string[]){const value=(n:string)=>{const i=argv.indexOf(n);return i>=0?argv[i+1]:undefined};const runId=value('--run-id');if(!runId?.match(/^[0-9a-f-]{36}$/i))throw new Error('--run-id UUID es obligatorio.');const batch=Number.parseInt(value('--batch-size')??'100',10);return{runId,batchSize:Number.isInteger(batch)&&batch>=1&&batch<=100?batch:100,execute:argv.includes('--execute'),allowProduction:argv.includes('--allow-production'),confirmProjectRef:value('--confirm-project-ref')}}
function required(name:string){const value=process.env[name]?.trim();if(!value)throw new Error(`Falta ${name}.`);return value}
