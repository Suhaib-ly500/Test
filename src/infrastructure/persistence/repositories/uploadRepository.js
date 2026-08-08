const { q, qOne, qRun } = require('../db');

async function saveFile(id, mime, data) {
  return qRun('INSERT OR REPLACE INTO files (id, mime, size, data) VALUES (?, ?, ?, ?)', [id, mime, data.length, data]);
}

async function getFile(id) {
  return qOne('SELECT id, mime, size, data FROM files WHERE id = ?', [id]);
}

async function removeFile(id) {
  return qRun('DELETE FROM files WHERE id = ?', [id]);
}

async function countFiles() {
  const r = await qOne('SELECT COUNT(*) as c FROM files');
  return r ? r.c : 0;
}

module.exports = { saveFile, getFile, removeFile, countFiles };