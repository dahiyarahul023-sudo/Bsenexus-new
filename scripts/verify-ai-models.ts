/**
 * CLI: npm run verify:ai
 * Model registry ko Groq + NVIDIA ke live catalogs se verify karta hai.
 * GROQ_API_KEY env me honi chahiye (Groq catalog ke liye); NVIDIA bina key ke chalta hai.
 */
import { verifyAllModels } from '../server/services/ai/verifyModels.js';

const report = await verifyAllModels();
let ok = 0, bad = 0;
console.log('\n=== AI MODEL VERIFY REPORT ===\n');
for (const r of report) {
  const mark = r.verifiedOk ? '✅' : '❌';
  if (r.verifiedOk) ok++; else bad++;
  console.log(`${mark} ${r.alias}  [${r.provider}] ${r.modelId}`);
  console.log(`   ${r.detail}\n`);
}
console.log(`Result: ${ok} verified, ${bad} NOT verified. State saved to data/ai_models_verified.json`);
process.exit(bad > 0 ? 2 : 0);
