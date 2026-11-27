import {autoPlace} from './exam-domain.mjs?v=20261127-exam1';
self.onmessage=({data})=>{try{self.postMessage({plan:autoPlace(data.plan,data.seed)});}catch(error){self.postMessage({error:error.message});}};
