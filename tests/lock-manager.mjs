// Deterministic FIFO stand-in for the origin-wide Web Locks service shared by tabs.
export function createLockManager() {
  const tails=new Map();
  return {
    request(name,options,callback) {
      if(options.mode!=='exclusive')throw Error('exclusive required');
      const previous=tails.get(name)||Promise.resolve();
      const result=previous.catch(()=>{}).then(()=>{
        if(options.signal?.aborted)throw Error('aborted');
        return callback({name,mode:'exclusive'});
      });
      tails.set(name,result.catch(()=>{}));
      return result;
    },
  };
}
