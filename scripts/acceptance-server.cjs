// Local acceptance server: always owns a disposable replica set; never uses the application's URI.
const path=require("node:path"),fs=require("node:fs"),{spawn}=require("node:child_process"),{randomBytes}=require("node:crypto");
const root=path.resolve(__dirname,"..");
process.chdir(root);
process.env.MONGOMS_DOWNLOAD_DIR=path.join(root,".private-data/test-mongo-binaries");
process.env.MONGOMS_MAX_RETRIES="1";
const {MongoMemoryReplSet}=require("mongodb-memory-server");
let ownedReplica,ownedChild;
async function main(){
  const port=Number(process.env.ACCEPTANCE_PORT||3005);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error("ACCEPTANCE_PORT must be an integer between 1024 and 65535.");
  const cache=process.env.MONGOMS_DOWNLOAD_DIR;
  const binary=fs.existsSync(cache)?fs.readdirSync(cache).find(n=>/^mongod.*\.exe$/.test(n)):null;
  const replica=await MongoMemoryReplSet.create({replSet:{count:1,storageEngine:"wiredTiger"},...(binary?{binary:{systemBinary:path.join(cache,binary)}}:{})});
  ownedReplica=replica;
  const database="campuspulse_test_runtime_"+randomBytes(6).toString("hex"),uri=replica.getUri(database);
  const env={...process.env,NODE_ENV:"development",MONGODB_URI:uri,JWT_SECRET:randomBytes(48).toString("hex"),PORT:String(port),APP_ORIGIN:"http://localhost:"+port,STORAGE_DRIVER:"local",SCANNER_DRIVER:"development",EMAIL_DRIVER:"development",PRIVATE_DATA_DIR:path.join(root,".private-data/runtime-"+database)};
  Object.assign(process.env,env);
  require("./register.cjs");
  const mongoose=require("mongoose"),{dbConnect}=require("../src/lib/mongodb.ts"),User=require("../src/models/User.ts").default,{hashPassword}=require("../src/lib/auth.ts");
  await dbConnect();
  const password="RuntimeAcceptance!2026";
  await User.create([{name:"Runtime Student",email:"student.runtime@example.invalid",passwordHash:await hashPassword(password),role:"student",academicDepartment:"Computer Science"},{name:"Runtime Admin",email:"admin.runtime@example.invalid",passwordHash:await hashPassword(password),role:"admin",department:"IT / Network"}]);
  await mongoose.disconnect();
  const log=fs.createWriteStream(path.join(root,"test-results/stabilization-runtime-server.log"),{flags:"w"});
  const child=spawn(process.execPath,["server.js"],{cwd:root,env,stdio:["ignore","pipe","pipe"]});
  ownedChild=child;
  for(const stream of [child.stdout,child.stderr])stream.on("data",chunk=>{log.write(chunk);process.stdout.write(chunk);});
  let stopping=false;
  async function stop(){if(stopping)return;stopping=true;child.kill();await replica.stop();log.end();}
  process.once("SIGINT",()=>stop().then(()=>process.exit(0)));
  process.once("SIGTERM",()=>stop().then(()=>process.exit(0)));
  child.on("exit",async code=>{await stop();process.exitCode=code||0;});
  child.on("error",async error=>{console.error(error.message);await stop();process.exitCode=1;});
  console.log("Disposable runtime database: "+database+"; URL: "+env.APP_ORIGIN);
}
main().catch(async error=>{console.error("Acceptance startup failed:",error.message);ownedChild?.kill();await require("mongoose").disconnect();if(ownedReplica)await ownedReplica.stop();process.exitCode=1;});
