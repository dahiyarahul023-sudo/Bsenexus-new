import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildMap, impact, artifacts} from './spider-map.mjs';

function fixture(t) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spider-map-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const write=(p,c)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),c)};
 write('tsconfig.json',JSON.stringify({compilerOptions:{moduleResolution:'bundler',module:'esnext',baseUrl:'.',paths:{'@/*':['src/*']}}}));
 write('rule/domains.json',JSON.stringify({domains:[{id:'payments',reason:'Display and charge agree',files:['server/plan.ts','src/display.ts'],tests:['server/plan.test.ts']}]}));
 write('server/plan.ts','export const amount=10;');
 write('server/plan.test.ts',"import {amount} from './plan.js';");
 write('server/api.ts',"import {amount} from './plan.js'; export const cost=amount;");
 write('server.ts',"export * from './server/api.js';");
 write('src/display.ts','export const display=10;');
 write('src/client.ts',"import '@/display'; import './style.css'; const lazy=()=>import('../server/api.js'); const unknown=()=>import(variable); fetch('/api/payments'); router.post('/pay', requireAuth, handler); db.rpc('grant_payment_atomic'); process.env['MODE'];");
 write('src/style.css','body{}');
 write('scripts/spider-view.html','<script>const x=/*__MAP_DATA__*/null;</script>');
 return {root,write};
}
test('resolves .js TS imports, reexports, dynamic imports, alias and assets; finds transitive consumers and semantic peers',t=>{
 const {root}=fixture(t),map=buildMap(root),result=impact(map,['server/plan.ts']);
 assert.deepEqual(map.unresolved,[]);assert.deepEqual(map.invalidDomainPaths,[]);
 assert.ok(result.importConsumers.includes('server.ts'));assert.ok(result.importConsumers.includes('src/client.ts'));
 assert.ok(result.relatedFiles.includes('src/display.ts'));assert.ok(result.candidateTests.includes('server/plan.test.ts'));
 assert.equal(map.dynamic.length,1);assert.equal(map.routes[0].method,'POST');assert.equal(map.stores[0].key,"'grant_payment_atomic'");assert.equal(map.environment[0].name,'MODE');
});
test('deterministic output changes with source edits; missing imports and domain paths are explicit',t=>{
 const {root,write}=fixture(t),before=buildMap(root);assert.deepEqual(buildMap(root),before);
 write('server/plan.ts','export const amount=20;');assert.notEqual(buildMap(root).sourceDigest,before.sourceDigest);
 fs.unlinkSync(path.join(root,'src/display.ts'));const after=buildMap(root);assert.ok(after.invalidDomainPaths.some(x=>x.path==='src/display.ts'));assert.ok(after.unresolved.some(x=>x.specifier==='@/display'));
 assert.throws(()=>impact(after,['not-a-file.ts']),/Unknown path/);
});
test('cycles terminate and unrelated domains are not recursively expanded',t=>{
 const {root,write}=fixture(t);write('server/plan.ts',"import './api.js'; export const amount=10;");
 write('src/independent.ts','export const value=1;');
 const domains=JSON.parse(fs.readFileSync(path.join(root,'rule/domains.json'),'utf8'));domains.domains.push({id:'unrelated',reason:'Only a peer shares this domain',files:['src/display.ts','src/independent.ts'],tests:[]});write('rule/domains.json',JSON.stringify(domains));
 const result=impact(buildMap(root),['server/plan.ts']);assert.equal(new Set(result.importConsumers).size,result.importConsumers.length);assert.ok(result.importConsumers.includes('server.ts'));assert.ok(!result.relatedFiles.includes('src/independent.ts'));assert.deepEqual(result.semanticDomains.map(d=>d.id),['payments']);
});
test('inline map cannot close script tag with hostile source text',t=>{
 const {root,write}=fixture(t);write('server/plan.ts',"fetch('</script><img src=x onerror=alert(1)>');");
 const html=artifacts(buildMap(root),root)['spider-map.html'];assert.equal((html.match(/<\/script>/g)||[]).length,1);assert.ok(html.includes('\\u003c/script>'));
});
