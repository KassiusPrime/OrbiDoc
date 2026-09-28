import type {VoiceRuntime} from './voiceRuntime.js';import type {AudioArtifact,AudioChunk,CloneVoiceRequest,SynthesizeRequest,Transcript,TranscribeRequest,VoiceLanguage,VoiceProfile,VoiceRuntimeStatus} from './voiceTypes.js';

const base=()=>String(process.env.VOICE_STUDIO_URL??'').trim().replace(/\/$/,'');
async function request(path:string,init:RequestInit={},signal?:AbortSignal){const url=base();if(!url)throw new Error('VOICE_STUDIO_URL não configurada.');const c=new AbortController();const t=setTimeout(()=>c.abort(new Error('VOICE_STUDIO_TIMEOUT')),15000);const abort=()=>c.abort(signal?.reason);if(signal)signal.addEventListener('abort',abort,{once:true});try{const h=new Headers(init.headers);h.set('Accept','application/json');if(process.env.VOICE_STUDIO_API_KEY)h.set('Authorization',`Bearer ${process.env.VOICE_STUDIO_API_KEY}`);return await fetch(`${url}${path}`,{...init,headers:h,signal:c.signal})}finally{clearTimeout(t);signal?.removeEventListener('abort',abort)}}
async function json<T>(path:string,init?:RequestInit,signal?:AbortSignal){const r=await request(path,init,signal);const b=await r.text();if(!r.ok)throw new Error(`VoiceStudio HTTP ${r.status}: ${b.slice(0,240)}`);return JSON.parse(b) as T}

export function createVoiceStudioRuntime():VoiceRuntime{return{
  async status():Promise<VoiceRuntimeStatus>{
    if(!base())return{enabled:false,available:false,provider:'none',capabilities:{tts:false,stt:false,streamingTts:false,voiceCloning:false},reason:'VOICE_STUDIO_URL não configurada.'};
    try{
      const d=await json<{version?:unknown}>('/health');
      return{enabled:process.env.VOICE_STUDIO_ENABLED==='true',available:true,provider:'voicestudio',version:typeof d.version==='string'?d.version:undefined,capabilities:{tts:true,stt:true,streamingTts:false,voiceCloning:true}};
    }catch(e){
      return{enabled:process.env.VOICE_STUDIO_ENABLED==='true',available:false,provider:'voicestudio',capabilities:{tts:false,stt:false,streamingTts:false,voiceCloning:false},reason:e instanceof Error?e.message:'VoiceStudio indisponível.'};
    }
  },
  async listVoices(){const d=await json<{data?:Array<{id?:unknown;name?:unknown;language?:unknown;kind?:unknown;engine?:unknown}>}>('/v1/audio/voices');return (Array.isArray(d.data)?d.data:[]).filter(v=>typeof v.id==='string').map(v=>({id:String(v.id),name:typeof v.name==='string'?v.name:String(v.id),language:typeof v.language==='string'?v.language:undefined,kind:v.kind==='cloned'||v.kind==='designed'?v.kind:'local',engine:typeof v.engine==='string'?v.engine:undefined}));},
  async listLanguages(){const voices=await this.listVoices();const seen=new Map<string,string>();voices.forEach(v=>{if(v.language&&!seen.has(v.language))seen.set(v.language,v.language)});return Array.from(seen,([code,name])=>({code,name}));},
  async synthesize(_input:SynthesizeRequest,_s?:AbortSignal){throw new Error('TTS binário será conectado ao endpoint OpenAI-compatible /v1/audio/speech na Fase 10.');},
  async transcribe(input:TranscribeRequest,s?:AbortSignal){return json<Transcript>('/v1/audio/transcriptions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)},s)},
  async cloneVoice(input:CloneVoiceRequest,_s?:AbortSignal){if(!input.consentConfirmed)throw new Error('A clonagem de voz exige confirmação explícita de consentimento.');throw new Error('Clonagem será conectada ao POST /profiles com multipart na Fase 10.');},
  async streamTTS(_i:SynthesizeRequest,_c:(x:AudioChunk)=>void){throw new Error('Streaming TTS será habilitado na Fase 13.')}
}}
