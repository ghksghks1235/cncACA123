import {solveSeating} from './exam-solver.mjs?v=20261128-solver1';
self.onmessage=({data})=>{try{
 const result=solveSeating(data.plan,{seed:data.seed,timeLimitMs:data.timeLimitMs||14000,onProgress:progress=>self.postMessage({type:'progress',progress})});
 self.postMessage({type:'result',result});
}catch(error){self.postMessage({type:'error',error:error.message});}};
