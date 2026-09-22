import type { CircuitDoc } from "../engines/digital/circuit";

export interface SavedProject {
  id: string;
  name: string;
  doc: CircuitDoc;
  updated: number;
}

const DB = "logiclab";
const STORE = "projects";
const RECORDS = "records";

export interface SavedRecord {
  id: string;
  kind: "fsm" | "memory" | "cache" | "cpu" | "arch" | "builder" | "sandbox";
  name: string;
  data: string;
  updated: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(RECORDS)) db.createObjectStore(RECORDS, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listProjects(): Promise<SavedProject[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as SavedProject[]).sort((a, b) => b.updated - a.updated));
    request.onerror = () => reject(request.error);
  });
}

export async function saveProject(project: SavedProject): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(project);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecord(record: SavedRecord): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(RECORDS, "readwrite").objectStore(RECORDS).put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function listRecords(kind: SavedRecord["kind"]): Promise<SavedRecord[]> {
  const db = await openDb();
  const rows = await new Promise<SavedRecord[]>((resolve, reject) => {
    const request = db.transaction(RECORDS).objectStore(RECORDS).getAll();
    request.onsuccess = () => resolve(request.result as SavedRecord[]);
    request.onerror = () => reject(request.error);
  });
  return rows.filter((row) => row.kind === kind).sort((a, b) => b.updated - a.updated);
}
