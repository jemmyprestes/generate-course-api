import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { verifySignature, rawBody, sandbox, PRODUCTS } from '../lib/billing.js';
import checkout from '../api/create-checkout-session.js';
import webhook, { syncSubscription } from '../api/stripe-webhook.js';
import legacy from '../api/generate.js';

const uid = '00000000-0000-4000-8000-000000000001';
const uid2 = '00000000-0000-4000-8000-000000000002';
const oid = '00000000-0000-4000-8000-000000000003';
const cid = '00000000-0000-4000-8000-000000000004';
const rid = '00000000-0000-4000-8000-000000000005';
function response() { return { code: 200, headers: {}, setHeader(k,v) {this.headers[k]=v;}, status(c) {this.code=c;return this;}, json(v) {this.data=v;return this;}, end() {return this;} }; }
function env() { process.env.BILLING_SANDBOX='true';process.env.STRIPE_SECRET_KEY='sk_test_fixture';process.env.SUPABASE_URL='https://fixture.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';process.env.STRIPE_WEBHOOK_SECRET='whsec_fixture';delete process.env.VERCEL_ENV; }
const json = value => new Response(JSON.stringify(value), { status: 200 });

test('signed raw events: modified bytes, expired timestamps and missing signatures are rejected', async () => {
  const raw=Buffer.from('{"livemode":false}'); const now=1700000000000;
  const signature=createHmac('sha256','fixture').update('1700000000.').update(raw).digest('hex');
  assert.doesNotThrow(()=>verifySignature(raw,`t=1700000000,v1=${signature}`,'fixture',now));
  assert.throws(()=>verifySignature(Buffer.from('{}'),`t=1700000000,v1=${signature}`,'fixture',now));
  assert.throws(()=>verifySignature(raw,`t=1700000000,v1=${signature}`,'fixture',now+301000));
  assert.throws(()=>verifySignature(raw,undefined,'fixture',now));
  await assert.rejects(rawBody({body:{livemode:false}}));
});
test('sandbox rejects live keys and production; legacy generation closes when gates are enabled', async()=>{
  env(); process.env.STRIPE_SECRET_KEY='sk_live_fixture';assert.throws(sandbox);
  env(); process.env.VERCEL_ENV='production';assert.throws(sandbox);
  env();process.env.BILLING_ENFORCED='true';const res=response();
  await legacy({method:'POST',headers:{},body:{topic:'fixture'}},res);assert.equal(res.code,409);
  delete process.env.BILLING_ENFORCED;
});
test('checkout verifies identity, fixed catalog, metadata and idempotency before redirect', async t=>{
  env();const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
  let params;let key;const requests=[];
  globalThis.fetch=async (url,options={})=>{
    requests.push(String(url));
    if(String(url).endsWith('/auth/v1/user')) return json({id:uid});
    if(String(url).includes('/prices/'))return json({active:true,livemode:false,currency:'eur',unit_amount:699,type:'one_time'});
    if(String(url).includes('billing_create_order'))return json({id:oid});
    if(String(url).endsWith('/checkout/sessions')) {params=new URLSearchParams(options.body);key=options.headers['Idempotency-Key'];return json({id:'cs_test_fixture',livemode:false,url:'https://checkout.stripe.com/c/pay/fixture'});}
    if(String(url).includes('billing_attach_session'))return json(null);
    throw new Error('Unexpected request');
  };
  let res=response();await checkout({method:'POST',headers:{},body:{}},res);assert.equal(res.code,401);assert.equal(requests.length,0);
  res=response();await checkout({method:'POST',headers:{authorization:'Bearer fixture'},body:{product:'course',requestId:rid,userId:uid2,amount:1}},res);
  assert.equal(res.code,200);assert.equal(params.get('client_reference_id'),uid);assert.equal(params.get('metadata[user_id]'),uid);
  assert.equal(params.get('line_items[0][price]'),PRODUCTS.course.price);assert.equal(key,`elearn-sandbox-${oid}`);
});
test('webhook never grants unpaid checkout, retries failures, and rejects invalid signatures', async t=>{
  env();const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);let grants=0;let paid=false;let dbFailure=false;
  globalThis.fetch=async url=>{
    if(String(url).includes('/checkout/sessions/'))return json({id:'cs_test_fixture',livemode:false,metadata:{order_id:oid,user_id:uid,product:'course',course_id:''},client_reference_id:uid,mode:'payment',currency:'eur',amount_total:699,status:'complete',payment_status:paid?'paid':'unpaid',payment_intent:'pi_fixture',line_items:{data:[{price:{id:PRODUCTS.course.price},quantity:1}],has_more:false}});
    if(String(url).includes('billing_orders?'))return json([{id:oid,user_id:uid,product:'course',course_id:null,session_id:'cs_test_fixture'}]);
    if(String(url).includes('billing_fulfill_order')){if(dbFailure)return new Response('{}',{status:503});grants++;return json(null);}
    throw new Error('Unexpected request');
  };
  const event={id:'evt_fixture',type:'checkout.session.completed',created:Math.floor(Date.now()/1000),livemode:false,data:{object:{id:'cs_test_fixture'}}};
  const raw=Buffer.from(JSON.stringify(event));const stamp=String(event.created);
  const sig=createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET).update(`${stamp}.`).update(raw).digest('hex');
  const req={method:'POST',body:raw,headers:{'stripe-signature':`t=${stamp},v1=${sig}`}};
  let res=response();await webhook(req,res);assert.equal(res.code,200);assert.equal(grants,0);
  paid=true;res=response();await webhook(req,res);assert.equal(res.code,200);assert.equal(grants,1);
  dbFailure=true;res=response();await webhook(req,res);assert.equal(res.code,503);assert.equal(grants,1);
  dbFailure=false;res=response();await webhook(req,res);assert.equal(res.code,200);assert.equal(grants,2);
  res=response();await webhook({...req,headers:{}},res);assert.equal(res.code,400);assert.equal(grants,2);
});

test('subscription grants only the paid invoice period and does not extend unpaid renewals', async t=>{
  env();const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);let paid=true;let recorded;
  globalThis.fetch=async (url,options={})=>{
    if(String(url).includes('/subscriptions/'))return json({id:'sub_1',livemode:false,status:'active',metadata:{order_id:oid,user_id:uid,product:'plus',course_id:''},items:{data:[{price:{id:PRODUCTS.plus.price},quantity:1}],has_more:false},latest_invoice:{id:'in_1',status:paid?'paid':'open',currency:'eur',amount_paid:paid?1499:0,livemode:false}});
    if(String(url).includes('billing_orders?'))return json([{id:oid,user_id:uid,product:'plus',course_id:null}]);
    if(String(url).includes('/invoices/'))return json({has_more:false,data:[{pricing:{price_details:{price:PRODUCTS.plus.price}},parent:{subscription_item_details:{subscription:'sub_1'}},amount:1499,period:{end:1800000000}}]});
    if(String(url).includes('billing_sync_subscription')){recorded=JSON.parse(options.body);return json(null);}
    throw new Error('Unexpected request');
  };
  await syncSubscription('sub_1',{id:'evt_1',created:100});assert.equal(recorded.p_paid_until,new Date(1800000000000).toISOString());
  paid=false;await syncSubscription('sub_1',{id:'evt_2',created:200});assert.equal(recorded.p_paid_until,null);
});

test('Postgres migration: atomic credits, retries, quotas, certificate ownership, privileges and deferred bypass guard', async()=>{
  const pg=new PGlite();
  try {
    await pg.exec(`create role anon;create role authenticated;create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create table public.courses(id uuid primary key,user_id uuid,content text);
      create table public.course_tests(test_id text,user_id uuid,course_id uuid,passed boolean);
      create table public.course_test_keys(test_id text,answers jsonb);
      create table public.course_generation_jobs(id uuid primary key default gen_random_uuid(),user_id uuid,request_data jsonb,total_modules integer default 6);
      create function public.start_or_resume_course_generation(p_user_id uuid,p_request_data jsonb) returns jsonb language plpgsql as $$
      declare job uuid;begin
        select id into job from public.course_generation_jobs where user_id=p_user_id and request_data=p_request_data;
        if found then return jsonb_build_object('jobId',job,'created',false);end if;
        insert into public.course_generation_jobs(user_id,request_data) values(p_user_id,p_request_data) returning id into job;
        return jsonb_build_object('jobId',job,'created',true);end $$;
      insert into auth.users values('${uid}'),('${uid2}');insert into courses values('${cid}','${uid}','fixture');`);
    await pg.exec(await readFile(new URL('../supabase/migrations/202611050001_billing_sandbox.sql',import.meta.url),'utf8'));
    await pg.exec(await readFile(new URL('../supabase/activate-sandbox.sql',import.meta.url),'utf8'));
    const query=(sql,args=[])=>pg.query(sql,args);
    await assert.rejects(query(`select billing_start_generation($1,'{"topic":"one"}')`,[uid]),/BILLING_PAYMENT_REQUIRED/);
    assert.equal((await query('select count(*)::int n from course_generation_jobs')).rows[0].n,0);
    await query('select billing_create_order($1,$2,$3,$4,null)',[oid,uid,rid,'course']);
    await query('select billing_fulfill_order($1,$2,$3,$4)',[oid,'cs_test_fixture','evt_1','pi_1']);
    await query('select billing_fulfill_order($1,$2,$3,$4)',[oid,'cs_test_fixture','evt_2','pi_1']);
    const first=await query(`select billing_start_generation($1,'{"topic":"one"}') result`,[uid]);
    const resume=await query(`select billing_start_generation($1,'{"topic":"one"}') result`,[uid]);
    assert.equal(first.rows[0].result.jobId,resume.rows[0].result.jobId);
    await assert.rejects(query(`select billing_start_generation($1,'{"topic":"two"}')`,[uid]),/BILLING_PAYMENT_REQUIRED/);
    await assert.rejects(query(`insert into course_generation_jobs(user_id,request_data) values($1,'{}')`,[uid]),/BILLING_PAYMENT_REQUIRED/);
    assert.equal((await query('select count(*)::int n from billing_generation_usage')).rows[0].n,1);
    assert.equal((await query(`select has_function_privilege('authenticated','billing_start_generation(uuid,jsonb)','execute') ok`)).rows[0].ok,false);
    assert.equal((await query(`select has_table_privilege('authenticated','billing_orders','insert') ok`)).rows[0].ok,false);
    await query(`select billing_create_order(gen_random_uuid(),$1,gen_random_uuid(),'certificate',$2)`,[uid,cid]);
    await query(`update billing_orders set paid=true where product='certificate'`);
    await query(`insert into course_tests values('test_1',$1,$2,true)`,[uid,cid]);
    assert.equal((await query('select billing_certificate_access($1,$2) ok',[uid,cid])).rows[0].ok,false);
    await query(`insert into billing_test_bindings values('test_1',$1,$2)`,[uid,cid]);
    assert.equal((await query('select billing_certificate_access($1,$2) ok',[uid,cid])).rows[0].ok,true);
    assert.equal((await query('select billing_certificate_access($1,$2) ok',[uid2,cid])).rows[0].ok,false);
    assert.equal((await query('select plus_courses_per_period n,plus_certificates cert from billing_settings')).rows[0].n,5);
    assert.equal((await query('select plus_certificates cert from billing_settings')).rows[0].cert,true);
    await query('update billing_settings set plus_courses_per_period=1,plus_certificates=false');
    const plus=(await query(`select billing_create_order(gen_random_uuid(),$1,gen_random_uuid(),'plus',null) o`,[uid])).rows[0].o;
    await query(`select billing_sync_subscription($1,'sub_1','active',now()+interval '1 month','evt_3',100)`,[plus.id]);
    await query(`select billing_start_generation($1,'{"topic":"plus-one"}')`,[uid]);
    await assert.rejects(query(`select billing_start_generation($1,'{"topic":"plus-two"}')`,[uid]),/BILLING_PAYMENT_REQUIRED/);
    await query(`select billing_sync_subscription($1,'sub_1','canceled',null,'evt_4',200)`,[plus.id]);
    await query(`select billing_sync_subscription($1,'sub_1','active',now()+interval '2 months','evt_old',150)`,[plus.id]);
    assert.equal((await query(`select revoked from billing_subscriptions where id='sub_1'`)).rows[0].revoked,true);
    for(let n=0;n<3;n++) await query('select billing_reserve_test_attempt($1,$2)',[uid,cid]);
    await assert.rejects(query('select billing_reserve_test_attempt($1,$2)',[uid,cid]),/limit exceeded/);
    for(let n=0;n<14;n++)await query('select billing_reserve_generation_attempt($1,$2)',[first.rows[0].result.jobId,uid]);
    await assert.rejects(query('select billing_reserve_generation_attempt($1,$2)',[first.rows[0].result.jobId,uid]),/limit exceeded/);
  } finally { await pg.close(); }
});
