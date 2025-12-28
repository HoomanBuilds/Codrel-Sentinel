import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'db.json');

if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ connectedRepos: [] }, null, 2));
}

export const jsonDb = {
  read: () => {
    try {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    } catch (e) {
      return { connectedRepos: [] };
    }
  },
  
  write: (data: any) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  },
  
  addConnectedRepo: (repo: any) => {
    const data = jsonDb.read();
    if (!data.connectedRepos.find((r: any) => r.id === repo.id)) {
      data.connectedRepos.push({
        ...repo,
        connectedAt: new Date().toISOString(),
        status: 'PROCESSING' 
      });
      jsonDb.write(data);
    }
  },
  
  getConnectedRepos: () => {
    return jsonDb.read().connectedRepos;
  }
};