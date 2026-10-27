import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import express from 'express';
import { INDEXNOW_KEY } from '../services/indexNowConfig';

test('actual server ownership route returns HTTP 200, plain text and the matching public key',async()=>{
  const source=fs.readFileSync('server.ts','utf8');const ast=ts.createSourceFile('server.ts',source,ts.ScriptTarget.Latest,true);
  const statement=ast.statements.find(node=>ts.isExpressionStatement(node)&&node.getText(ast).includes("'/indexnow-key.txt'"));assert.ok(statement);
  const app=express();vm.runInNewContext(ts.transpileModule(statement!.getText(ast),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{app,INDEXNOW_KEY});
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
  try{const response=await fetch(`http://127.0.0.1:${(server.address() as any).port}/${INDEXNOW_KEY}.txt`);assert.equal(response.status,200);assert.match(response.headers.get('content-type')!,/text\/plain/);assert.equal(await response.text(),INDEXNOW_KEY);assert.equal(fs.readFileSync('public/indexnow-key.txt','utf8').trim(),INDEXNOW_KEY);}
  finally{await new Promise<void>(r=>{server.close(()=>r());server.closeAllConnections()});}
});
