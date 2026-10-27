import test from 'node:test';
import assert from 'node:assert/strict';
import { DIRECTORY_COMPANIES, directoryDescription, directoryBadge } from '../../src/config/companyDirectory';

test('the original directory order remains intact, with the requested trust appended',()=>{
  const original=['BSE','NSE','RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','SBIN','BHARTIARTL','ITC','KOTAKBANK','LT','AXISBANK','MARUTI','TITAN','ASIANPAINT','HCLTECH','SUNPHARMA','TATAMOTORS','TATASTEEL','WIPRO','ULTRACEMCO','NTPC','POWERGRID','ONGC','COALINDIA','BAJFINANCE','TRENT'];
  assert.deepEqual(DIRECTORY_COMPANIES.slice(0,-1).map(c=>c.symbol),original);
  assert.deepEqual(DIRECTORY_COMPANIES.slice(-1).map(c=>[c.symbol,c.scripCode,c.name]),[['NXST','543913','Nexus Select Trust']]);
  assert.match(directoryDescription(),/^Explore 29 /);assert.match(directoryBadge(),/^29 /);
});
test('a future directory entry automatically changes all shared count copy',()=>{
  const future=[...DIRECTORY_COMPANIES,{...DIRECTORY_COMPANIES[2],symbol:'FUTURE'}];
  assert.match(directoryDescription(future),/^Explore 30 /);assert.match(directoryBadge(future),/^30 /);
  assert.equal(DIRECTORY_COMPANIES.length,29,'test draft must not mutate the real source');
});
