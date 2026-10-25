// Imagen de fondo del chat: se guarda SOLO en este aparato (IndexedDB), nunca en un servidor.
const BD = 'mjb-chat-fondo';
const TIENDA = 'imagen';
const LLAVE = 'fondo';

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, err) => {
    const r = indexedDB.open(BD, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(TIENDA); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => err(r.error);
  });
}

export async function leerImagenFondo(): Promise<Blob | null> {
  const db = await abrir();
  return new Promise((ok, err) => {
    const q = db.transaction(TIENDA).objectStore(TIENDA).get(LLAVE);
    q.onsuccess = () => { db.close(); ok((q.result as Blob) ?? null); };
    q.onerror = () => { db.close(); err(q.error); };
  });
}

export async function guardarImagenFondo(b: Blob): Promise<void> {
  const db = await abrir();
  return new Promise((ok, err) => {
    const t = db.transaction(TIENDA, 'readwrite');
    t.objectStore(TIENDA).put(b, LLAVE);
    t.oncomplete = () => { db.close(); ok(); };
    t.onerror = () => { db.close(); err(t.error); };
    t.onabort = () => { db.close(); err(t.error); };
  });
}

export async function borrarImagenFondo(): Promise<void> {
  const db = await abrir();
  return new Promise((ok, err) => {
    const t = db.transaction(TIENDA, 'readwrite');
    t.objectStore(TIENDA).delete(LLAVE);
    t.oncomplete = () => { db.close(); ok(); };
    t.onerror = () => { db.close(); err(t.error); };
  });
}

// Reduce a 1080 px máx. y JPEG calidad 0,7; si pesa > 400 KB baja hasta 0,5.
export async function reducirImagen(archivo: File): Promise<Blob> {
  const bmp = await createImageBitmap(archivo);
  const esc = Math.min(1, 1080 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * esc));
  c.height = Math.max(1, Math.round(bmp.height * esc));
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const aBlob = (q: number) => new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', q));
  let blob = await aBlob(0.7);
  for (const q of [0.6, 0.5]) {
    if (blob && blob.size <= 400 * 1024) break;
    blob = await aBlob(q);
  }
  if (!blob) throw new Error('canvas');
  return blob;
}
