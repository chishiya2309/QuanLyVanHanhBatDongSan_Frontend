import { afterEach, expect, it, vi } from 'vitest';
import { deleteDraft, updateDraft } from '../src/services/invoiceDraftApi';

afterEach(() => vi.unstubAllGlobals());
it('uses CSRF on a bodyless draft DELETE and writes precise numeric JSON in a PATCH', async () => {
  const fetcher = vi.fn(async (input: string) => Response.json({data:input.endsWith('/auth/csrf')
    ? {token:'valid-test-token',headerName:'X-CSRF-TOKEN'} : null}));
  vi.stubGlobal('fetch', fetcher);
  await deleteDraft('draft-id', 7);
  expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/draft?version=7'),
    expect.objectContaining({method:'DELETE',body:undefined,headers:expect.any(Headers)}));
  const [, deletion] = fetcher.mock.calls.find(call => call[0].endsWith('version=7')) as unknown as [string, RequestInit];
  expect(new Headers(deletion.headers).get('X-CSRF-TOKEN')).toBe('valid-test-token');
  await updateDraft('draft-id',7,'',false,[{name:'Phí',kind:'FEE',amount:'9007199254740993.01'}],[],'Lý do');
  expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/draft'), expect.objectContaining({
    method:'PATCH',body:expect.stringContaining('"amount":9007199254740993.01'),
  }));
});
