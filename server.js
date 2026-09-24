import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {createHandler} from './src/http.js';

if(!process.env.DATABASE_URL)throw Error('DATABASE_URL 환경변수에 Neon 연결 문자열을 설정하세요.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:15000,statement_timeout:20000});
pool.on('error',()=>console.error('Database connection interrupted'));
await pool.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
const store={
 async getFont(id){const {rows}=await pool.query('SELECT bytes FROM teacher_fonts WHERE id=$1',[id]);return rows[0]?.bytes;},
 async putFont(id,bytes){const result=await pool.query('INSERT INTO teacher_fonts(id,bytes) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',[id,bytes]);if(result.rowCount)return true;const old=await this.getFont(id);return old.equals(bytes);},
 async get(){const {rows}=await pool.query('SELECT revision, values FROM teacher_workspace WHERE id=1');return rows[0];},
 async put(revision,values){const {rows}=await pool.query('UPDATE teacher_workspace SET values=$1::jsonb, revision=revision+1, updated_at=now() WHERE id=1 AND revision=$2 RETURNING revision',[JSON.stringify(values),revision]);return rows[0]||null;},
 async health(){await pool.query('SELECT 1');}
};
const server=http.createServer(createHandler(store,fileURLToPath(new URL('./public/',import.meta.url))));
server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Teacher workspace server ready'));
process.on('SIGTERM',()=>server.close(async()=>{await pool.end();process.exit(0);}));
