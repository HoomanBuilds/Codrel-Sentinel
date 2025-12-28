import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'db.json');

if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ connectedRepos: [] }, null, 2));
}

export const jsonDb = {
  read: () => {
    try {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      return { connectedRepos: [] };
    }
  },
  
  write: (data: any) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  },
  
  addConnectedRepo: (repo: any) => {
    const data = jsonDb.read();
    const index = data.connectedRepos.findIndex((r: any) => r.id === repo.id);
    
    if (index >= 0) {
      data.connectedRepos[index] = { ...data.connectedRepos[index], ...repo };
    } else {
      data.connectedRepos.push({
        ...repo,
        status: 'PROCESSING',
        connectedAt: new Date().toISOString()
      });
    }
    jsonDb.write(data);
  },
  
  getConnectedRepos: () => {
    return jsonDb.read().connectedRepos || [];
  }
};