import {route, db, all, get, run, need, adm, str, own, hitOr429, err, audit} from '../core.js';

db.exec(`CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY,user_id INT NOT NULL REFERENCES users(id),body TEXT NOT NULL,attachment_id INT REFERENCES attachments(id),hidden INT NOT NULL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS post_reports(post_id INT NOT NULL,user_id INT NOT NULL,PRIMARY KEY(post_id,user_id));`);

const REPORT_HIDE_AT = 3;

// Public: anyone can read the feed
route('GET','/feed',c=>{
  const before=+(c.q?.before)||0;
  return all(`SELECT p.id,p.body,p.created_at,p.user_id,u.name,u.account_type,a.mime,p.attachment_id
    FROM posts p JOIN users u ON u.id=p.user_id LEFT JOIN attachments a ON a.id=p.attachment_id
    WHERE p.hidden=0 AND u.active=1 AND (?=0 OR p.id<?) ORDER BY p.id DESC LIMIT 30`,before,before);
});

// Registered users only
route('POST','/feed',c=>{
  const u=need(c);
  hitOr429('post|'+u.id,+(process.env.POST_PER_HOUR)||30);
  const body=str(c.b.body,1,500,'المنشور');
  const att=own(u,c.b.attachment_id);
  run('INSERT INTO posts(user_id,body,attachment_id) VALUES(?,?,?)',u.id,body,att);
  return{ok:1};
});

// Author or admin removes a post
route('POST','/feed/(\\d+)/delete',c=>{
  const u=need(c),id=+c.p[0];
  const p=get('SELECT user_id FROM posts WHERE id=?',id);
  if(!p)throw err(404,'المنشور غير موجود');
  if(p.user_id!==u.id&&u.role!=='admin')throw err(403,'غير مصرح');
  run('UPDATE posts SET hidden=1 WHERE id=?',id);
  if(u.role==='admin'&&p.user_id!==u.id)audit(u.id,'post_hide',`post:${id}`);
  return{ok:1};
});

// Any registered user can report; repeated reports hide the post pending admin review
route('POST','/feed/(\\d+)/report',c=>{
  const u=need(c),id=+c.p[0];
  if(!get('SELECT 1 x FROM posts WHERE id=? AND hidden=0',id))throw err(404,'المنشور غير موجود');
  run('INSERT OR IGNORE INTO post_reports(post_id,user_id) VALUES(?,?)',id,u.id);
  const n=get('SELECT COUNT(*) n FROM post_reports WHERE post_id=?',id).n;
  if(n>=REPORT_HIDE_AT)run('UPDATE posts SET hidden=1 WHERE id=?',id);
  return{ok:1,hidden:n>=REPORT_HIDE_AT};
});

// Admin lists reported posts (including auto-hidden ones) for review
route('GET','/admin/reported-posts',c=>{
  adm(c);
  return all(`SELECT p.id,p.body,p.hidden,u.name,(SELECT COUNT(*) FROM post_reports r WHERE r.post_id=p.id) reports
    FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id IN (SELECT post_id FROM post_reports) ORDER BY reports DESC,p.id DESC LIMIT 100`);
});
