// Simple memory store for ephemeral file uploads (PDFs)
// This is used to avoid sending large files over WebSockets.
// Note: In serverless environments (Vercel), this will only work if the 
// client hits the same instance, which is not guaranteed. 
// For Localhost/Docker, this works perfectly.

type UploadedFile = {
  content: Buffer;
  contentType: string;
  filename: string;
  createdAt: number;
};

const store = new Map<string, UploadedFile>();

export function saveUpload(id: string, content: Buffer, contentType: string, filename: string) {
  store.set(id, {
    content,
    contentType,
    filename,
    createdAt: Date.now(),
  });
  
  // Auto-cleanup after 2 hours
  setTimeout(() => {
    store.delete(id);
  }, 2 * 60 * 60 * 1000);
}

export function getUpload(id: string) {
  return store.get(id);
}

export function deleteUpload(id: string) {
  store.delete(id);
}

// Optional: Clear old files periodically
const globalStore = globalThis as unknown as { _uploadCleanupStarted?: boolean };

if (globalStore && !globalStore._uploadCleanupStarted) {
  globalStore._uploadCleanupStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [id, file] of store.entries()) {
      if (now - file.createdAt > 2 * 60 * 60 * 1000) {
        store.delete(id);
      }
    }
  }, 15 * 60 * 1000);
}
