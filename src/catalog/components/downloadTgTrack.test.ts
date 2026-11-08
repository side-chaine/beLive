import { describe, it, expect, vi } from 'vitest';
if (typeof (globalThis as any).Blob === 'undefined') { (globalThis as any).Blob = class { constructor(p:any,_o?:any){ (this as any)._p=p; } }; }
if (typeof (globalThis as any).File === 'undefined') { (globalThis as any).File = class { constructor(p:any,n:string,o?:any){ (this as any).blob=p; (this as any).name=n; (this as any).type=o?.type; } }; }
const mod = await import('./CatalogContent');
const { isTransient, downloadTgTrack, computeDownloadTimeout } = mod as any;
describe('computeDownloadTimeout', () => {
  it('неизвестный размер → пол в 10 минут, а не 30 секунд', () => {
    // Регресс-страж: пол в 30 с обрывал ZIP со стемами на середине
    // (AbortError), а retry сбрасывал прогресс — «загрузка пошла вспять».
    expect(computeDownloadTimeout(undefined)).toBe(600_000);
    expect(computeDownloadTimeout(0)).toBe(600_000);
  });
  it('маленький файл всё равно получает пол', () => {
    expect(computeDownloadTimeout(1_000_000)).toBe(600_000);
  });
  it('большой файл считается по размеру', () => {
    // 300 МБ при 300 кБ/с с двукратным запасом = 2000 с.
    expect(computeDownloadTimeout(300_000_000)).toBe(2_000_000);
  });
});
describe('isTransient', () => {
  it('AbortError true', () => expect(isTransient(new DOMException('a','AbortError'))).toBe(true));
  it('server5xx true', () => expect(isTransient(new Error('server5xx'))).toBe(true));
  it('truncated true', () => expect(isTransient(new Error('truncated'))).toBe(true));
  it('no-reader true', () => expect(isTransient(new Error('no-reader'))).toBe(true));
  it('network/fetch true', () => expect(isTransient(new Error('fetch failed network'))).toBe(true));
  it('plain 404 false', () => expect(isTransient(new Error('404'))).toBe(false));
  it('non-Error false', () => expect(isTransient('oops')).toBe(false));
});
describe('downloadTgTrack retry', () => {
  it('retries once on network then succeeds', async () => {
    const okResp:any = { ok:true, status:200, headers:{ get:(h:string)=> h==='Content-Length'?'10': h==='Content-Type'?'application/zip':null }, body:{ getReader:()=>{ let n=0; return { async read(){ if(n++===0) {return {done:false,value:new Uint8Array(10)};} return {done:true,value:undefined}; } }; } } };
    let calls=0; const fetcher:any = async () => { calls++; if(calls===1) {throw new Error('fetch failed network');} return okResp; };
    const handleZip = vi.fn(async () => {});
    await downloadTgTrack({ id:'x', title:'T', artist:'A', slug:'t', type:'duo', fileIds:{instrumental:'F'}, fileSize:10, fileName:'t.zip' }, handleZip, vi.fn(), fetcher);
    expect(calls).toBe(2); expect(handleZip).toHaveBeenCalledTimes(1);
  });
  it('4xx no retry', async () => {
    const fetcher:any = async () => ({ ok:false, status:404, headers:{ get:()=>null } });
    const handleZip = vi.fn(async () => {});
    await downloadTgTrack({ id:'x', title:'T', artist:'A', slug:'t', type:'duo', fileIds:{instrumental:'F'}, fileSize:10, fileName:'t.zip' }, handleZip, vi.fn(), fetcher);
    expect(handleZip).toHaveBeenCalledTimes(0);
  });
});
