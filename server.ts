import 'dotenv/config';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import app from './src/serverApp.js';

const port=Number(process.env.PORT||3000);

async function startServer(){
  if(process.env.NODE_ENV!=='production'){
    const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});
    app.use(vite.middlewares);
  }else{
    const distPath=path.join(process.cwd(),'dist');
    app.use((await import('express')).default.static(distPath));
    app.get('*',(_req,res)=>res.sendFile(path.join(distPath,'index.html')));
  }
  app.listen(port,'0.0.0.0',()=>console.log('Creative Memory Studio is running at http://localhost:'+port));
}

startServer().catch(error=>{console.error(error);process.exitCode=1});
