// Online SQLite backup: includes accounts, photo blobs and the existing artisan data.
import Database from 'better-sqlite3';
import {mkdirSync,chmodSync,existsSync,unlinkSync} from 'node:fs';
import path from 'node:path';
const dataDir=path.resolve(process.env.MIRAS_DATA_DIR||'./data');
const source=path.join(dataDir,'miras.db');
if(!existsSync(source))throw new Error('No MIRAS database exists yet.');
const backupDir=path.resolve(process.env.MIRAS_BACKUP_DIR||path.join(dataDir,'backups'));
mkdirSync(backupDir,{recursive:true,mode:0o700});
const target=path.join(backupDir,`miras-${new Date().toISOString().replaceAll(':','-')}.db`);
const db=new Database(source,{readonly:true,fileMustExist:true});
try{
 await db.backup(target);chmodSync(target,0o600);
 const check=new Database(target,{readonly:true,fileMustExist:true});
 try{if(check.pragma('integrity_check',{simple:true})!=='ok')throw new Error('Backup integrity check failed.');}finally{check.close();}
 console.log(`Verified SQLite backup written: ${target}`);
}catch(error){if(existsSync(target))unlinkSync(target);throw error;}finally{db.close();}
