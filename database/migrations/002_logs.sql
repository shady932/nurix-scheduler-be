CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_type TEXT NOT NULL,     
  owner_id TEXT,                
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  meta TEXT,                    
  created_at TEXT
);
