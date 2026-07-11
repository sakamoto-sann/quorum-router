import concurrent.futures, datetime, json, os, subprocess, tempfile, time

MODELS={"mini":"gpt-5.4-mini","sol":"gpt-5.6-sol","editor":"gpt-5.4"}
TASKS=[
 {"id":"deploy","prompt":"Design a production database migration rollout that adds a required column to a 500M-row table with continuous writes. Give a concise executable plan under 180 words.","rubric":[["expand","nullable"],["backfill","batch"],["dual write","compatib"],["canary","percentage"],["rollback","revert"],["observability","metric","monitor"]]},
 {"id":"typescript","prompt":"Review this TypeScript and give the root cause, minimal safe patch, and regression tests under 180 words:\nfunction parseLimit(value: number | null | undefined) { if (!value) throw new Error('missing'); return Math.min(value, 100); }\nRequirements: zero is valid; null/undefined are missing; negative values are invalid.","rubric":[["falsy","!value"],["null","undefined","== null"],["negative","< 0"],["zero","0"],["nan","finite"],["test","regression"]]},
 {"id":"webhook","prompt":"Design verification for a payment webhook before any state mutation. Give a concise implementation checklist under 180 words, covering authenticity, replay resistance, and duplicate delivery.","rubric":[["hmac","signature"],["raw body","raw payload"],["constant-time","timing-safe"],["timestamp","window"],["nonce","replay"],["idempotency","event id","duplicate"]]},
]

def call(model,prompt):
    fd,out=tempfile.mkstemp(prefix='qr-bench-',suffix='.txt'); os.close(fd)
    cmd=['codex','exec','-m',model,'-s','read-only','--ephemeral','--skip-git-repo-check','--ignore-user-config','--ignore-rules','--json','-o',out,'-']
    start=time.time()
    p=subprocess.run(cmd,input=prompt,text=True,capture_output=True,timeout=240,cwd='/tmp')
    text=open(out).read().strip() if os.path.exists(out) else ''; os.unlink(out)
    usage={}
    for line in p.stdout.splitlines():
      try:
       event=json.loads(line)
       if event.get('type')=='turn.completed': usage=event.get('usage',{})
      except: pass
    if p.returncode or not text: raise RuntimeError(f'{model} failed: {p.stderr[-300:]} {p.stdout[-300:]}')
    return {'text':text,'usage':usage,'latency_s':round(time.time()-start,2),'model':model}

def total_usage(calls):
  keys=['input_tokens','cached_input_tokens','output_tokens','reasoning_output_tokens']
  return {k:sum(int(c.get('usage',{}).get(k,0)) for c in calls) for k in keys}

def score(text,rubric):
  low=text.lower(); return sum(any(term in low for term in group) for group in rubric)

def run_task(task):
  single=call(MODELS['mini'],task['prompt'])
  with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
    a=ex.submit(call,MODELS['mini'],task['prompt']); b=ex.submit(call,MODELS['sol'],task['prompt'])
    candidates=[a.result(),b.result()]
  labels=[f"{c['model']}: {c['text']}" for c in candidates]
  judge=call(MODELS['editor'],"Compare these independent answers. Return JSON only with keys agreements (array), disagreements (array), strengths (array), rejected_claims (array), missing_checks (array).\nQUESTION:\n"+task['prompt']+"\nANSWERS:\n"+'\n\n'.join(labels))
  editor=call(MODELS['editor'],"Produce the best final answer under 180 words using the candidates and structured judge. Resolve conflicts; do not mention the evaluation process.\nQUESTION:\n"+task['prompt']+"\nCANDIDATES:\n"+'\n\n'.join(labels)+"\nJUDGE:\n"+judge['text'])
  fusion_calls=candidates+[judge,editor]
  turns=[]; history=''
  for i,model in enumerate([MODELS['mini'],MODELS['sol'],MODELS['mini'],MODELS['sol']]):
    role=['Propose a solution','Critique the prior proposal and identify omissions','Revise the solution after the critique','Give the final converged answer under 180 words'][i]
    prompt=f"{role}.\nQUESTION:\n{task['prompt']}\n"+(f"CONVERSATION:\n{history}" if history else '')
    turn=call(model,prompt); turns.append(turn); history += f"\n{model}: {turn['text']}\n"
  answers={'single-model':single['text'],'best-route':editor['text'],'agent-chat':turns[-1]['text']}
  calls={'single-model':[single],'best-route':fusion_calls,'agent-chat':turns}
  return {'id':task['id'],'scores':{k:score(v,task['rubric']) for k,v in answers.items()},'max_score':len(task['rubric']),'usage':{k:total_usage(v) for k,v in calls.items()},'calls':{k:len(v) for k,v in calls.items()},'answers':answers}

results=[]
for task in TASKS:
 print('running',task['id'],flush=True); results.append(run_task(task))
strategies=['single-model','best-route','agent-chat']; wins={s:0.0 for s in strategies}
for r in results:
 top=max(r['scores'].values()); tied=[s for s in strategies if r['scores'][s]==top]
 for s in tied:wins[s]+=1/len(tied)
summary={}
for s in strategies:
 summary[s]={
  'win_rate_pct':round(100*wins[s]/len(results),1),
  'mean_rubric_pct':round(100*sum(r['scores'][s]/r['max_score'] for r in results)/len(results),1),
  'mean_calls':sum(r['calls'][s] for r in results)/len(results),
  'mean_input_tokens':round(sum(r['usage'][s]['input_tokens'] for r in results)/len(results)),
  'mean_cached_input_tokens':round(sum(r['usage'][s]['cached_input_tokens'] for r in results)/len(results)),
  'mean_output_tokens':round(sum(r['usage'][s]['output_tokens'] for r in results)/len(results)),
 }
payload={'run_date':datetime.datetime.now(datetime.timezone.utc).date().isoformat(),'models':MODELS,'tasks':len(TASKS),'results':results,'summary':summary,'notes':['Real Codex CLI OAuth-backed calls; no API-key fallback.','Win ties split equally.','Token counts are provider-reported; dollar cost unavailable for ChatGPT OAuth.']}
output_path=os.environ.get('QUORUM_BENCH_OUTPUT','docs/bench-results.json')
open(output_path,'w').write(json.dumps(payload,indent=2)+"\n")
print(json.dumps(summary,indent=2))
